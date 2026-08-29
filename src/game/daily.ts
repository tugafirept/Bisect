// Deterministic daily challenge: the date alone decides the country and mode,
// so every player gets the same puzzle with no server involved.

export interface DailyChallenge {
  date: string; // YYYY-MM-DD
  countryId: string;
  modeId: string;
}

/** FNV-1a, stable across engines. */
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function isoDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dailyChallenge(
  countryIds: string[],
  availableModeIds: string[] = ["area"],
  date: string = isoDate(),
): DailyChallenge {
  if (countryIds.length === 0) throw new Error("no countries available");
  const h = hashString(date);
  const countryId = countryIds[h % countryIds.length]!;
  const modeId = availableModeIds[(h >>> 8) % availableModeIds.length]!;
  return { date, countryId, modeId };
}

/** Milliseconds until the next puzzle (00:00 UTC). */
export function msUntilNextPuzzle(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(0, next - now.getTime());
}

/** ms -> "HH:MM:SS" */
export function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return [
    pad(Math.floor(total / 3600)),
    pad(Math.floor((total % 3600) / 60)),
    pad(total % 60),
  ].join(":");
}
