// Builders for the Wordle-style shareable result. The emoji bar is pure; the
// wording comes from the active language (src/i18n).

import { t } from "../i18n";

export interface ShareAttempt {
  /** area/metric share on side A, in [0, 1] */
  fractionA: number;
  points: number;
}

export interface ShareRound {
  label: string; // "Área" | "População"
  attempts: ShareAttempt[];
}

export interface ShareInput {
  puzzleNumber: number;
  countryName: string;
  rounds: ShareRound[];
  streak?: number;
  url?: string;
}

/** Puzzle #1 is 2026-01-01. */
const EPOCH_UTC = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

export function puzzleNumber(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Math.floor((t - EPOCH_UTC) / DAY_MS) + 1;
}

/** A fixed-width bar of coloured squares showing where the country was cut. */
export function splitBar(fractionA: number, cells = 20): string {
  const clamped = Math.min(Math.max(fractionA, 0), 1);
  const cut = Math.round(clamped * cells);
  let bar = "";
  for (let i = 0; i < cells; i++) bar += i < cut ? "\u{1F7E6}" : "\u{1F7E7}";
  return bar;
}

const roundBest = (r: ShareRound): number =>
  r.attempts.reduce((m, a) => Math.max(m, a.points), 0);

export function buildShareText(input: ShareInput): string {
  const total = input.rounds.reduce((s, r) => s + roundBest(r), 0);
  const maxTotal = 100 * input.rounds.length;
  const multiRound = input.rounds.length > 1;

  const lines = [
    t.share.header(input.puzzleNumber, String(Math.round(total)), maxTotal, ""),
    input.countryName,
  ];

  for (const round of input.rounds) {
    if (multiRound) lines.push(round.label);
    for (const a of round.attempts) {
      lines.push(`${splitBar(a.fractionA)} ${String(Math.round(a.points)).padStart(3)}`);
    }
  }

  if (input.streak && input.streak > 1) lines.push(t.share.streakLine(input.streak));
  if (input.url) lines.push(input.url);
  return lines.join("\n");
}
