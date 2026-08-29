// Between-attempt coaching, as structured data — the UI turns it into a
// localised sentence (see main.ts).

import { deviationPercent, score } from "./scoring";

export type FeedbackKind = "perfect" | "close" | "push";

export interface AttemptFeedback {
  fractionA: number;
  points: number;
  /** rounded percentage on side A */
  percentA: number;
  /** distance from a perfect halving, in percentage points */
  deviationPP: number;
  kind: FeedbackKind;
  /** which half is bigger: "A" = blue (side A), "B" = orange (side B) */
  biggerSide: "A" | "B";
}

export function attemptFeedback(fractionA: number): AttemptFeedback {
  const points = score(fractionA);
  const deviationPP = deviationPercent(fractionA);
  const kind: FeedbackKind =
    points >= 99.95 ? "perfect" : deviationPP < 1 ? "close" : "push";

  return {
    fractionA,
    points,
    percentA: Math.round(fractionA * 100),
    deviationPP,
    kind,
    biggerSide: fractionA > 0.5 ? "A" : "B",
  };
}
