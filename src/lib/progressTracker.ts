import type { EnquiryStages } from "@/lib/types";

// ─── Stage Definitions ──────────────────────────────────────

// The ORDER of this array determines progress order.
// Keys must match EnquiryStages interface exactly.
export const STAGE_DEFINITIONS = [
  {
    key: "paymentReceived" as const,
    label: "Payment Received",
    shortLabel: "Payment",
    description: "Parent has paid for the reveal",
  },
  {
    key: "revealerLinkSent" as const,
    label: "Revealer Link Sent",
    shortLabel: "Link Sent",
    description: "Secure link emailed to the revealer",
  },
  {
    key: "revealerSubmitted" as const,
    label: "Gender Submitted",
    shortLabel: "Gender In",
    description: "Revealer has submitted the gender",
  },
  {
    key: "videoGenerated" as const,
    label: "Video Ready",
    shortLabel: "Video Ready",
    description: "Reveal video has been generated",
  },
  {
    key: "guestInvitesSent" as const,
    label: "Guests Invited",
    shortLabel: "Invites Sent",
    description: "Invitations sent to all guests",
  },
  {
    key: "eventScheduled" as const,
    label: "Event Scheduled",
    shortLabel: "Scheduled",
    description: "Reveal event is locked in and ready",
  },
  {
    key: "eventCompleted" as const,
    label: "Event Completed",
    shortLabel: "Done",
    description: "Reveal event has played successfully",
  },
] as const;

export type StageKey = (typeof STAGE_DEFINITIONS)[number]["key"];

export const TOTAL_STAGES = STAGE_DEFINITIONS.length;

// ─── Progress Computation ───────────────────────────────────

export type StageState = "done" | "current" | "pending";

export interface StageInfo {
  key: StageKey;
  label: string;
  shortLabel: string;
  description: string;
  state: StageState;
  completedAt: Date | null;
}

export interface ProgressResult {
  percentComplete: number; // 0-100, rounded to nearest integer
  stagesDone: number; // count of completed stages (0 to TOTAL_STAGES)
  currentStageIndex: number; // 0-based; -1 if all stages done
  currentStageKey: StageKey | null; // null if all stages done
  stages: StageInfo[]; // always in definition order
  isComplete: boolean;
}

/**
 * Compute progress from an enquiry's stages object.
 * Pure function — no side effects, no async.
 */
export function computeProgress(stages: EnquiryStages): ProgressResult {
  const stageInfos: StageInfo[] = [];
  let stagesDone = 0;
  let currentStageIndex = -1;

  for (let i = 0; i < STAGE_DEFINITIONS.length; i++) {
    const def = STAGE_DEFINITIONS[i];
    const value = stages[def.key];
    const isDone = value !== null && value !== undefined;

    if (isDone) {
      stagesDone++;
    } else if (currentStageIndex === -1) {
      // First pending stage becomes "current"
      currentStageIndex = i;
    }

    stageInfos.push({
      key: def.key,
      label: def.label,
      shortLabel: def.shortLabel,
      description: def.description,
      state: isDone ? "done" : "pending", // overwritten below
      completedAt: isDone ? timestampToDate(value) : null,
    });
  }

  // Mark the current stage
  if (currentStageIndex !== -1) {
    stageInfos[currentStageIndex].state = "current";
  }

  const percentComplete = Math.round((stagesDone / TOTAL_STAGES) * 100);
  const isComplete = stagesDone === TOTAL_STAGES;

  return {
    percentComplete,
    stagesDone,
    currentStageIndex,
    currentStageKey: currentStageIndex === -1 ? null : STAGE_DEFINITIONS[currentStageIndex].key,
    stages: stageInfos,
    isComplete,
  };
}

// ─── Utility ────────────────────────────────────────────────

/**
 * Accept a Firestore Timestamp, a JS Date, a number, a string, or null/undefined,
 * and return a Date or null.
 *
 * Firestore Timestamps come through as objects with .toDate() on the client,
 * but as { _seconds, _nanoseconds } when serialized over an API route.
 * This handles both.
 */
function timestampToDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  // Firebase Timestamp instance (client or server SDK)
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeFn = (value as { toDate: unknown }).toDate;
    if (typeof maybeFn === "function") {
      return (value as { toDate: () => Date }).toDate();
    }
  }

  // Firestore Timestamp serialized over JSON: { _seconds, _nanoseconds } or { seconds, nanoseconds }
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    const seconds = v._seconds ?? v.seconds;
    if (typeof seconds === "number") {
      return new Date(seconds * 1000);
    }
  }

  // Already a Date
  if (value instanceof Date) return value;

  // Number (ms since epoch) or string (ISO)
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// ─── Display Helpers ────────────────────────────────────────

/**
 * Returns a Tailwind-style color class for a stage's visual state.
 * Kept as strings (not CSS objects) so it's framework-agnostic.
 * The admin page can map these to actual CSS as needed.
 */
export function getStageColor(state: StageState): string {
  switch (state) {
    case "done":
      return "green";
    case "current":
      return "blue";
    case "pending":
      return "gray";
  }
}
