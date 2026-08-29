import { shareOrCopy } from "./clipboard";
import { n0, n1, nCompact, t } from "../i18n";

export interface ResultAttempt {
  fractionA: number;
  points: number;
}

export interface ResultRound {
  label: string;
  attempts: ResultAttempt[];
  /** the optimal straight line's share on side A, in [0, 1] */
  bestFractionA: number;
}

export interface ResultCountry {
  flag: string;
  name: string;
  areaKm2: number;
  popEst: number;
  difficulty: number;
}

export interface ResultView {
  country: ResultCountry;
  rounds: ResultRound[];
  total: number;
  maxTotal: number;
  shareText: string;
  streak: number;
  maxStreak: number;
  plays: number;
  avgPct: number;
  countdownText: string;
  devReplay?: () => void;
}

export interface ResultHandle {
  setCountdown(text: string): void;
}

function attemptBar(fractionA: number, points: number, isBest: boolean): string {
  const a = fractionA * 100;
  return `
    <div class="attempt-row${isBest ? " best" : ""}">
      <div class="split-bar" role="img" aria-label="${n1(a)} / ${n1(100 - a)}">
        <div class="split-fill" style="width:${a}%"></div>
        <div class="split-centre"></div>
        <div class="split-cut" style="left:${a}%"></div>
      </div>
      <span class="attempt-score">${Math.round(points)}</span>
    </div>`;
}

function roundBlock(round: ResultRound, showLabel: boolean): string {
  const best = round.attempts.reduce((m, x) => Math.max(m, x.points), 0);
  const bestIndex = round.attempts.findIndex((x) => x.points === best);
  const bestA = round.bestFractionA * 100;
  return `
    ${showLabel ? `<h3 class="round-title">${t.result.roundTitle(round.label, n1(best))}</h3>` : ""}
    <div class="attempt-bars">
      ${round.attempts.map((x, i) => attemptBar(x.fractionA, x.points, i === bestIndex)).join("")}
    </div>
    <p class="result-best">${t.result.bestLine(n1(bestA), n1(100 - bestA))}</p>`;
}

function countryCard(c: ResultCountry): string {
  const meta = [`${n0(c.areaKm2)} km²`];
  if (c.popEst > 0) meta.push(`${nCompact(c.popEst)} ${t.result.popLabel}`);
  if (c.difficulty >= 1) meta.push(t.result.difficulty(c.difficulty));
  return `
    <div class="country-card">
      ${c.flag ? `<span class="flag" aria-hidden="true">${c.flag}</span>` : ""}
      <div class="country-info">
        <div class="country-name">${c.name}</div>
        <div class="country-meta">${meta.join(" · ")}</div>
      </div>
    </div>`;
}

export function renderResult(host: HTMLElement, view: ResultView): ResultHandle {
  const multiRound = view.rounds.length > 1;
  const perfect = view.total >= view.maxTotal - 0.05;

  host.innerHTML = `
    ${countryCard(view.country)}
    <div class="score-big">${Math.round(view.total)} <span>${t.result.totalSuffix(view.maxTotal)}</span></div>
    <p class="result-sub">
      ${perfect ? t.result.perfectPrefix : ""}${t.result.bestOf(view.rounds[0]!.attempts.length, multiRound)}
    </p>

    ${view.rounds.map((r) => roundBlock(r, multiRound)).join("")}

    <div class="stats-row">
      <span>🔥 ${t.result.statDays(view.streak)}</span>
      <span>${t.result.statMax(view.maxStreak)}</span>
      <span>${t.result.statGames(view.plays)}</span>
      <span>${t.result.statAvg(n1(view.avgPct))}</span>
    </div>

    <p class="countdown">${t.result.countdownPrefix} <strong class="countdown-clock">${view.countdownText}</strong></p>

    <div class="result-actions">
      <button class="btn-primary" type="button" data-act="share">${t.result.share}</button>
      ${view.devReplay ? `<button class="btn-ghost" type="button" data-act="replay">${t.result.replay}</button>` : ""}
    </div>
    <p class="share-feedback" role="status" hidden></p>
    <pre class="share-preview" hidden></pre>
  `;
  host.hidden = false;

  const feedback = host.querySelector<HTMLParagraphElement>(".share-feedback")!;
  const preview = host.querySelector<HTMLPreElement>(".share-preview")!;
  const clock = host.querySelector<HTMLElement>(".countdown-clock")!;

  host.querySelector<HTMLButtonElement>('[data-act="share"]')!.addEventListener(
    "click",
    async () => {
      const outcome = await shareOrCopy(view.shareText);
      if (outcome === "cancelled") return;
      if (outcome === "failed") {
        feedback.textContent = t.result.copyFailed;
        feedback.hidden = false;
        preview.textContent = view.shareText;
        preview.hidden = false;
        return;
      }
      feedback.textContent = outcome === "shared" ? t.result.shared : t.result.copied;
      feedback.hidden = false;
    },
  );

  const replayBtn = host.querySelector<HTMLButtonElement>('[data-act="replay"]');
  if (replayBtn && view.devReplay) replayBtn.addEventListener("click", view.devReplay);

  host.scrollIntoView({ behavior: "smooth", block: "nearest" });

  return {
    setCountdown(text: string) {
      clock.textContent = text;
    },
  };
}
