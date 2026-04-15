// ─── Firestore Collection Types ─────────────────────────────

export type EnquiryStatus =
  | "pending_payment"
  | "awaiting_doctor"
  | "doctor_confirmed"
  | "video_ready"
  | "scheduled"
  | "live"
  | "completed";

export interface Enquiry {
  id: string;
  userId: string;
  babyNickname: string;
  parentNames: string;
  dueDate: string;
  revealStyle: string;
  status: EnquiryStatus;
  doctorEmail: string;
  doctorTokenHash: string;      // SHA-256 hash — never store plain token
  doctorConfirmedAt?: string;
  genderEncrypted?: string;     // AES encrypted — admin only
  videoUrl?: string;            // Cloudflare Stream URL
  scheduledAt?: string;         // ISO8601
  roomPassword?: string;        // hashed
  stripePaymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuestSession {
  id: string;
  enquiryId: string;
  joinedAt: string;
  ipAddress?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
