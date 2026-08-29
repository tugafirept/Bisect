import "./style.css";
import type { Feature } from "geojson";
import type { GeoProjection } from "d3-geo";
import {
  loadCountry,
  loadManifest,
  loadPopulation,
  loadRivers,
} from "./data/loader";
import { fitProjection } from "./render/projection";
import {
  clear,
  drawCities,
  drawHandle,
  drawLine,
  drawRivers,
  fillFeature,
  fillMultiPolygon,
  strokeFeature,
} from "./render/draw";
import { attachLineDrag, type Endpoints } from "./render/interaction";
import { splitByLine } from "./game/engine";
import { areaMode, type Mode } from "./game/modes";
import { createPopulationMode, type PopulationField } from "./game/population";
import { createRiverMode, type RiverField } from "./game/rivers";
import { bestBalancedLine } from "./game/optimize";
import { score } from "./game/scoring";
import { attemptFeedback, type AttemptFeedback } from "./game/feedback";
import {
  dailyChallenge,
  formatCountdown,
  isoDate,
  msUntilNextPuzzle,
} from "./game/daily";
import { buildShareText, puzzleNumber } from "./game/share";
import {
  findRecord,
  loadStore,
  recordCompletion,
  saveStore,
  type AttemptScore,
  type Store,
} from "./game/storage";
import type { Position } from "./game/geo";
import { renderResult, type ResultCountry, type ResultHandle } from "./ui/result";
import { setupHelp } from "./ui/help";
import { LANGS, lang, n0, n1, n2, setLang, t } from "./i18n";

const CSS_W = 720;
const CSS_H = 520;
const MAX_ATTEMPTS = 3;
// keep in sync with --color-a / --color-b in style.css
const COLOR_A = "#6ea8fe";
const COLOR_B = "#ffb35c";
const COLOR_PAST = "rgba(130,130,130,0.55)";
const COLOR_RIVER = "#0b3d91";
// optimal-line colour per round
const OPTIMAL_COLOR: Record<string, string> = {
  area: "#2fbf71",
  rivers: "#f59e0b",
  population: "#c026d3",
};

const params = new URLSearchParams(location.search);
const DEV = params.has("dev");
const FORCE_COUNTRY = params.get("country")?.toUpperCase() ?? null;
// ?date=YYYY-MM-DD re-seeds the daily (country, puzzle number and label all move
// together), so a shareable link can land on a chosen puzzle without dev mode.
// Only past dates and today are honoured — a future date would spoil upcoming
// puzzles, so it's ignored and we fall back to today.
const dateParam = params.get("date");
const DATE_OVERRIDE =
  dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= isoDate()
    ? dateParam
    : null;

const pt1 = n1;

const langOptions = LANGS.map(
  (l) => `<option value="${l.code}"${l.code === lang ? " selected" : ""}>${l.label}</option>`,
).join("");

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="game">
    <header>
      <div class="header-tools">
        <div class="archive-nav">
          <button id="archivePrev" class="archive-arrow" type="button" aria-label="${t.ui.archivePrev}">‹</button>
          <select id="archiveSelect" class="archive-select" aria-label="${t.ui.archiveLabel}"></select>
          <button id="archiveNext" class="archive-arrow" type="button" aria-label="${t.ui.archiveNext}">›</button>
        </div>
        <div class="header-tools-right">
          <select id="langSelect" aria-label="${t.ui.languageLabel}">${langOptions}</select>
          <button id="helpBtn" class="help-btn" type="button" aria-label="${t.ui.helpLabel}">?</button>
        </div>
      </div>
      <h1>${t.appName}</h1>
      <p class="tagline">${t.tagline}</p>
      <p id="prompt"></p>
      <p id="streak" class="streak" hidden></p>
    </header>

    <div class="stage">
      <canvas id="board" width="${CSS_W}" height="${CSS_H}"></canvas>
    </div>

    <div class="hud">
      <p id="round" class="round" hidden></p>
      <div id="pips" class="pips"></div>
      <p id="instruction"></p>
      <div class="hud-actions">
        <button id="finishEarly" type="button" class="btn-ghost" hidden></button>
        <button id="confirm" type="button">${t.buttons.confirm}</button>
      </div>
      <div id="viewToggle" class="view-toggle" hidden></div>
    </div>

    <div id="attemptLog" class="attempt-log"></div>
    <div id="result" class="result-card" hidden></div>
  </main>
  <dialog id="help" class="help-dialog"></dialog>
