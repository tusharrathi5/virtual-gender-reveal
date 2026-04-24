import { Timestamp } from "firebase/firestore";

// ─── Enquiry (the main "reveal event" document) ─────────────

export type EnquiryStatus =
  | "pending_payment"
  | "awaiting_revealer"
  | "revealer_confirmed"
  | "video_ready"
  | "scheduled"
  | "live"
  | "completed";

export type EnquiryMode = "announcement" | "reveal";

export type RevealerRelation = "doctor" | "relative" | "friend" | "other";

export type GenderStatus = "not_submitted" | "submitted";

// Progress tracker — each stage is either null (not done) or a completion timestamp
export interface EnquiryStages {
  paymentReceived: Timestamp | null;
  revealerLinkSent: Timestamp | null;
  revealerSubmitted: Timestamp | null;
  videoGenerated: Timestamp | null;
  guestInvitesSent: Timestamp | null;
  eventScheduled: Timestamp | null;
  eventCompleted: Timestamp | null;
}

export interface Enquiry {
  id: string;
  userId: string;

  // Mode
  mode: EnquiryMode;

  // Parents + baby
  parentName: string;
  // Names depending on mode:
  babyName: string | null;           // announcement mode only
  babyNameGirl: string | null;       // reveal mode only
  babyNameBoy: string | null;        // reveal mode only

  // Photos (URLs in Firebase Storage) — 1 to 3 photos, no special distinction
  photos: string[];
  photoCount: number;                // denormalized, equals photos.length

  // Revealer (reveal mode only)
  revealerEmail: string | null;
  revealerRelation: RevealerRelation | null;
  revealerName: string | null;

  // Event timing
  revealAt: Timestamp;
  revealTimezone: string;            // IANA e.g. "Asia/Kolkata"

  // Progress
  stages: EnquiryStages;

  // Denormalized fields for fast admin queries
  guestCount: number;
  genderStatus: GenderStatus;

  // Revealer token (only for reveal mode)
  doctorTokenHash: string | null;

  // Stripe
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  amountTotal: number | null;

  // Status
  status: EnquiryStatus;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Secure Gender (encrypted, server-only access) ──────────

export type GenderSubmittedBy = "parent" | "revealer" | "admin";

export interface SecureGender {
  enquiryId: string;
  encryptedGender: string;    // base64 ciphertext
  iv: string;                  // base64 init vector
  authTag: string;             // base64 GCM auth tag
  keyVersion: number;          // which key version was used to encrypt
  submittedBy: GenderSubmittedBy;
  submittedByUid: string | null;
  submittedAt: Timestamp;
  revealedToGuestsAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// The decrypted form — only ever exists in memory on the server
export type GenderValue = "boy" | "girl";

// ─── Guest (reveal event invitees) ──────────────────────────

export type GuestInviteStatus = "pending" | "sent" | "failed";
export type GuestRsvp = "pending" | "accepted" | "declined";

export interface Guest {
  guestId: string;
  enquiryId: string;
  name: string;
  email: string;

  inviteToken: string;
  inviteStatus: GuestInviteStatus;
  inviteSentAt: Timestamp | null;

  rsvp: GuestRsvp;
  joinedAt: Timestamp | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Audit Log (optional, for future use) ───────────────────

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

// ─── Form Input Types (used by new-reveal form) ─────────────

// What the form collects — not yet a Firestore document
export interface NewReveal_FormInput {
  mode: EnquiryMode;
  parentName: string;
  revealAt: string;                    // ISO string from datetime-local input
  revealTimezone: string;

  // Photos: 1 to 3 File objects (user picks any number in that range)
  photoFiles: File[];

  // Announcement mode fields
  babyName?: string;
  announcementGender?: GenderValue;

  // Reveal mode fields
  babyNameGirl?: string;
  babyNameBoy?: string;
  revealerEmail?: string;
  revealerRelation?: RevealerRelation;
}

// ─── Helper: initial stages object for new enquiries ────────

export const INITIAL_STAGES: EnquiryStages = {
  paymentReceived: null,
  revealerLinkSent: null,
  revealerSubmitted: null,
  videoGenerated: null,
  guestInvitesSent: null,
  eventScheduled: null,
  eventCompleted: null,
};

// ─── Photo constraints (single source of truth) ─────────────

export const PHOTO_MIN = 1;
export const PHOTO_MAX = 3;

// ─── Plan definitions (source of truth for the dashboard + pricing) ──

export interface PlanDefinition {
  id: "free" | "premium" | "custom";
  name: string;
  priceCents: number;             // 0 for free
  priceLabel: string;
  revealsGranted: number;         // how many reveals this plan unlocks per purchase
  description: string;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Spark",
    priceCents: 0,
    priceLabel: "Free",
    revealsGranted: 1,
    description: "Try the magic — one free reveal to get started.",
  },
  {
    id: "premium",
    name: "Lumière",
    priceCents: 19900,
    priceLabel: "$199",
    revealsGranted: 1,
    description: "Full cinematic reveal with live broadcast.",
  },
  {
    id: "custom",
    name: "Maison",
    priceCents: 65000,
    priceLabel: "$650",
    revealsGranted: 1,
    description: "Bespoke reveal with dedicated concierge.",
  },
];

export function getPlanById(id: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === id);
}
