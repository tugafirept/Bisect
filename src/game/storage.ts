// Per-browser daily history in localStorage. The pure reducer `recordCompletion`
// is unit-tested; load/save just wrap it with try/catch so the game still runs
// in private mode or when storage is full.

import type { Position } from "./geo";

const KEY = "bisect/v1";
const RECORD_CAP = 60;

export interface AttemptScore {
  fractionA: number;
  points: number;
}

export interface RoundRecord {
  mode: string; // "area" | "population"
  attempts: AttemptScore[];
  best: number;
  /** lng/lat of the best attempt's line, for redrawing on revisit */
  bestLine: [Position, Position] | null;
}

export interface DailyRecord {
  puzzle: number;
  countryId: string;
  rounds: RoundRecord[];
  total: number; // sum of round bests
  maxTotal: number; // 100 * rounds.length
  completed: boolean;
}

export interface Store {
  lastCompletedPuzzle: number;
  streak: number;
  maxStreak: number;
  plays: number;
  /** sum of (total / maxTotal * 100), for a normalised average */
  sumPct: number;
  records: DailyRecord[];
}

export function emptyStore(): Store {
  return {
    lastCompletedPuzzle: 0,
    streak: 0,
    maxStreak: 0,
    plays: 0,
    sumPct: 0,
    records: [],
  };
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { ...emptyStore(), ...parsed, records: parsed.records ?? [] };
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode / quota exceeded — history just won't persist */
  }
}

export function findRecord(store: Store, puzzle: number): DailyRecord | undefined {
  return store.records.find((r) => r.puzzle === puzzle);
}

export interface CompletionRound {
  mode: string;
  attempts: AttemptScore[];
  bestLine: [Position, Position] | null;
}

export interface CompletionInput {
  puzzle: number;
  countryId: string;
  rounds: CompletionRound[];
}

/** Pure. New store with this puzzle recorded and the streak updated. Idempotent. */
export function recordCompletion(store: Store, input: CompletionInput): Store {
  if (findRecord(store, input.puzzle)?.completed) return store;

  const rounds: RoundRecord[] = input.rounds.map((r) => ({
    mode: r.mode,
    attempts: r.attempts,
    best: r.attempts.reduce((m, a) => Math.max(m, a.points), 0),
    bestLine: r.bestLine,
  }));
  const total = rounds.reduce((s, r) => s + r.best, 0);
  const maxTotal = 100 * rounds.length;
  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

  const consecutive = store.lastCompletedPuzzle === input.puzzle - 1;
  const streak = consecutive ? store.streak + 1 : 1;

  const record: DailyRecord = {
    puzzle: input.puzzle,
    countryId: input.countryId,
    rounds,
    total,
    maxTotal,
    completed: true,
  };

  return {
    lastCompletedPuzzle: input.puzzle,
    streak,
    maxStreak: Math.max(store.maxStreak, streak),
    plays: store.plays + 1,
    sumPct: store.sumPct + pct,
    records: [
      record,
      ...store.records.filter((r) => r.puzzle !== input.puzzle),
    ].slice(0, RECORD_CAP),
  };
}
