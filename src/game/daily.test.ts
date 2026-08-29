import { describe, expect, it } from "vitest";
import {
  dailyChallenge,
  formatCountdown,
  msUntilNextPuzzle,
} from "./daily";

describe("dailyChallenge", () => {
  it("is deterministic for a given date and country list", () => {
    const ids = ["PRT", "ESP", "FRA", "DEU", "ITA"];
    const a = dailyChallenge(ids, ["area"], "2026-08-29");
    const b = dailyChallenge(ids, ["area"], "2026-08-29");
    expect(a).toEqual(b);
    expect(ids).toContain(a.countryId);
  });

  it("picks a different country on a different date (usually)", () => {
    const ids = Array.from({ length: 173 }, (_, i) => `C${i}`);
    const days = new Set(
      ["2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01"].map(
        (d) => dailyChallenge(ids, ["area"], d).countryId,
      ),
    );
    expect(days.size).toBeGreaterThan(1);
  });
});

describe("countdown", () => {
  it("counts down to the next 00:00 UTC", () => {
    const at = new Date("2026-08-29T23:00:00Z");
    expect(msUntilNextPuzzle(at)).toBe(60 * 60 * 1000);
  });

  it("formats as HH:MM:SS", () => {
    expect(formatCountdown(60 * 60 * 1000)).toBe("01:00:00");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(5_025_000)).toBe("01:23:45");
  });
});
