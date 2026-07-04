export type PaymentStatusValue = "pending" | "completed";
export type RevealVideoStatusValue = "in_progress" | "ready";
export type AdminVideoStatusValue = "not_uploaded" | "uploaded";

export const PAYMENT_PENDING_LABEL = "Payment Pending";
export const PAYMENT_COMPLETED_LABEL = "Payment Completed";
export const VIDEO_IN_PROGRESS_LABEL = "Video in Progress";
export const VIDEO_READY_LABEL = "Video Ready";
export const VIDEO_NOT_UPLOADED_LABEL = "Video Not Uploaded";
export const VIDEO_UPLOADED_LABEL = "Video Uploaded";

export interface PurchaseStatusSource {
  status?: unknown;
  revealEnquiryId?: unknown;
}

export interface VideoStatusSource {
  videoUrl?: unknown;
  streamUid?: unknown;
  stages?: {
    videoGenerated?: unknown;
  } | null;
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasSavedRevealVideo(source: VideoStatusSource | null | undefined): boolean {
  if (!source) return false;
  return hasNonEmptyString(source.videoUrl);
}

export function getRevealVideoStatus(
  source: VideoStatusSource | null | undefined
): RevealVideoStatusValue {
  return hasSavedRevealVideo(source) ? "ready" : "in_progress";
}

export function getRevealVideoLabel(source: VideoStatusSource | null | undefined): string {
  return getRevealVideoStatus(source) === "ready" ? VIDEO_READY_LABEL : VIDEO_IN_PROGRESS_LABEL;
}

export function getAdminVideoStatus(
  source: VideoStatusSource | null | undefined
): AdminVideoStatusValue {
  return hasSavedRevealVideo(source) ? "uploaded" : "not_uploaded";
}

export function getAdminVideoLabel(source: VideoStatusSource | null | undefined): string {
  return getAdminVideoStatus(source) === "uploaded"
    ? VIDEO_UPLOADED_LABEL
    : VIDEO_NOT_UPLOADED_LABEL;
}

export function normalizePaymentStatus(value: unknown): PaymentStatusValue {
  return value === "completed" ? "completed" : "pending";
}

export function getPaymentStatusLabel(status: unknown): string {
  return normalizePaymentStatus(status) === "completed"
    ? PAYMENT_COMPLETED_LABEL
    : PAYMENT_PENDING_LABEL;
}

export function derivePaymentStatusFromPurchases(
  purchases: PurchaseStatusSource[] | null | undefined,
  revealEnquiryId?: string | null
): PaymentStatusValue {
  if (!Array.isArray(purchases) || purchases.length === 0) return "pending";

  const completed = purchases.some((purchase) => {
    if (purchase.status !== "completed") return false;
    if (!revealEnquiryId) return true;
    return purchase.revealEnquiryId === revealEnquiryId;
  });

  return completed ? "completed" : "pending";
}
