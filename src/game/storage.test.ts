import { describe, expect, it } from "vitest";
import {
  emptyStore,
  findRecord,
  recordCompletion,
  type Store,
} from "./storage";

const attempt = (points: number) => ({ fractionA: 0.5, points });

const areaRound = (points: number) => ({
  mode: "area",
  attempts: [attempt(points)],
  bestLine: null,
});

const complete = (store: Store, puzzle: number, points = 90) =>
  recordCompletion(store, {
    puzzle,
    countryId: "PRT",
    rounds: [areaRound(points)],
  });

describe("recordCompletion", () => {
  it("starts a streak at 1 on the first play", () => {
    const s = complete(emptyStore(), 241);
    expect(s.streak).toBe(1);
    expect(s.maxStreak).toBe(1);
    expect(s.plays).toBe(1);
    expect(findRecord(s, 241)?.completed).toBe(true);
  });

  it("increments the streak on consecutive puzzles", () => {
    let s = complete(emptyStore(), 241);
    s = complete(s, 242);
    s = complete(s, 243);
    expect(s.streak).toBe(3);
    expect(s.maxStreak).toBe(3);
  });

  it("resets the streak after a missed day but keeps the max", () => {
    let s = complete(emptyStore(), 241);
    s = complete(s, 242);
    s = complete(s, 245);
    expect(s.streak).toBe(1);
    expect(s.maxStreak).toBe(2);
  });

  it("is idempotent for an already-completed puzzle", () => {
    const first = complete(emptyStore(), 241, 90);
    const again = complete(first, 241, 10);
    expect(again).toBe(first);
    expect(again.plays).toBe(1);
  });

  it("sums round bests into total and tracks a normalised percentage", () => {
    const s = recordCompletion(emptyStore(), {
      puzzle: 1,
      countryId: "SLV",
      rounds: [
        { mode: "area", attempts: [attempt(40), attempt(96), attempt(88)], bestLine: null },
        { mode: "population", attempts: [attempt(70), attempt(80)], bestLine: null },
      ],
    });
    const rec = findRecord(s, 1)!;
    expect(rec.rounds[0]!.best).toBe(96);
    expect(rec.rounds[1]!.best).toBe(80);
    expect(rec.total).toBe(176);
    expect(rec.maxTotal).toBe(200);
    expect(s.sumPct).toBe(88);
  });
});