`;

document.title = t.appName;

const langSelect = app.querySelector<HTMLSelectElement>("#langSelect")!;
langSelect.addEventListener("change", () => {
  setLang(langSelect.value as (typeof LANGS)[number]["code"]);
  location.reload();
});

const canvas = app.querySelector<HTMLCanvasElement>("#board")!;
const ctx = canvas.getContext("2d")!;
const promptEl = app.querySelector<HTMLParagraphElement>("#prompt")!;
const streakEl = app.querySelector<HTMLParagraphElement>("#streak")!;
const roundEl = app.querySelector<HTMLParagraphElement>("#round")!;
const pipsEl = app.querySelector<HTMLDivElement>("#pips")!;
const instructionEl = app.querySelector<HTMLParagraphElement>("#instruction")!;
const confirmBtn = app.querySelector<HTMLButtonElement>("#confirm")!;
const finishEarlyBtn = app.querySelector<HTMLButtonElement>("#finishEarly")!;
const viewToggleEl = app.querySelector<HTMLDivElement>("#viewToggle")!;
const attemptLogEl = app.querySelector<HTMLDivElement>("#attemptLog")!;
const resultEl = app.querySelector<HTMLDivElement>("#result")!;

setupHelp(
  app.querySelector<HTMLDialogElement>("#help")!,
  app.querySelector<HTMLButtonElement>("#helpBtn")!,
);

type Phase = "playing" | "revealed" | "done";

interface RoundState {
  mode: Mode;
  attempts: AttemptScore[];
  lines: Array<[Position, Position]>; // lng/lat
  optimal: { a: Position; b: Position; fractionA: number } | null;
}

const isRivers = (r: RoundState): boolean => r.mode.id === "rivers";
const isPopulation = (r: RoundState): boolean => r.mode.id === "population";
const optimalColor = (r: RoundState): string =>
  OPTIMAL_COLOR[r.mode.id] ?? OPTIMAL_COLOR.area!;

const modeLabel = (r: RoundState): string =>
  (t.modes as Record<string, string>)[r.mode.id] ?? r.mode.label;

function flagEmoji(cc?: string): string {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}
const headline = (fb: AttemptFeedback): string => `${fb.percentA} / ${100 - fb.percentA}`;

function hintFor(fb: AttemptFeedback): string {
  const side = fb.biggerSide === "A" ? t.feedback.sideBlue : t.feedback.sideOrange;
  if (fb.kind === "perfect") return t.feedback.perfect;
  if (fb.kind === "close") return t.feedback.close(side, n2(fb.deviationPP));
  return t.feedback.push(side, n0(fb.deviationPP));
}

function modeFromId(id: string): Mode {
  if (id === "population" && field) return createPopulationMode(field);
  if (id === "rivers" && riverField) return createRiverMode(riverField);
  return areaMode;
}

let feature: Feature;
let projection: GeoProjection;
let field: PopulationField | null = null;
let riverField: RiverField | null = null;
let countryId = "";
let countryName = "";
let countryCard: ResultCountry = {
  flag: "",
  name: "",
  areaKm2: 0,
  popEst: 0,
  difficulty: 0,
};
let puzzle = 0;
let store: Store = loadStore();

// Archive picker: today + the previous 60 dailies. Choosing one (or using the
// ‹ / › arrows) reloads with ?date=, which re-seeds the whole puzzle (see
// DATE_OVERRIDE).
const archiveSelect = app.querySelector<HTMLSelectElement>("#archiveSelect")!;
const archivePrevBtn = app.querySelector<HTMLButtonElement>("#archivePrev")!;
const archiveNextBtn = app.querySelector<HTMLButtonElement>("#archiveNext")!;
const currentDate = DATE_OVERRIDE ?? isoDate();

/** ISO date `days` away from `iso`, staying on UTC midnight. */
function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Reload on a chosen archive day; today drops the param entirely. */
function goToDate(d: string): void {
  location.search = d >= isoDate() ? "" : `?date=${d}`;
}

{
  const opts: string[] = [];
  for (let i = 0; i < 61; i++) {
    const d = shiftDate(isoDate(), -i);
    if (puzzleNumber(d) < 1) break; // stop at puzzle #1
    const done = findRecord(store, puzzleNumber(d))?.completed ? "✓ " : "";
    const label = i === 0 ? t.ui.archiveToday : d;
    opts.push(
      `<option value="${d}"${d === currentDate ? " selected" : ""}>${done}${label}</option>`,
    );
  }
  archiveSelect.innerHTML = opts.join("");
}
archiveSelect.addEventListener("change", () => goToDate(archiveSelect.value));

archivePrevBtn.disabled = puzzleNumber(shiftDate(currentDate, -1)) < 1;
archiveNextBtn.disabled = currentDate >= isoDate();
archivePrevBtn.addEventListener("click", () =>
  goToDate(shiftDate(currentDate, -1)),
);
archiveNextBtn.addEventListener("click", () =>
  goToDate(shiftDate(currentDate, 1)),
);

/** Prefix the current day's archive option with the ✓ once it's completed. */
function markArchiveCompleted(): void {
  const opt = [...archiveSelect.options].find(
    (o) => o.value === (DATE_OVERRIDE ?? isoDate()),
  );
  if (opt && !opt.textContent?.startsWith("✓")) {
    opt.textContent = `✓ ${opt.textContent}`;
  }
}

let rounds: RoundState[] = [];
let ri = 0;
let phase: Phase = "playing";
/** done-phase map view: null = both optimal lines, or a round index to focus */
let viewRound: number | null = null;
let countdownTimer: number | undefined;
let resultHandle: ResultHandle | undefined;

const endpoints: Endpoints = { a: [0, 0], b: [0, 0] };

const cur = (): RoundState => rounds[ri]!;
const maxPop = (): number => (field && field.cities[0] ? field.cities[0][2] : 0);

function setupCanvas(): void {
  // Fixed drawing space (CSS_W x CSS_H); CSS scales the element to fit the
  // viewport, so the backing store just needs to be crisp at that size.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CSS_W * dpr;
  canvas.height = CSS_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function toLngLat(p: Position): Position {
  const inv = projection.invert?.([p[0], p[1]]);
  return inv ? [inv[0], inv[1]] : [0, 0];
}

function toScreen(p: Position): Position {
  const s = projection([p[0], p[1]]);
  return s ? [s[0], s[1]] : [0, 0];
}

function roundBest(r: RoundState): number {
  return r.attempts.reduce((m, a) => Math.max(m, a.points), 0);
}

function bestLineOf(r: RoundState): [Position, Position] | null {
  if (r.lines.length === 0) return null;
  if (r.lines.length === 1) return r.lines[0]!; // e.g. reconstructed from storage
  let bi = 0;
  for (let i = 1; i < r.attempts.length; i++) {
    if (r.attempts[i]!.points > r.attempts[bi]!.points) bi = i;
  }
  return r.lines[bi] ?? null;
}

function computeOptimal(r: RoundState): void {
  const evalFn = (a: Position, b: Position): number =>
    r.mode.evaluate(feature, a, b).fractionA;
  const best = bestBalancedLine(
    feature,
    r.mode.id === "area" ? undefined : evalFn,
  );
  r.optimal = { a: best.a, b: best.b, fractionA: best.fractionA };
}

/** Metric overlay for a round. Population cities are hidden while playing — it's
 * a blind "where do people live?" estimate — and revealed in the result. Rivers
 * show in both: you still can't judge river *length* by eye. */
function drawOverlay(r: RoundState, mode: "play" | "review"): void {
  if (isPopulation(r)) {
    if (mode === "review" && field) {
      drawCities(ctx, projection, field.cities, maxPop(), true);
    }
  } else if (isRivers(r) && riverField) {
    drawRivers(ctx, projection, riverField.rivers, COLOR_RIVER, mode === "play" ? 1.8 : 1.3);
  }
}

function render(): void {
  clear(ctx, CSS_W, CSS_H);
  if (phase === "done") {
    renderDone();
    return;
  }

  const a = toLngLat(endpoints.a);
  const b = toLngLat(endpoints.b);
  try {
    const { sideA, sideB } = splitByLine(feature, a, b);
    fillMultiPolygon(ctx, projection, sideA, COLOR_A);
    fillMultiPolygon(ctx, projection, sideB, COLOR_B);
  } catch {
    fillFeature(ctx, projection, feature, "#dcdcdc");
  }
  strokeFeature(ctx, projection, feature, "#1f2933");
  drawOverlay(cur(), "play");
  drawLine(ctx, endpoints.a, endpoints.b);
  drawHandle(ctx, endpoints.a);
  drawHandle(ctx, endpoints.b);
}

function renderDone(): void {
  // "both" view: plain silhouette + every round's optimal line, for comparison
  if (viewRound === null) {
    fillFeature(ctx, projection, feature, "#e9e9ec");
    strokeFeature(ctx, projection, feature, "#1f2933");
    if (riverField) drawRivers(ctx, projection, riverField.rivers, COLOR_RIVER, 1);
    if (field) drawCities(ctx, projection, field.cities, maxPop(), false);
    for (const r of playedRounds()) {
      if (r.optimal) {
        drawLine(ctx, toScreen(r.optimal.a), toScreen(r.optimal.b), optimalColor(r), false);
      }
    }
    return;
  }

  // focused view: one round's split, its attempts, its optimal
  const r = rounds[viewRound]!;
  const best = bestLineOf(r);
  try {
    if (!best) throw new Error("no line");
    const { sideA, sideB } = splitByLine(feature, best[0], best[1]);
    fillMultiPolygon(ctx, projection, sideA, COLOR_A);
    fillMultiPolygon(ctx, projection, sideB, COLOR_B);
  } catch {
    fillFeature(ctx, projection, feature, "#dcdcdc");
  }
  strokeFeature(ctx, projection, feature, "#1f2933");
  drawOverlay(r, "review");
  for (const [la, lb] of r.lines) {
    drawLine(ctx, toScreen(la), toScreen(lb), COLOR_PAST, false);
  }
  if (r.optimal) {
    drawLine(ctx, toScreen(r.optimal.a), toScreen(r.optimal.b), optimalColor(r), false);
  }
}

function setupViewToggle(): void {
  const played = playedRounds();
  if (played.length < 2) {
    viewToggleEl.hidden = true;
    return;
  }
  viewToggleEl.hidden = false;
  viewToggleEl.innerHTML =
    `<span class="vt-label">${t.view.label}</span>` +
    `<button type="button" data-v="both" class="active">${t.view.all}</button>` +
    played
      .map((r, i) => `<button type="button" data-v="${i}">${modeLabel(r)}</button>`)
      .join("") +
    `<span class="vt-legend">` +
    played
      .map(
        (r) =>
          `<i class="vt-dot" style="background:${optimalColor(r)}"></i>${modeLabel(r).toLowerCase()}`,
      )
      .join("") +
    `</span>`;

  const buttons = viewToggleEl.querySelectorAll<HTMLButtonElement>("button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      viewRound = btn.dataset.v === "both" ? null : Number(btn.dataset.v);
      render();
    });
  });
}

function renderPips(): void {
  const done = cur().attempts.length;
  let html = "";
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const a = cur().attempts[i];
    const cls =
      a === undefined
        ? phase === "playing" && i === done
          ? "pip cur"
          : "pip"
        : a.points >= 90
          ? "pip done good"
          : a.points >= 70
            ? "pip done ok"
            : "pip done poor";
    html += `<span class="${cls}"></span>`;
  }
  pipsEl.innerHTML = html;
}

function renderStreak(): void {
  if (store.plays === 0) {
    streakEl.hidden = true;
    return;
  }
  streakEl.hidden = false;
  streakEl.textContent = t.streak(store.streak, store.maxStreak, store.plays);
}

function logAttempt(n: number, fb: AttemptFeedback): void {
  const row = document.createElement("div");
  row.className = "log-row";
  row.innerHTML =
    `<span class="log-head">${t.play.logHead(n, headline(fb), pt1(fb.points))}</span>` +
    `<span class="log-hint">${hintFor(fb)}</span>`;
  attemptLogEl.prepend(row);
}

function roundIntro(r: RoundState): string {
  const c = t.round.counter(ri + 1, rounds.length);
  if (r.mode.id === "rivers") return t.round.introRivers(c);
  if (r.mode.id === "population") return t.round.introPopulation(c);
  return t.round.introArea(c);
}

let busy = false;

/** Compute a round's optimal line in the background while the player is busy,
 * so the "next round" transition doesn't freeze on the coarse search. */
function scheduleOptimal(r: RoundState): void {
  if (r.optimal) return;
  const run = (): void => {
    if (!r.optimal) computeOptimal(r);
  };
  const ric = (window as { requestIdleCallback?: (cb: () => void, o?: object) => void })
    .requestIdleCallback;
  if (ric) ric(run, { timeout: 4000 });
  else window.setTimeout(run, 600);
}

/** Ensure a round's optimal is ready, showing a note + yielding if it isn't. */
function ensureOptimal(r: RoundState): Promise<void> {
  if (r.optimal) return Promise.resolve();
  instructionEl.hidden = false;
  instructionEl.textContent = t.buttons.calculating;
  return new Promise((resolve) => {
    requestAnimationFrame(() =>
      window.setTimeout(() => {
        if (!r.optimal) computeOptimal(r);
        resolve();
      }, 0),
    );
  });
}

function startRound(index: number): void {
  ri = index;
  attemptLogEl.innerHTML = "";
  roundEl.hidden = false;
  roundEl.textContent = roundIntro(cur());
  endpoints.a = [CSS_W * 0.5, CSS_H * 0.1];
  endpoints.b = [CSS_W * 0.5, CSS_H * 0.9];
  startAttempt();
  scheduleOptimal(cur());
}

function startAttempt(): void {
  phase = "playing";
  confirmBtn.hidden = false;
  confirmBtn.disabled = false;
  confirmBtn.textContent = t.buttons.confirm;
  finishEarlyBtn.hidden = true;
  instructionEl.hidden = false;
  instructionEl.textContent = t.play.attempt(cur().attempts.length + 1, MAX_ATTEMPTS);
  renderPips();
  render();
}

function confirmAttempt(): void {
  const a = toLngLat(endpoints.a);
  const b = toLngLat(endpoints.b);
  const res = cur().mode.evaluate(feature, a, b);
  cur().attempts.push({ fractionA: res.fractionA, points: score(res.fractionA) });
  cur().lines.push([a, b]);

  const fb = attemptFeedback(res.fractionA);
  logAttempt(cur().attempts.length, fb);
  renderPips();

  const roundFull = cur().attempts.length >= MAX_ATTEMPTS;
  const lastRound = ri >= rounds.length - 1;
  phase = "revealed";
  confirmBtn.textContent = roundFull
    ? lastRound
      ? t.buttons.seeResult
      : t.buttons.nextRound
    : t.buttons.nextAttempt;
  finishEarlyBtn.hidden = roundFull;
  finishEarlyBtn.textContent = lastRound ? t.buttons.finishNow : t.buttons.skipRound;
  instructionEl.textContent = roundFull
    ? t.play.roundDone(pt1(roundBest(cur())))
    : t.play.afterAttempt(headline(fb), pt1(fb.points), hintFor(fb));
  render();
}

async function leaveRound(): Promise<void> {
  if (busy) return;
  busy = true;
  confirmBtn.disabled = true;
  finishEarlyBtn.disabled = true;
  await ensureOptimal(cur());
  busy = false;
  finishEarlyBtn.disabled = false;
  if (ri < rounds.length - 1) startRound(ri + 1);
  else void finish();
}

function onConfirm(): void {
  if (busy) return;
  if (phase === "playing") confirmAttempt();
  else if (phase === "revealed") {
    if (cur().attempts.length < MAX_ATTEMPTS) startAttempt();
    else void leaveRound();
  }
}

function playedRounds(): RoundState[] {
  return rounds.filter((r) => r.attempts.length > 0);
}

async function finish(): Promise<void> {
  phase = "done";
  confirmBtn.hidden = true;
  finishEarlyBtn.hidden = true;
  instructionEl.hidden = true;
  pipsEl.hidden = true;
  roundEl.hidden = true;

  for (const r of playedRounds()) await ensureOptimal(r);
  instructionEl.hidden = true;

  if (!DEV) {
    store = recordCompletion(store, {
      puzzle,
      countryId,
      rounds: playedRounds().map((r) => ({
        mode: r.mode.id,
        attempts: r.attempts.map((x) => ({ ...x })),
        bestLine: bestLineOf(r),
      })),
    });
    saveStore(store);
    markArchiveCompleted();
  }

  viewRound = playedRounds().length > 1 ? null : 0;
  setupViewToggle();
  render();
  showFinal();
  renderStreak();
}

function showFinal(): void {
  const played = playedRounds();
  const shareText = buildShareText({
    puzzleNumber: puzzle,
    countryName,
    rounds: played.map((r) => ({ label: modeLabel(r), attempts: r.attempts })),
    streak: DEV ? undefined : store.streak,
    url: `${location.origin}${location.pathname}`,
  });

  const total = played.reduce((s, r) => s + roundBest(r), 0);

  resultHandle = renderResult(resultEl, {
    country: countryCard,
    rounds: played.map((r) => ({
      label: modeLabel(r),
      attempts: r.attempts,
      bestFractionA: r.optimal?.fractionA ?? 0.5,
    })),
    total,
    maxTotal: 100 * played.length,
    shareText,
    streak: store.streak,
    maxStreak: store.maxStreak,
    plays: store.plays,
    avgPct: store.plays > 0 ? store.sumPct / store.plays : (total / (100 * played.length)) * 100,
    countdownText: formatCountdown(msUntilNextPuzzle()),
    devReplay: DEV ? devReplay : undefined,
  });

  window.clearInterval(countdownTimer);
  countdownTimer = window.setInterval(() => {
    resultHandle?.setCountdown(formatCountdown(msUntilNextPuzzle()));
  }, 1000);
}

function devReplay(): void {
  for (const r of rounds) {
    r.attempts = [];
    r.lines = [];
    r.optimal = null;
  }
  busy = false;
  finishEarlyBtn.disabled = false;
  resultEl.hidden = true;
  pipsEl.hidden = false;
  viewToggleEl.hidden = true;
  window.clearInterval(countdownTimer);
  startRound(0);
}

function buildRounds(modeIds: string[]): void {
  rounds = modeIds.map((id) => ({
    mode: modeFromId(id),
    attempts: [],
    lines: [],
    optimal: null,
  }));
}

async function showCompleted(): Promise<void> {
  const rec = findRecord(store, puzzle)!;
  rounds = rec.rounds.map((rr) => ({
    mode: modeFromId(rr.mode),
    attempts: rr.attempts.map((x) => ({ ...x })),
    lines: rr.bestLine ? [rr.bestLine] : [],
    optimal: null,
  }));
  ri = rounds.length - 1;

  phase = "done";
  confirmBtn.hidden = true;
  finishEarlyBtn.hidden = true;
  pipsEl.hidden = true;
  roundEl.hidden = true;
  viewRound = rounds.length > 1 ? null : 0;

  for (let i = 0; i < rounds.length; i++) {
    for (let k = 0; k < rounds[i]!.attempts.length; k++) {
      logAttempt(k + 1, attemptFeedback(rounds[i]!.attempts[k]!.fractionA));
    }
  }

  for (const r of rounds) await ensureOptimal(r);
  instructionEl.hidden = true;
  setupViewToggle();
  render();
  showFinal();
  renderStreak();
}

async function init(): Promise<void> {
  setupCanvas();
  try {
    const manifest = await loadManifest();
    if (manifest.countries.length === 0) throw new Error(t.ui.noCountries);

    const ids = manifest.countries.map((c) => c.id);
    const today = DATE_OVERRIDE ?? isoDate();
    const daily = dailyChallenge(ids, ["area"], today);
    const chosen =
      DEV && FORCE_COUNTRY && ids.includes(FORCE_COUNTRY)
        ? FORCE_COUNTRY
        : daily.countryId;
    const meta =
      manifest.countries.find((c) => c.id === chosen) ?? manifest.countries[0]!;

    countryId = meta.id;
    countryName =
      lang === "pt"
        ? meta.name
        : meta[`name_${lang}` as "name_en" | "name_es" | "name_fr" | "name_de"] ??
          meta.name;
    countryCard = {
      flag: flagEmoji(meta.iso_a2),
      name: countryName,
      areaKm2: meta.area_km2,
      popEst: meta.pop_est ?? 0,
      difficulty: meta.difficulty,
    };
    puzzle = puzzleNumber(today);

    feature = await loadCountry(meta);
    projection = fitProjection(feature, CSS_W, CSS_H);
    promptEl.textContent = `${countryName} · ${daily.date} · #${puzzle}`;

    const [pop, riv] = await Promise.all([
      meta.modes.includes("population")
        ? loadPopulation(meta.id).catch(() => null)
        : null,
      meta.modes.includes("rivers")
        ? loadRivers(meta.id).catch(() => null)
        : null,
    ]);
    field = pop;
    riverField = riv;

    // drop any round whose data failed to load
    const modeIds = meta.modes.filter(
      (m) =>
        m === "area" ||
        (m === "population" && field) ||
        (m === "rivers" && riverField),
    );
    buildRounds(modeIds);

    attachLineDrag(
      canvas,
      endpoints,
      () => {
        if (phase === "playing") render();
      },
      // locked once the round is over or its attempts are spent; a revealed
      // attempt with tries left is still grabbable (see onGrab below)
      () => {
        if (phase === "playing") return false;
        if (phase === "revealed") return cur().attempts.length >= MAX_ATTEMPTS;
        return true;
      },
      { width: CSS_W, height: CSS_H },
      // grabbing an endpoint after a reveal starts the next attempt straight away
      () => {
        if (phase === "revealed" && cur().attempts.length < MAX_ATTEMPTS) {
          startAttempt();
        }
      },
    );
    confirmBtn.addEventListener("click", onConfirm);
    finishEarlyBtn.addEventListener("click", () => void leaveRound());

    if (findRecord(store, puzzle)?.completed && !DEV) {
      await showCompleted();
    } else {
      startRound(0);
    }
    renderStreak();
  } catch (err) {
    promptEl.textContent = t.ui.loadError((err as Error).message);
  }
}

void init();
