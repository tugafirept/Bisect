// Turns a split into points. Shared by every mode.

/** How far the split is from a perfect halving, in percentage points (0..50). */
export function deviationPercent(fractionA: number): number {
  return Math.abs(fractionA - 0.5) * 100;
}

/**
 * 0..100 points. 100 = perfect 50/50, 0 = the line missed the country entirely.
 * Squared falloff so near-perfect splits still feel rewarding but sloppy ones
 * drop away fast.
 */
export function score(fractionA: number): number {
  const deviation = Math.abs(fractionA - 0.5) * 2; // 0..1
  const raw = (1 - deviation) ** 2 * 100;
  return Math.round(raw * 10) / 10;
}
