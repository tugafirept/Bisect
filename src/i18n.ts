// UI strings for the languages the game supports. Language is chosen once
// (stored in localStorage) and applied on load; changing it reloads the page.

export type LangCode = "pt" | "en" | "es" | "fr" | "de";

export const LANGS: ReadonlyArray<{ code: LangCode; label: string }> = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
];

export interface Strings {
  /** brand name — the same in every language */
  appName: string;
  /** localised one-liner shown under the name */
  tagline: string;
  help: { title: string; intro: string; bullets: string[]; start: string };
  ui: {
    helpLabel: string;
    languageLabel: string;
    loadError: (msg: string) => string;
    noCountries: string;
  };
  modes: { area: string; rivers: string; population: string };
  round: {
    counter: (i: number, total: number) => string;
    introArea: (counter: string) => string;
    introRivers: (counter: string) => string;
    introPopulation: (counter: string) => string;
  };
  play: {
    attempt: (n: number, max: number) => string;
    logHead: (n: number, headline: string, pts: string) => string;
    roundDone: (best: string) => string;
    afterAttempt: (headline: string, pts: string, hint: string) => string;
  };
  buttons: {
    confirm: string;
    nextAttempt: string;
    nextRound: string;
    seeResult: string;
    finishNow: string;
    skipRound: string;
    calculating: string;
  };
  streak: (streak: number, max: number, plays: number) => string;
  view: { label: string; all: string };
  feedback: {
    sideBlue: string;
    sideOrange: string;
    perfect: string;
    close: (side: string, pp: string) => string;
    push: (side: string, pp: string) => string;
  };
  result: {
    difficulty: (level: number) => string;
    popLabel: string;
    totalSuffix: (max: number) => string;
    bestOf: (n: number, multi: boolean) => string;
    perfectPrefix: string;
    roundTitle: (label: string, pts: string) => string;
    bestLine: (a: string, b: string) => string;
    statDays: (n: number) => string;
    statMax: (n: number) => string;
    statGames: (n: number) => string;
    statAvg: (v: string) => string;
    countdownPrefix: string;
    share: string;
    replay: string;
    shared: string;
    copied: string;
    copyFailed: string;
  };
  share: {
    header: (puzzle: number, best: string, max: number, tag: string) => string;
    attemptTag: (i: number, n: number) => string;
    streakLine: (n: number) => string;
  };
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

const pt: Strings = {
  appName: "Bisect",
  tagline: "Divide o país ao meio",
  help: {
    title: "Como jogar",
    intro:
      "Todos os dias, um país. Traça a reta que o divida o mais perto possível de 50/50 — arrasta as duas pontas da linha.",
    bullets: [
      "3 rondas no mesmo país: por área, por rios e por população. Cada uma pede uma linha diferente.",
      "Às cegas: vês a forma e as metades a cores, mas as percentagens só aparecem quando confirmas.",
      "3 tentativas por ronda, com uma dica de que lado corrigir entre elas. Conta a melhor.",
      "Pontuação = melhor de cada ronda, somada. Volta amanhã para um país novo.",
    ],
    start: "Começar",
  },
  ui: {
    helpLabel: "Como jogar",
    languageLabel: "Idioma",
    loadError: (m) => `Erro ao carregar: ${m}`,
    noCountries: "manifesto sem países",
  },
  modes: { area: "Área", rivers: "Rios", population: "População" },
  round: {
    counter: (i, total) => `Ronda ${i}/${total}`,
    introArea: (c) => `${c} · Área — divide a área a 50/50.`,
    introRivers: (c) => `${c} · Rios — divide o comprimento total dos rios a 50/50.`,
    introPopulation: (c) =>
      `${c} · População — divide os habitantes a 50/50, às cegas. Onde é que vive a maioria?`,
  },
  play: {
    attempt: (n, max) =>
      `Tentativa ${n} de ${max}. Arrasta a linha e confirma — as percentagens só aparecem depois.`,
    logHead: (n, h, p) => `Tentativa ${n} · ${h} · ${p} pts`,
    roundDone: (best) => `Ronda terminada. Melhor: ${best} pts.`,
    afterAttempt: (h, p, hint) => `${h} · ${p} pts — ${hint}`,
  },
  buttons: {
    confirm: "Confirmar palpite",
    nextAttempt: "Tentativa seguinte",
    nextRound: "Ronda seguinte",
    seeResult: "Ver resultado",
    finishNow: "Terminar agora",
    skipRound: "Passar à ronda seguinte",
    calculating: "A calcular a melhor linha…",
  },
  streak: (s, max, plays) =>
    `🔥 Sequência de ${s} ${plural(s, "dia", "dias")} · melhor ${max} · ${plays} ${plural(plays, "jogo", "jogos")}`,
  view: { label: "Ver no mapa:", all: "Todas" },
  feedback: {
    sideBlue: "azul",
    sideOrange: "laranja",
    perfect: "Perfeito — não dá para dividir melhor com uma reta.",
    close: (side, pp) =>
      `Quase. A metade ${side} está ${pp} pp acima — um ajuste minúsculo para o lado ${side}.`,
    push: (side, pp) =>
      `A metade ${side} ficou maior (${pp} pp). Desloca a linha para o lado ${side}.`,
  },
  result: {
    difficulty: (l) =>
      ["Muito fácil", "Fácil", "Média", "Difícil", "Muito difícil"][l - 1] ?? "",
    popLabel: "hab.",
    totalSuffix: (max) => `/ ${max} pts`,
    bestOf: (n, multi) => `Melhor de ${n} tentativas${multi ? " por ronda" : ""}.`,
    perfectPrefix: "Perfeito! ",
    roundTitle: (label, pts) => `${label} — <span>${pts} pts</span>`,
    bestLine: (a, b) => `Melhor linha reta possível: ${a} / ${b}.`,
    statDays: (n) => `${n} ${plural(n, "dia", "dias")}`,
    statMax: (n) => `máx ${n}`,
    statGames: (n) => `${n} ${plural(n, "jogo", "jogos")}`,
    statAvg: (v) => `média ${v}/100`,
    countdownPrefix: "Próximo país em",
    share: "Partilhar",
    replay: "Repetir (dev)",
    shared: "Partilhado!",
    copied: "Copiado para a área de transferência!",
    copyFailed: "Não deu para copiar — seleciona o texto e copia:",
  },
  share: {
    header: (puzzle, best, max, tag) =>
      `${pt.appName} #${puzzle} — ${best}/${max}${tag}`,
    attemptTag: (i, n) => ` (tentativa ${i}/${n})`,
    streakLine: (n) => `🔥 ${n} dias`,
  },
};

const en: Strings = {
  appName: "Bisect",
  tagline: "Split the country in half",
  help: {
    title: "How to play",
    intro:
      "One country every day. Draw the straight line that splits it as close to 50/50 as you can — drag the two ends.",
    bullets: [
      "3 rounds on the same country: by area, by rivers and by population. Each wants a different line.",
      "Blind: you see the shape and the coloured halves, but the percentages only appear when you confirm.",
      "3 tries per round, with a hint on which way to nudge between them. Your best one counts.",
      "Score = best of each round, added up. Come back tomorrow for a new country.",
    ],
    start: "Start",
  },
  ui: {
    helpLabel: "How to play",
    languageLabel: "Language",
    loadError: (m) => `Failed to load: ${m}`,
    noCountries: "manifest has no countries",
  },
  modes: { area: "Area", rivers: "Rivers", population: "Population" },
  round: {
    counter: (i, total) => `Round ${i}/${total}`,
    introArea: (c) => `${c} · Area — split the area 50/50.`,
    introRivers: (c) => `${c} · Rivers — split the total river length 50/50.`,
    introPopulation: (c) =>
      `${c} · Population — split the people 50/50, blind. Where does the majority live?`,
  },
  play: {
    attempt: (n, max) =>
      `Try ${n} of ${max}. Drag the line and confirm — percentages only show afterwards.`,
    logHead: (n, h, p) => `Try ${n} · ${h} · ${p} pts`,
    roundDone: (best) => `Round done. Best: ${best} pts.`,
    afterAttempt: (h, p, hint) => `${h} · ${p} pts — ${hint}`,
  },
  buttons: {
    confirm: "Confirm guess",
    nextAttempt: "Next try",
    nextRound: "Next round",
    seeResult: "See result",
    finishNow: "Finish now",
    skipRound: "Skip to next round",
    calculating: "Working out the best line…",
  },
  streak: (s, max, plays) =>
    `🔥 ${s}-${plural(s, "day", "day")} streak · best ${max} · ${plays} ${plural(plays, "game", "games")}`,
  view: { label: "Show on map:", all: "All" },
  feedback: {
    sideBlue: "blue",
    sideOrange: "orange",
    perfect: "Perfect — a straight line can't do better.",
    close: (side, pp) =>
      `Close. The ${side} half is ${pp} pp over — a tiny nudge toward ${side}.`,
    push: (side, pp) =>
      `The ${side} half came out bigger (${pp} pp). Move the line toward ${side}.`,
  },
  result: {
    difficulty: (l) =>
      ["Very easy", "Easy", "Medium", "Hard", "Very hard"][l - 1] ?? "",
    popLabel: "people",
    totalSuffix: (max) => `/ ${max} pts`,
    bestOf: (n, multi) => `Best of ${n} tries${multi ? " per round" : ""}.`,
    perfectPrefix: "Perfect! ",
    roundTitle: (label, pts) => `${label} — <span>${pts} pts</span>`,
    bestLine: (a, b) => `Best possible straight line: ${a} / ${b}.`,
    statDays: (n) => `${n} ${plural(n, "day", "days")}`,
    statMax: (n) => `max ${n}`,
    statGames: (n) => `${n} ${plural(n, "game", "games")}`,
    statAvg: (v) => `avg ${v}/100`,
    countdownPrefix: "Next country in",
    share: "Share",
    replay: "Replay (dev)",
    shared: "Shared!",
    copied: "Copied to clipboard!",
    copyFailed: "Couldn't copy — select the text and copy it:",
  },
  share: {
    header: (puzzle, best, max, tag) => `${en.appName} #${puzzle} — ${best}/${max}${tag}`,
    attemptTag: (i, n) => ` (try ${i}/${n})`,
    streakLine: (n) => `🔥 ${n} days`,
  },
};

const es: Strings = {
  appName: "Bisect",
  tagline: "Divide el país por la mitad",
  help: {
    title: "Cómo jugar",
    intro:
      "Un país cada día. Traza la recta que lo divida lo más cerca posible de 50/50 — arrastra los dos extremos.",
    bullets: [
      "3 rondas en el mismo país: por área, por ríos y por población. Cada una pide una línea distinta.",
      "A ciegas: ves la forma y las mitades en color, pero los porcentajes solo aparecen al confirmar.",
      "3 intentos por ronda, con una pista de hacia dónde corregir. Cuenta el mejor.",
      "Puntuación = el mejor de cada ronda, sumados. Vuelve mañana para un país nuevo.",
    ],
    start: "Empezar",
  },
  ui: {
    helpLabel: "Cómo jugar",
    languageLabel: "Idioma",
    loadError: (m) => `Error al cargar: ${m}`,
    noCountries: "el manifiesto no tiene países",
  },
  modes: { area: "Área", rivers: "Ríos", population: "Población" },
  round: {
    counter: (i, total) => `Ronda ${i}/${total}`,
    introArea: (c) => `${c} · Área — divide el área 50/50.`,
    introRivers: (c) => `${c} · Ríos — divide la longitud total de los ríos 50/50.`,
    introPopulation: (c) =>
      `${c} · Población — divide los habitantes 50/50, a ciegas. ¿Dónde vive la mayoría?`,
  },
  play: {
    attempt: (n, max) =>
      `Intento ${n} de ${max}. Arrastra la línea y confirma — los porcentajes aparecen después.`,
    logHead: (n, h, p) => `Intento ${n} · ${h} · ${p} pts`,
    roundDone: (best) => `Ronda terminada. Mejor: ${best} pts.`,
    afterAttempt: (h, p, hint) => `${h} · ${p} pts — ${hint}`,
  },
  buttons: {
    confirm: "Confirmar",
    nextAttempt: "Siguiente intento",
    nextRound: "Siguiente ronda",
    seeResult: "Ver resultado",
    finishNow: "Terminar ahora",
    skipRound: "Pasar a la siguiente ronda",
    calculating: "Calculando la mejor línea…",
  },
  streak: (s, max, plays) =>
    `🔥 Racha de ${s} ${plural(s, "día", "días")} · mejor ${max} · ${plays} ${plural(plays, "partida", "partidas")}`,
  view: { label: "Ver en el mapa:", all: "Todas" },
  feedback: {
    sideBlue: "azul",
    sideOrange: "naranja",
    perfect: "Perfecto — una recta no puede hacerlo mejor.",
    close: (side, pp) =>
      `Casi. La mitad ${side} está ${pp} pp por encima — un ajuste mínimo hacia ${side}.`,
    push: (side, pp) =>
      `La mitad ${side} salió mayor (${pp} pp). Mueve la línea hacia ${side}.`,
  },
  result: {
    difficulty: (l) =>
      ["Muy fácil", "Fácil", "Media", "Difícil", "Muy difícil"][l - 1] ?? "",
    popLabel: "hab.",
    totalSuffix: (max) => `/ ${max} pts`,
    bestOf: (n, multi) => `Mejor de ${n} intentos${multi ? " por ronda" : ""}.`,
    perfectPrefix: "¡Perfecto! ",
    roundTitle: (label, pts) => `${label} — <span>${pts} pts</span>`,
    bestLine: (a, b) => `Mejor recta posible: ${a} / ${b}.`,
    statDays: (n) => `${n} ${plural(n, "día", "días")}`,
    statMax: (n) => `máx ${n}`,
    statGames: (n) => `${n} ${plural(n, "partida", "partidas")}`,
    statAvg: (v) => `media ${v}/100`,
    countdownPrefix: "Próximo país en",
    share: "Compartir",
    replay: "Repetir (dev)",
    shared: "¡Compartido!",
    copied: "¡Copiado al portapapeles!",
    copyFailed: "No se pudo copiar — selecciona el texto y cópialo:",
  },
  share: {
    header: (puzzle, best, max, tag) => `${es.appName} #${puzzle} — ${best}/${max}${tag}`,
    attemptTag: (i, n) => ` (intento ${i}/${n})`,
    streakLine: (n) => `🔥 ${n} días`,
  },
};

const fr: Strings = {
  appName: "Bisect",
  tagline: "Partage le pays en deux",
  help: {
    title: "Comment jouer",
    intro:
      "Un pays chaque jour. Trace la droite qui le partage au plus près de 50/50 — fais glisser les deux extrémités.",
    bullets: [
      "3 manches sur le même pays : par superficie, par rivières et par population. Chacune veut une ligne différente.",
      "À l'aveugle : tu vois la forme et les deux moitiés en couleur, mais les pourcentages n'apparaissent qu'à la validation.",
      "3 essais par manche, avec un indice sur le côté à corriger. Le meilleur compte.",
      "Score = le meilleur de chaque manche, additionnés. Reviens demain pour un nouveau pays.",
    ],
    start: "Commencer",
  },
  ui: {
    helpLabel: "Comment jouer",
    languageLabel: "Langue",
    loadError: (m) => `Échec du chargement : ${m}`,
    noCountries: "le manifeste ne contient aucun pays",
  },
  modes: { area: "Superficie", rivers: "Rivières", population: "Population" },
  round: {
    counter: (i, total) => `Manche ${i}/${total}`,
    introArea: (c) => `${c} · Superficie — partage la superficie 50/50.`,
    introRivers: (c) => `${c} · Rivières — partage la longueur totale des rivières 50/50.`,
    introPopulation: (c) =>
      `${c} · Population — partage les habitants 50/50, à l'aveugle. Où vit la majorité ?`,
  },
  play: {
    attempt: (n, max) =>
      `Essai ${n} sur ${max}. Fais glisser la ligne et valide — les pourcentages viennent après.`,
    logHead: (n, h, p) => `Essai ${n} · ${h} · ${p} pts`,
    roundDone: (best) => `Manche terminée. Meilleur : ${best} pts.`,
    afterAttempt: (h, p, hint) => `${h} · ${p} pts — ${hint}`,
  },
  buttons: {
    confirm: "Valider",
    nextAttempt: "Essai suivant",
    nextRound: "Manche suivante",
    seeResult: "Voir le résultat",
    finishNow: "Terminer",
    skipRound: "Passer à la manche suivante",
    calculating: "Calcul de la meilleure ligne…",
  },
  streak: (s, max, plays) =>
    `🔥 Série de ${s} ${plural(s, "jour", "jours")} · record ${max} · ${plays} ${plural(plays, "partie", "parties")}`,
  view: { label: "Sur la carte :", all: "Toutes" },
  feedback: {
    sideBlue: "bleue",
    sideOrange: "orange",
    perfect: "Parfait — une droite ne peut pas faire mieux.",
    close: (side, pp) =>
      `Presque. La moitié ${side} dépasse de ${pp} pp — un tout petit ajustement vers ${side}.`,
    push: (side, pp) =>
      `La moitié ${side} est plus grande (${pp} pp). Déplace la ligne vers ${side}.`,
  },
  result: {
    difficulty: (l) =>
      ["Très facile", "Facile", "Moyen", "Difficile", "Très difficile"][l - 1] ?? "",
    popLabel: "hab.",
    totalSuffix: (max) => `/ ${max} pts`,
    bestOf: (n, multi) => `Meilleur de ${n} essais${multi ? " par manche" : ""}.`,
    perfectPrefix: "Parfait ! ",
    roundTitle: (label, pts) => `${label} — <span>${pts} pts</span>`,
    bestLine: (a, b) => `Meilleure droite possible : ${a} / ${b}.`,
    statDays: (n) => `${n} ${plural(n, "jour", "jours")}`,
    statMax: (n) => `record ${n}`,
    statGames: (n) => `${n} ${plural(n, "partie", "parties")}`,
    statAvg: (v) => `moy. ${v}/100`,
    countdownPrefix: "Prochain pays dans",
    share: "Partager",
    replay: "Rejouer (dev)",
    shared: "Partagé !",
    copied: "Copié dans le presse-papiers !",
    copyFailed: "Impossible de copier — sélectionne le texte et copie-le :",
  },
  share: {
    header: (puzzle, best, max, tag) => `${fr.appName} #${puzzle} — ${best}/${max}${tag}`,
    attemptTag: (i, n) => ` (essai ${i}/${n})`,
    streakLine: (n) => `🔥 ${n} jours`,
  },
};

const de: Strings = {
  appName: "Bisect",
  tagline: "Teile das Land in zwei Hälften",
  help: {
    title: "So wird gespielt",
    intro:
      "Jeden Tag ein Land. Zieh die Gerade, die es möglichst genau 50/50 teilt — zieh an den beiden Enden.",
    bullets: [
      "3 Runden im selben Land: nach Fläche, nach Flüssen und nach Bevölkerung. Jede will eine andere Linie.",
      "Blind: Du siehst die Form und die farbigen Hälften, aber die Prozente erst nach dem Bestätigen.",
      "3 Versuche pro Runde, mit einem Hinweis, in welche Richtung. Der beste zählt.",
      "Punkte = der beste jeder Runde, addiert. Komm morgen für ein neues Land wieder.",
    ],
    start: "Los",
  },
  ui: {
    helpLabel: "So wird gespielt",
    languageLabel: "Sprache",
    loadError: (m) => `Laden fehlgeschlagen: ${m}`,
    noCountries: "Manifest enthält keine Länder",
  },
  modes: { area: "Fläche", rivers: "Flüsse", population: "Bevölkerung" },
  round: {
    counter: (i, total) => `Runde ${i}/${total}`,
    introArea: (c) => `${c} · Fläche — teile die Fläche 50/50.`,
    introRivers: (c) => `${c} · Flüsse — teile die gesamte Flusslänge 50/50.`,
    introPopulation: (c) =>
      `${c} · Bevölkerung — teile die Einwohner 50/50, blind. Wo lebt die Mehrheit?`,
  },
  play: {
    attempt: (n, max) =>
      `Versuch ${n} von ${max}. Zieh die Linie und bestätige — Prozente kommen danach.`,
    logHead: (n, h, p) => `Versuch ${n} · ${h} · ${p} Pkt`,
    roundDone: (best) => `Runde fertig. Bester: ${best} Pkt.`,
    afterAttempt: (h, p, hint) => `${h} · ${p} Pkt — ${hint}`,
  },
  buttons: {
    confirm: "Bestätigen",
    nextAttempt: "Nächster Versuch",
    nextRound: "Nächste Runde",
    seeResult: "Ergebnis ansehen",
    finishNow: "Jetzt beenden",
    skipRound: "Zur nächsten Runde",
    calculating: "Beste Linie wird berechnet…",
  },
  streak: (s, max, plays) =>
    `🔥 ${s}-${plural(s, "Tage", "Tage")}-Serie · Rekord ${max} · ${plays} ${plural(plays, "Spiel", "Spiele")}`,
  view: { label: "Auf der Karte:", all: "Alle" },
  feedback: {
    sideBlue: "blaue",
    sideOrange: "orange",
    perfect: "Perfekt — eine Gerade schafft es nicht besser.",
    close: (side, pp) =>
      `Fast. Die ${side} Hälfte liegt ${pp} pp darüber — eine winzige Korrektur Richtung ${side}.`,
    push: (side, pp) =>
      `Die ${side} Hälfte wurde größer (${pp} pp). Verschieb die Linie Richtung ${side}.`,
  },
  result: {
    difficulty: (l) =>
      ["Sehr leicht", "Leicht", "Mittel", "Schwer", "Sehr schwer"][l - 1] ?? "",
    popLabel: "Einw.",
    totalSuffix: (max) => `/ ${max} Pkt`,
    bestOf: (n, multi) => `Bester von ${n} Versuchen${multi ? " pro Runde" : ""}.`,
    perfectPrefix: "Perfekt! ",
    roundTitle: (label, pts) => `${label} — <span>${pts} Pkt</span>`,
    bestLine: (a, b) => `Beste mögliche Gerade: ${a} / ${b}.`,
    statDays: (n) => `${n} ${plural(n, "Tag", "Tage")}`,
    statMax: (n) => `max ${n}`,
    statGames: (n) => `${n} ${plural(n, "Spiel", "Spiele")}`,
    statAvg: (v) => `Ø ${v}/100`,
    countdownPrefix: "Nächstes Land in",
    share: "Teilen",
    replay: "Nochmal (dev)",
    shared: "Geteilt!",
    copied: "In die Zwischenablage kopiert!",
    copyFailed: "Kopieren ging nicht — markiere den Text und kopiere ihn:",
  },
  share: {
    header: (puzzle, best, max, tag) => `${de.appName} #${puzzle} — ${best}/${max}${tag}`,
    attemptTag: (i, n) => ` (Versuch ${i}/${n})`,
    streakLine: (n) => `🔥 ${n} Tage`,
  },
};

const TABLES: Record<LangCode, Strings> = { pt, en, es, fr, de };
const LOCALE: Record<LangCode, string> = {
  pt: "pt-PT",
  en: "en",
  es: "es",
  fr: "fr",
  de: "de",
};

const LANG_KEY = "bisect/lang";

function detectLang(): LangCode {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && saved in TABLES) return saved as LangCode;
  } catch {
    /* no storage */
  }
  const nav =
    typeof navigator !== "undefined" && navigator.language
      ? navigator.language.slice(0, 2).toLowerCase()
      : "pt";
  return (nav in TABLES ? nav : "pt") as LangCode;
}

export const lang: LangCode = detectLang();
export const t: Strings = TABLES[lang];

export function setLang(code: LangCode): void {
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch {
    /* no storage */
  }
}

const nf = (digits: number): Intl.NumberFormat =>
  new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const n0 = (x: number): string => nf(0).format(x);
export const n1 = (x: number): string => nf(1).format(x);
export const n2 = (x: number): string => nf(2).format(x);

const compact = new Intl.NumberFormat(LOCALE[lang], {
  notation: "compact",
  maximumFractionDigits: 1,
});
export const nCompact = (x: number): string => compact.format(x);
