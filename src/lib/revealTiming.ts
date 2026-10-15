// How far in the future a reveal must be scheduled (shared by the create form and the
// create/update APIs).
// TEMP: lowered to 0 to test party-page playback right away. Restore to 30 before release
// (the date picker's own minimum was previously one hour).
export const MIN_REVEAL_LEAD_MINUTES = 0;
export const MIN_REVEAL_LEAD_MS = MIN_REVEAL_LEAD_MINUTES * 60 * 1000;
