import { describe, expect, it } from "vitest";
import { buildShareText, puzzleNumber, splitBar } from "./share";

describe("puzzleNumber", () => {
  it("counts days from the 2026-01-01 epoch", () => {
    expect(puzzleNumber("2026-01-01")).toBe(1);
    expect(puzzleNumber("2026-01-02")).toBe(2);
    expect(puzzleNumber("2026-08-29")).toBe(241);
  });
});

describe("splitBar", () => {
  it("has exactly `cells` squares", () => {
    expect(Array.from(splitBar(0.37, 20))).toHaveLength(20);
    expect(Array.from(splitBar(0.5, 12))).toHaveLength(12);
  });

  it("is half-and-half at a perfect split", () => {
    const cells = Array.from(splitBar(0.5, 20));
    expect(cells.filter((c) => c === "\u{1F7E6}")).toHaveLength(10);
    expect(cells.filter((c) => c === "\u{1F7E7}")).toHaveLength(10);
  });

  it("is one colour at the extremes", () => {
    expect(new Set(Array.from(splitBar(0, 10)))).toEqual(new Set(["\u{1F7E7}"]));
    expect(new Set(Array.from(splitBar(1, 10)))).toEqual(new Set(["\u{1F7E6}"]));
  });
});

const barLines = (text: string): string[] =>
  text.split("\n").filter((l) => l.includes("\u{1F7E6}") || l.includes("\u{1F7E7}"));

describe("buildShareText", () => {
  const twoRounds = {
    puzzleNumber: 241,
    countryName: "El Salvador",
    rounds: [
      {
        label: "Área",
        attempts: [
          { fractionA: 0.58, points: 71 },
          { fractionA: 0.53, points: 88 },
          { fractionA: 0.502, points: 98 },
        ],
      },
      {
        label: "Rios",
        attempts: [
          { fractionA: 0.7, points: 40 },
          { fractionA: 0.55, points: 82 },
        ],
      },
    ],
  };

  it("headers with the puzzle number and total/max", () => {
    const text = buildShareText(twoRounds);
    expect(text).toContain("#241");
    expect(text).toContain("180/200");
    expect(text).toContain("El Salvador");
  });

  it("prints round labels and one bar per attempt", () => {
    const lines = buildShareText(twoRounds).split("\n");
    expect(lines).toContain("Área");
    expect(lines).toContain("Rios");
    const bars = barLines(buildShareText(twoRounds));
    expect(bars).toHaveLength(5);
    expect(bars[4]!.trim().endsWith("82")).toBe(true);
  });

  it("adds streak and url only when given", () => {
    expect(buildShareText(twoRounds)).not.toContain("http");
    expect(buildShareText(twoRounds)).not.toContain("\u{1F525}");
    const full = buildShareText({ ...twoRounds, streak: 5, url: "https://x.y/" });
    expect(full).toContain("\u{1F525}");
    expect(full).toContain("https://x.y/");
  });

  it("omits round labels for a single-round day", () => {
    const text = buildShareText({
      puzzleNumber: 1,
      countryName: "Botsuana",
      rounds: [{ label: "Área", attempts: [{ fractionA: 0.5, points: 100 }] }],
    });
    expect(text).toContain("#1");
    expect(text).toContain("100/100");
    expect(text.split("\n")).not.toContain("Área");
  });
});
