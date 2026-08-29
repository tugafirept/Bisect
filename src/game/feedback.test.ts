import { describe, expect, it } from "vitest";
import { attemptFeedback } from "./feedback";

describe("attemptFeedback", () => {
  it("flags a perfect split", () => {
    const fb = attemptFeedback(0.5);
    expect(fb.kind).toBe("perfect");
    expect(fb.points).toBe(100);
  });

  it("points at side A (blue) when it is over", () => {
    const fb = attemptFeedback(0.6);
    expect(fb.kind).toBe("push");
    expect(fb.biggerSide).toBe("A");
    expect(fb.percentA).toBe(60);
    expect(fb.deviationPP).toBeCloseTo(10);
  });

  it("points at side B (orange) when it is over", () => {
    const fb = attemptFeedback(0.42);
    expect(fb.biggerSide).toBe("B");
    expect(fb.percentA).toBe(42);
  });

  it("uses the 'close' kind when very near", () => {
    const fb = attemptFeedback(0.505);
    expect(fb.kind).toBe("close");
    expect(fb.deviationPP).toBeCloseTo(0.5);
  });
});
