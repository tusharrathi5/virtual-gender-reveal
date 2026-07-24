export type RevealAccessRecord = {
  mode?: unknown;
  plan?: unknown;
  partyEnabled?: unknown;
};

/**
 * Bundle of Joy announcements are custom downloadable keepsakes, not events.
 * The explicit flag protects new records, while the mode/plan fallback also
 * protects older paid announcements that predate the flag.
 */
export function isBundleOfJoyAnnouncement(
  reveal: RevealAccessRecord | null | undefined
): boolean {
  if (!reveal) return false;
  return (
    reveal.partyEnabled === false ||
    (reveal.mode === "announcement" && reveal.plan === "premium")
  );
}

export const PARTY_UNAVAILABLE_MESSAGE =
  "Party mode is not available for Bundle of Joy announcements.";
