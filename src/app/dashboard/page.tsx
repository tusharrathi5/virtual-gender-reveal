"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { uploadPhotos, validatePhotoFiles } from "@/lib/storageService";
import {
  derivePaymentStatusFromPurchases,
  getPaymentStatusLabel,
  getRevealVideoLabel,
  getRevealVideoStatus,
  normalizePaymentStatus,
} from "@/lib/statusLabels";
import {
  PHOTO_MAX,
  PLANS,
  type EnquiryMode,
  type GenderValue,
  type PlanDefinition,
  type RevealerRelation,
} from "@/lib/types";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  Sparkles,
  Calendar,
  Mail,
  User,
  Plus,
  Trash2,
  AlertCircle,
  Camera,
  Heart,
  ChevronDown,
  Users,
  Upload,
  RefreshCw,
  Clock,
  ShieldAlert,
  Edit2,
  ArrowRight,
} from "lucide-react";

interface RevealSummary {
  id: string;
  mode: EnquiryMode;
  parentName: string;
  babyName: string | null;
  babyNameGirl: string | null;
  babyNameBoy: string | null;
  revealerEmail: string | null;
  revealerRelation: RevealerRelation | null;
  revealAt: Date | null;
  revealTimezone: string;
  dueDate: string | null;
  status: string;
  paymentStatus: "pending" | "completed";
  genderStatus: string;
  photos: string[];
  createdAt: Date | null;
  videoUrl?: string | null;
  videoReady?: boolean;
}

interface RevealEditForm {
  id: string;
  mode: EnquiryMode;
  parentName: string;
  announcementGender: "" | GenderValue;
  revealerEmail: string;
  revealerRelation: RevealerRelation;
  revealAt: string;
  revealTimezone: string;
  dueDate: string;
  photos: string[];
}

interface GuestRow {
  guestId: string;
  name: string;
  phone: string;
  email: string;
  inviteStatus: string;
  responded: boolean;
  prediction: string | null;
  message: string | null;
  hasMessage: boolean;
  isHost?: boolean;
}

interface EditableGuestRow {
  rowId: string;
  name: string;
  phone: string;
  email: string;
}

interface ImportSummary {
  fileName: string;
  added: number;
  invalid: number;
  duplicates: number;
}

type ToastType = "success" | "error" | "info";

const RELATION_LABELS: Record<RevealerRelation, string> = {
  doctor: "Doctor / Midwife",
  relative: "Relative",
  friend: "Friend",
  other: "Other",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  const colors = {
    success: "border-green-500 bg-green-50 text-green-800",
    error: "border-red-500 bg-red-50 text-red-800",
    info: "border-blue-500 bg-blue-50 text-blue-800",
  };

  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed top-20 right-6 z-[9999] border-l-4 rounded-xl p-4 shadow-lg flex items-center justify-between gap-4 max-w-sm md:max-w-md animate-slide-in font-medium text-sm ${colors[type]}`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <span className="font-bold text-xs uppercase bg-white/70 px-2 py-0.5 rounded-full shrink-0">
          {type === "success" ? "✓" : type === "error" ? "!" : "i"}
        </span>
        <span>{message}</span>
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-800 font-bold text-lg leading-none shrink-0"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate: unknown }).toDate;
    if (typeof fn === "function") return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function formatRevealDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTimeLocal(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// ─── Custom XLSX & CSV Parser Helper Logic (No library dependency) ───

function canEditReveal(reveal: RevealSummary): boolean {
  return !!reveal.createdAt && Date.now() - reveal.createdAt.getTime() <= EDIT_WINDOW_MS;
}

function editWindowText(reveal: RevealSummary): string {
  if (!reveal.createdAt) return "Edit window unavailable";
  const remaining = reveal.createdAt.getTime() + EDIT_WINDOW_MS - Date.now();
  if (remaining <= 0) return "Locked after 24 hours";
  const hours = Math.max(1, Math.ceil(remaining / (60 * 60 * 1000)));
  return `${hours} hour${hours === 1 ? "" : "s"} left to edit`;
}

function blankGuestRow(rowId = "draft-1"): EditableGuestRow {
  return { rowId, name: "", phone: "", email: "" };
}

function makeGuestRow(): EditableGuestRow {
  return blankGuestRow(`draft-${Date.now()}-${Math.round(Math.random() * 10000)}`);
}

function normalizeGuest(row: EditableGuestRow): EditableGuestRow {
  return {
    ...row,
    name: row.name.trim(),
    phone: row.phone.trim(),
    email: row.email.trim().toLowerCase(),
  };
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const candidates = [",", "\t", ";"];
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: sample.split(delimiter).length - 1,
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

function parseDelimitedRows(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isLikelyPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 16;
}

function columnIndexFromCellRef(ref: string): number {
  const letters = ref.replace(/[0-9]/g, "").toUpperCase();
  let index = 0;
  for (let i = 0; i < letters.length; i += 1) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(0, index - 1);
}

function findZipEnd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 65557);
  for (let i = view.byteLength - 22; i >= min; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  throw new Error("Could not read the XLSX file.");
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("XLSX import is not supported in this browser.");
  }
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const stream = new Blob([arrayBuffer]).stream().pipeThrough(
    new DecompressionStream("deflate-raw" as CompressionFormat)
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function parseXlsxRows(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const end = findZipEnd(view);
  const totalEntries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries = new Map<
    string,
    { method: number; compressedSize: number; localHeaderOffset: number }
  >();

  for (let i = 0; i < totalEntries; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    entries.set(name, { method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  async function readText(path: string): Promise<string | null> {
    const entry = entries.get(path);
    if (!entry) return null;
    const local = entry.localHeaderOffset;
    if (view.getUint32(local, true) !== 0x04034b50) return null;
    const nameLength = view.getUint16(local + 26, true);
    const extraLength = view.getUint16(local + 28, true);
    const start = local + 30 + nameLength + extraLength;
    const compressed = bytes.slice(start, start + entry.compressedSize);
    const raw =
      entry.method === 0 ? compressed : entry.method === 8 ? await inflateRaw(compressed) : null;
    if (!raw) throw new Error("Unsupported XLSX compression method.");
    return decoder.decode(raw);
  }

  const parser = new DOMParser();
  const sharedXml = await readText("xl/sharedStrings.xml");
  const sharedStrings: string[] = [];
  if (sharedXml) {
    const doc = parser.parseFromString(sharedXml, "application/xml");
    Array.from(doc.getElementsByTagName("si")).forEach((si) => {
      const text = Array.from(si.getElementsByTagName("t"))
        .map((node) => node.textContent || "")
        .join("");
      sharedStrings.push(text);
    });
  }

  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbookXml = await readText("xl/workbook.xml");
  const relsXml = await readText("xl/_rels/workbook.xml.rels");
  if (workbookXml && relsXml) {
    const workbook = parser.parseFromString(workbookXml, "application/xml");
    const rels = parser.parseFromString(relsXml, "application/xml");
    const firstSheet = workbook.getElementsByTagName("sheet")[0];
    const relId =
      firstSheet?.getAttribute("r:id") ||
      firstSheet?.getAttribute("id") ||
      firstSheet?.getAttribute("relationshipId");
    if (relId) {
      const rel = Array.from(rels.getElementsByTagName("Relationship")).find(
        (node) => node.getAttribute("Id") === relId
      );
      const target = rel?.getAttribute("Target");
      if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    }
  }

  const sheetXml = await readText(sheetPath);
  if (!sheetXml) throw new Error("Could not find a worksheet in the XLSX file.");

  const sheet = parser.parseFromString(sheetXml, "application/xml");
  return Array.from(sheet.getElementsByTagName("row")).map((rowNode) => {
    const row: string[] = [];
    Array.from(rowNode.getElementsByTagName("c")).forEach((cellNode) => {
      const cellRef = cellNode.getAttribute("r") || "";
      const index = cellRef ? columnIndexFromCellRef(cellRef) : row.length;
      const type = cellNode.getAttribute("t");
      let value = "";
      if (type === "inlineStr") {
        value = Array.from(cellNode.getElementsByTagName("t"))
          .map((node) => node.textContent || "")
          .join("");
      } else {
        value = cellNode.getElementsByTagName("v")[0]?.textContent || "";
        if (type === "s") value = sharedStrings[Number(value)] || "";
      }
      row[index] = value.trim();
    });
    return row;
  });
}

function rowsToGuests(rows: string[][]): {
  valid: EditableGuestRow[];
  invalid: number;
  duplicates: number;
} {
  const cleanRows = rows
    .map((row) => row.map((cell) => String(cell || "").trim()))
    .filter((row) => row.some(Boolean));

  if (cleanRows.length === 0) return { valid: [], invalid: 0, duplicates: 0 };

  const first = cleanRows[0].map(normalizeHeader);
  const hasHeader = first.some((h) =>
    ["name", "fullname", "guestname", "email", "emailaddress", "phone", "number", "mobile"].includes(h)
  );

  const nameIndex = first.findIndex((h) => ["name", "fullname", "guestname"].includes(h));
  const emailIndex = first.findIndex((h) => ["email", "emailaddress", "mail"].includes(h));
  const phoneIndex = first.findIndex((h) =>
    ["phone", "phonenumber", "number", "mobile", "mobilenumber", "contact"].includes(h)
  );
  const dataRows = hasHeader ? cleanRows.slice(1) : cleanRows;

  const seen = new Set<string>();
  let invalid = 0;
  let duplicates = 0;
  const valid: EditableGuestRow[] = [];

  dataRows.forEach((row, index) => {
    let name = hasHeader && nameIndex >= 0 ? row[nameIndex] || "" : "";
    let email = hasHeader && emailIndex >= 0 ? row[emailIndex] || "" : "";
    let phone = hasHeader && phoneIndex >= 0 ? row[phoneIndex] || "" : "";

    if (!hasHeader) {
      const emailCellIndex = row.findIndex((cell) => EMAIL_RE.test(cell.trim().toLowerCase()));
      email = emailCellIndex >= 0 ? row[emailCellIndex] : "";
      const remaining = row.filter((_, i) => i !== emailCellIndex).filter(Boolean);
      const phoneCellIndex = remaining.findIndex(isLikelyPhone);
      phone = phoneCellIndex >= 0 ? remaining[phoneCellIndex] : "";
      name = remaining.filter((_, i) => i !== phoneCellIndex).join(" ").trim();
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim() || !EMAIL_RE.test(normalizedEmail)) {
      invalid += 1;
      return;
    }
    if (seen.has(normalizedEmail)) {
      duplicates += 1;
      return;
    }
    seen.add(normalizedEmail);
    valid.push({
      rowId: `import-${Date.now()}-${index}`,
      name: name.trim(),
      phone: phone.trim(),
      email: normalizedEmail,
    });
  });

  return { valid, invalid, duplicates };
}

function mergeGuestRows(
  current: EditableGuestRow[],
  imported: EditableGuestRow[]
): { rows: EditableGuestRow[]; duplicates: number } {
  const existing = current
    .map(normalizeGuest)
    .filter((row) => row.name || row.phone || row.email);
  const seen = new Set(existing.map((row) => row.email).filter(Boolean));
  let duplicates = 0;
  const next = [...existing];

  imported.forEach((row) => {
    const normalized = normalizeGuest(row);
    if (seen.has(normalized.email)) {
      duplicates += 1;
      return;
    }
    seen.add(normalized.email);
    next.push(normalized);
  });

  return { rows: next.length ? next : [blankGuestRow()], duplicates };
}

// ─── Main Content Component ─────────────────────────────────

function DashboardContent() {
  const { user, firestoreUser, loading, logout, refreshFirestoreUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reveals, setReveals] = useState<RevealSummary[]>([]);
  const [revealsLoading, setRevealsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [activatingPlan, setActivatingPlan] = useState<string | null>(null);
  const [pendingPaymentPlan, setPendingPaymentPlan] = useState<PlanDefinition | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [guestDraftRows, setGuestDraftRows] = useState<EditableGuestRow[]>([
    blankGuestRow(),
  ]);
  const [guestImportSummary, setGuestImportSummary] = useState<ImportSummary | null>(null);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [openingPartyId, setOpeningPartyId] = useState<string | null>(null);
  const [startingReveal, setStartingReveal] = useState(false);
  const [guestRows, setGuestRows] = useState<GuestRow[]>([]);
  const [revealUnlocked, setRevealUnlocked] = useState(false);
  const [editingRevealId, setEditingRevealId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RevealEditForm | null>(null);
  const [editPhotoFiles, setEditPhotoFiles] = useState<File[]>([]);
  const [savingReveal, setSavingReveal] = useState(false);
  const handledDashboardQueryRef = useRef<string | null>(null);
  const guestFileInputRef = useRef<HTMLInputElement>(null);

  const latestReveal = reveals[0];

  const loadReveals = useCallback(async () => {
    if (!user) return;
    setRevealsLoading(true);
    try {
      const db = getFirebaseDb();
      const q = query(
        collection(db, "enquiries"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const items: RevealSummary[] = snap.docs.map((d) => {
        const data = d.data();
        const stages = data.stages ?? {};
        const persistedPaymentStatus = normalizePaymentStatus(
          data.paymentStatus ?? (stages.paymentReceived ? "completed" : "pending")
        );
        const purchasePaymentStatus = derivePaymentStatusFromPurchases(firestoreUser?.purchases ?? null, d.id);
        const paymentStatus = purchasePaymentStatus === "completed"
          ? "completed"
          : persistedPaymentStatus;
        return {
          id: d.id,
          mode: data.mode === "announcement" ? "announcement" : "reveal",
          parentName: data.parentName ?? "",
          babyName: typeof data.babyName === "string" ? data.babyName : null,
          babyNameGirl: typeof data.babyNameGirl === "string" ? data.babyNameGirl : null,
          babyNameBoy: typeof data.babyNameBoy === "string" ? data.babyNameBoy : null,
          revealerEmail: typeof data.revealerEmail === "string" ? data.revealerEmail : null,
          revealerRelation: (data.revealerRelation as RevealerRelation | null) ?? null,
          revealAt: timestampToDate(data.revealAt),
          revealTimezone: typeof data.revealTimezone === "string" ? data.revealTimezone : "UTC",
          dueDate: timestampToDate(data.dueDate)?.toISOString() ?? null,
          status: data.status ?? "pending_payment",
          paymentStatus,
          genderStatus: data.genderStatus ?? "not_submitted",
          photos: Array.isArray(data.photos) ? data.photos.filter(Boolean) : [],
          createdAt: timestampToDate(data.createdAt),
          videoUrl: typeof data.videoUrl === "string" ? data.videoUrl : null,
          videoReady: getRevealVideoStatus({ videoUrl: data.videoUrl }) === "ready",
        };
      });
      setReveals(items);
    } catch (err) {
      console.error("Failed to load reveals:", err);
      setToast({ type: "error", message: "Failed to load your reveals." });
    } finally {
      setRevealsLoading(false);
    }
  }, [firestoreUser?.purchases, user]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && firestoreUser?.role?.toLowerCase() === "admin") {
      router.replace("/admin");
    }
  }, [loading, firestoreUser, router]);

  useEffect(() => {
    const payment = searchParams.get("payment");
    const plan = searchParams.get("plan");
    const sessionId = searchParams.get("session_id");
    const checkoutPlan = searchParams.get("checkout");
    const confirmedCheckout = searchParams.get("confirmed") === "1";
    const created = searchParams.get("created");
    const noEntitlement = searchParams.get("noEntitlement") === "1";
    const actionKey = searchParams.toString();
    const hasDashboardAction = Boolean(payment || checkoutPlan || created || noEntitlement);

    if (!hasDashboardAction) return;
    if ((payment === "success" || checkoutPlan) && !user) return;
    if (handledDashboardQueryRef.current === actionKey) return;
    handledDashboardQueryRef.current = actionKey;

    if (payment === "success") {
      router.replace("/dashboard");
      setToast({ message: "Payment completed. Confirming your plan now...", type: "info" });

      void (async () => {
        try {
          if (!sessionId || !user) {
            setToast({ message: "Payment could not be confirmed. Please try checkout again.", type: "error" });
            return;
          }

          const token = await user.getIdToken();
          const res = await fetch(`/api/checkout-status?session_id=${encodeURIComponent(sessionId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || "Unable to confirm payment.");
          if (data.paymentStatus !== "paid") {
            setToast({ message: "Payment was not completed. Please try again.", type: "error" });
            return;
          }

          await refreshFirestoreUser();
          setToast({
            message: plan
              ? `Payment successful. ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan activated.`
              : "Payment successful. Your plan is active.",
            type: "success",
          });
          router.push("/new-reveal");
        } catch (err) {
          setToast({
            message: err instanceof Error ? err.message : "Payment completed, but confirmation failed. Please refresh your dashboard.",
            type: "error",
          });
        }
      })();
    } else if (payment === "cancelled") {
      setToast({ message: "Payment was cancelled or declined. Choose a plan to continue.", type: "info" });
      void refreshFirestoreUser();
      router.replace("/dashboard");
    } else if (checkoutPlan) {
      const selectedPlan = PLANS.find((p) => p.id === checkoutPlan);
      router.replace("/dashboard");
      if (selectedPlan) {
        if (confirmedCheckout || selectedPlan.priceCents === 0) void handleSelectPlan(selectedPlan);
        else requestPlanCheckout(selectedPlan);
      }
    } else if (created) {
      setToast({ message: "Your reveal was created successfully.", type: "success" });
      void refreshFirestoreUser();
      router.replace("/dashboard");
    } else if (noEntitlement) {
      setToast({ message: "Please choose a plan before creating a reveal.", type: "info" });
      router.replace("/dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, refreshFirestoreUser, user]);

  useEffect(() => {
    void loadReveals();
  }, [loadReveals]);

  useEffect(() => {
    if (!user || !latestReveal?.id) return;
    void loadGuestList(latestReveal.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, latestReveal?.id]);

  const firstName = useMemo(
    () => user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "there",
    [user]
  );

  const activePlan = firestoreUser?.activePlan ?? "none";
  const revealsAllowed = firestoreUser?.revealsAllowed ?? 0;
  const revealsCreated = firestoreUser?.revealsCreated ?? 0;
  const hasPlan = activePlan !== "none";
  const canCreateReveal = revealsAllowed > 0;
  const accountPaymentStatus = derivePaymentStatusFromPurchases(firestoreUser?.purchases ?? null);

  if (loading || !user) return null;

  async function loadGuestList(enquiryId: string) {
    const idToken = await user!.getIdToken();
    const res = await fetch(`/api/guest/list?enquiryId=${encodeURIComponent(enquiryId)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Failed to load guest list.");
    setGuestRows(Array.isArray(data?.guests) ? data.guests : []);
    setRevealUnlocked(Boolean(data?.revealUnlocked));
  }

  async function handleGuestFile(file: File) {
    try {
      const rows = file.name.toLowerCase().endsWith(".xlsx")
        ? await parseXlsxRows(file)
        : parseDelimitedRows(await file.text());
      const parsed = rowsToGuests(rows);
      const merged = mergeGuestRows(guestDraftRows, parsed.valid);
      setGuestDraftRows(merged.rows);
      setGuestImportSummary({
        fileName: file.name,
        added: merged.rows.length,
        invalid: parsed.invalid,
        duplicates: parsed.duplicates + merged.duplicates,
      });
      if (parsed.invalid > 0 || parsed.duplicates + merged.duplicates > 0) {
        setToast({
          type: "info",
          message: `Imported guests with ${parsed.invalid} invalid and ${
            parsed.duplicates + merged.duplicates
          } duplicate row(s) skipped.`,
        });
      }
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to import guest file.",
      });
    }
  }

  function updateGuestDraft(rowId: string, field: keyof Omit<EditableGuestRow, "rowId">, value: string) {
    setGuestDraftRows((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row))
    );
  }

  function removeGuestDraft(rowId: string) {
    setGuestDraftRows((rows) => {
      const next = rows.filter((row) => row.rowId !== rowId);
      return next.length ? next : [blankGuestRow()];
    });
  }

  async function sendGuestInvites(enquiryId: string) {
    const guests = guestDraftRows.map(normalizeGuest).filter((row) => row.name || row.email || row.phone);
    const invalid = guests.filter((row) => !row.name || !EMAIL_RE.test(row.email));
    if (guests.length === 0) {
      setToast({ type: "error", message: "Add at least one guest with a name and email." });
      return;
    }
    if (invalid.length > 0) {
      setToast({ type: "error", message: "Each guest needs a name and valid email before sending." });
      return;
    }

    setSendingInvites(true);
    try {
      const idToken = await user!.getIdToken();
      const res = await fetch("/api/guest/send-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ enquiryId, guests }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send invites.");
      setGuestDraftRows([
        blankGuestRow("draft-1"),
        blankGuestRow("draft-2"),
        blankGuestRow("draft-3"),
        blankGuestRow("draft-4"),
      ]);
      setGuestImportSummary(null);
      setToast({
        type: "success",
        message: `Sent ${data.sent ?? guests.length} invite(s). Host copy ${
          data.hostSent ? "sent" : "not sent"
        }.`,
      });
      await loadGuestList(enquiryId);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to send invites." });
    } finally {
      setSendingInvites(false);
    }
  }

  async function manageGuest(guestId: string, action: "resend" | "revoke", enquiryId: string) {
    try {
      const idToken = await user!.getIdToken();
      const res = await fetch("/api/guest/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ guestId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to ${action} invite.`);
      setToast({ type: "success", message: action === "resend" ? "Invite resent." : "Invite revoked." });
      await loadGuestList(enquiryId);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to manage guest." });
    }
  }

  async function sendGuestDigest(enquiryId: string) {
    try {
      const idToken = await user!.getIdToken();
      const res = await fetch("/api/guest/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ enquiryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send digest.");
      setToast({ type: "success", message: `Digest sent with ${data.sent ?? 0} response(s).` });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to send digest." });
    }
  }

  function requestPlanCheckout(plan: PlanDefinition) {
    if (activatingPlan) return;
    if (plan.priceCents > 0) {
      setPendingPaymentPlan(plan);
      return;
    }
    void handleSelectPlan(plan);
  }

  function cancelPaymentPrompt() {
    setPendingPaymentPlan(null);
    setToast({ message: "Payment cancelled. You can choose another plan anytime.", type: "info" });
    router.replace("/dashboard");
  }

  function proceedToPaymentGateway() {
    if (!pendingPaymentPlan) return;
    const plan = pendingPaymentPlan;
    setPendingPaymentPlan(null);
    void handleSelectPlan(plan);
  }

  async function handleSelectPlan(plan: PlanDefinition) {
    if (activatingPlan) return;
    setActivatingPlan(plan.id);
    setToast({
      message: plan.priceCents > 0 ? "Taking you to the payment gateway..." : "Activating your Freemium plan...",
      type: "info",
    });
    try {
      const token = await user!.getIdToken();
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ message: data.error || "Failed to activate plan.", type: "error" });
        return;
      }
      if (data.url) {
        setToast({ message: "Taking you to the payment gateway...", type: "info" });
        window.location.href = data.url;
        return;
      }
      setToast({ message: data.message || `${plan.name} plan activated.`, type: "success" });
      await refreshFirestoreUser();
      setTimeout(() => router.push("/new-reveal"), 800);
    } catch {
      setToast({ message: "Something went wrong. Please try again.", type: "error" });
    } finally {
      setActivatingPlan(null);
    }
  }

  function startEditingReveal(reveal: RevealSummary) {
    setEditingRevealId(reveal.id);
    setEditPhotoFiles([]);
    setEditForm({
      id: reveal.id,
      mode: reveal.mode,
      parentName: reveal.parentName,
      dueDate: reveal.dueDate ? new Date(reveal.dueDate).toISOString().slice(0, 10) : "",
      announcementGender: "",
      revealerEmail: reveal.revealerEmail || "",
      revealerRelation: reveal.revealerRelation || "doctor",
      revealAt: formatDateTimeLocal(reveal.revealAt),
      revealTimezone: reveal.revealTimezone || "UTC",
      photos: reveal.photos,
    });
  }

  function updateEditForm<K extends keyof RevealEditForm>(field: K, value: RevealEditForm[K]) {
    setEditForm((form) => (form ? { ...form, [field]: value } : form));
  }

  async function saveRevealEdits() {
    if (!editForm) return;
    if (!editForm.parentName.trim()) {
      setToast({ type: "error", message: "Parent name is required." });
      return;
    }
    const revealAtMs = new Date(editForm.revealAt).getTime();
    if (!editForm.revealAt || Number.isNaN(revealAtMs)) {
      setToast({ type: "error", message: "Reveal date and time are required." });
      return;
    }
    if (editForm.mode === "reveal" && !EMAIL_RE.test(editForm.revealerEmail.trim())) {
      setToast({ type: "error", message: "A valid revealer email is required." });
      return;
    }

    setSavingReveal(true);
    try {
      let photoUrls = editForm.photos;
      if (editPhotoFiles.length > 0) {
        const validation = validatePhotoFiles(editPhotoFiles);
        if (!validation.ok) throw new Error(validation.error);
        photoUrls = await uploadPhotos(editForm.id, editPhotoFiles);
      }

      const idToken = await user!.getIdToken();
      const res = await fetch("/api/reveal/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          enquiryId: editForm.id,
          mode: editForm.mode,
          parentName: editForm.parentName.trim(),
          photos: photoUrls,
          revealAtMs,
          revealTimezone: editForm.revealTimezone.trim() || "UTC",
          dueDate: editForm.dueDate || null,
          babyName: null,
          announcementGender:
            editForm.mode === "announcement" && editForm.announcementGender
              ? editForm.announcementGender
              : undefined,
          babyNameGirl: null,
          babyNameBoy: null,
          revealerEmail:
            editForm.mode === "reveal" ? editForm.revealerEmail.trim().toLowerCase() : undefined,
          revealerRelation: editForm.mode === "reveal" ? editForm.revealerRelation : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update reveal.");
      setToast({ type: "success", message: "Reveal details updated." });
      setEditingRevealId(null);
      setEditForm(null);
      setEditPhotoFiles([]);
      await loadReveals();
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to update reveal." });
    } finally {
      setSavingReveal(false);
    }
  }

  async function startNewReveal() {
    if (!user || startingReveal) return;
    setStartingReveal(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/entitlement/can-create", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.canCreate) {
        setToast({ message: "Please complete payment before starting your reveal.", type: "info" });
        await refreshFirestoreUser();
        return;
      }
      router.push("/new-reveal");
    } catch {
      setToast({ message: "We could not confirm your payment status. Please try again.", type: "error" });
    } finally {
      setStartingReveal(false);
    }
  }

  async function joinParty(enquiryId: string) {
    if (!user) return;
    setOpeningPartyId(enquiryId);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/guest/host-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ enquiryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.partyUrl) throw new Error(data?.error || "Failed to open party.");
      window.open(data.partyUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to open party." });
    } finally {
      setOpeningPartyId(null);
    }
  }

  return (
    <DashboardShell activeTab="dashboard" title="Dashboard" showVideoBackground={true}>
      <div className="w-full space-y-8 font-jakarta">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        {pendingPaymentPlan && (
          <PaymentGatewayPrompt
            plan={pendingPaymentPlan}
            onProceed={proceedToPaymentGateway}
            onCancel={cancelPaymentPrompt}
          />
        )}

        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#E8449A] uppercase tracking-widest block mb-1">Your Dashboard</span>
            <h1 className="font-nunito font-extrabold text-3xl md:text-4xl tracking-tight bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] bg-clip-text text-transparent">
              Hello, {firstName}
            </h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">
              {!hasPlan && "Choose a plan below to get started creating your reveal."}
              {hasPlan && canCreateReveal && reveals.length === 0 && "You’re all set. Let’s create your reveal event!"}
              {hasPlan && reveals.length > 0 && "Manage details, photos, guest invitations and view live broadcasts."}
            </p>
          </div>

          {hasPlan && (
            <div className="bg-gradient-to-tr from-[#FDE8F2] to-[#D6EAFE] border border-white rounded-2xl px-5 py-4 shadow-sm flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <div className="text-xs text-gray-700 font-semibold">
                <span className="text-gray-400 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Active Account</span>
                <span className="text-gray-900 font-bold">{PLANS.find((p) => p.id === activePlan)?.name ?? activePlan}</span>
              </div>
            </div>
          )}
        </div>

        {/* Overview Stat Cards */}
        {hasPlan && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-[20px] p-6 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider mb-2">Billing Tier</span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">{PLANS.find((p) => p.id === activePlan)?.name ?? activePlan}</span>
                <span className="text-xs bg-[#FDE8F2] text-[#C2527A] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {getPaymentStatusLabel(accountPaymentStatus)}
                </span>
              </div>
            </div>

            <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-[20px] p-6 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider mb-2">Reveals Remaining</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-gray-900">{revealsAllowed}</span>
                <span className="text-xs text-gray-400 font-semibold font-jakarta">reveals allowed</span>
              </div>
            </div>

            <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-[20px] p-6 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider mb-2">Reveals Created</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-gray-900">{revealsCreated}</span>
                <span className="text-xs text-gray-400 font-semibold font-jakarta">published to date</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Reveals List or Empty State */}
        {reveals.length > 0 ? (
          <section className="space-y-6">
            <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-2xl p-4 shadow-sm mb-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#E8449A]" />
                Your Reveals
              </h2>
            </div>

            <div className="space-y-6">
              {reveals.map((reveal) => {
                const editable = canEditReveal(reveal);
                const isEditing = editingRevealId === reveal.id && editForm;
                return (
                  <article key={reveal.id} className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-[20px] p-6 md:p-8 shadow-sm space-y-6">
                    {/* Reveal Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 pb-4">
                      <div className="flex items-center gap-4">

                        <div>
                          <span className="text-[10px] bg-[#D6EAFE] text-[#1B4F8C] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {reveal.mode === "announcement" ? "Announcement" : "Gender Reveal"}
                          </span>
                          <h3 className="font-nunito font-extrabold text-lg text-gray-900 mt-1">{reveal.parentName || "Untitled Reveal"}</h3>
                          <span className="text-xs text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {formatRevealDate(reveal.revealAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          getRevealVideoStatus(reveal) === "ready" 
                            ? "bg-purple-100 text-purple-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {getRevealVideoLabel(reveal)}
                        </span>
                        
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          editable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                        }`}>
                          {!editable && <ShieldAlert className="w-3 h-3 shrink-0" />}
                          {editWindowText(reveal)}
                        </span>

                        {editable && !isEditing && (
                          <button
                            onClick={() => startEditingReveal(reveal)}
                            className="border border-gray-200 text-[#374151] hover:bg-gray-50 font-bold text-xs uppercase tracking-wider rounded-lg px-3.5 py-2 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                        )}

                        <button
                          onClick={() => joinParty(reveal.id)}
                          disabled={openingPartyId === reveal.id}
                          className="bg-[#3A9FE8] text-white hover:bg-[#2E7DD1] active:scale-[0.98] transition-all font-bold text-xs uppercase tracking-wider rounded-lg px-3.5 py-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                        >
                          {openingPartyId === reveal.id ? "Opening..." : "Join Party"}
                        </button>
                      </div>
                    </div>

                    {/* View Details Grid */}
                    {!isEditing && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                          <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Reveal Mode</span>
                          <span className="text-xs font-semibold text-gray-800">{reveal.mode === "announcement" ? "Announcement" : "Reveal"}</span>
                        </div>
                        <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                          <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Reveal Time</span>
                          <span className="text-xs font-semibold text-gray-800">{formatRevealDate(reveal.revealAt)}</span>
                        </div>
                        <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                          <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Selected Timezone</span>
                          <span className="text-xs font-semibold text-gray-800 truncate block">{reveal.revealTimezone}</span>
                        </div>
                        <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                          <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider mb-0.5">Payment Status</span>
                          <span className="text-xs font-bold text-gray-800">{getPaymentStatusLabel(reveal.paymentStatus)}</span>
                        </div>
                      </div>
                    )}

                    {/* Edit Form Sub-section */}
                    {isEditing && editForm && (
                      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 md:p-6 space-y-6 animate-fade-up">
                        <div className="flex gap-3 pb-2 border-b border-gray-200/50">
                          <button
                            type="button"
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${
                              editForm.mode === "reveal"
                                ? "bg-white border-[#E8449A] text-[#C2527A] shadow-sm"
                                : "bg-transparent border-gray-200 text-gray-500"
                            }`}
                            onClick={() => updateEditForm("mode", "reveal")}
                          >
                            Gender Reveal
                          </button>
                          <button
                            type="button"
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${
                              editForm.mode === "announcement"
                                ? "bg-white border-[#3A9FE8] text-[#1B4F8C] shadow-sm"
                                : "bg-transparent border-gray-200 text-gray-500"
                            }`}
                            onClick={() => updateEditForm("mode", "announcement")}
                          >
                            Announcement
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Parent Name(s)</label>
                            <input
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                              value={editForm.parentName}
                              onChange={(e) => updateEditForm("parentName", e.target.value)}
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reveal Date & Time</label>
                            <input
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                              type="datetime-local"
                              value={editForm.revealAt}
                              onChange={(e) => updateEditForm("revealAt", e.target.value)}
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Timezone</label>
                            <input
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                              value={editForm.revealTimezone}
                              onChange={(e) => updateEditForm("revealTimezone", e.target.value)}
                            />
                          </div>
                        </div>

                        {editForm.mode === "announcement" ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gender Update</label>
                              <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] appearance-none"
                                value={editForm.announcementGender}
                                onChange={(e) =>
                                  updateEditForm("announcementGender", e.target.value as "" | GenderValue)
                                }
                              >
                                <option value="">Keep current gender</option>
                                <option value="boy">Boy</option>
                                <option value="girl">Girl</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Revealer Email</label>
                              <input
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                                type="email"
                                value={editForm.revealerEmail}
                                onChange={(e) => updateEditForm("revealerEmail", e.target.value)}
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Relation</label>
                              <select
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                                value={editForm.revealerRelation}
                                onChange={(e) =>
                                  updateEditForm("revealerRelation", e.target.value as RevealerRelation)
                                }
                              >
                                {(Object.keys(RELATION_LABELS) as RevealerRelation[]).map((key) => (
                                  <option key={key} value={key}>
                                    {RELATION_LABELS[key]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}



                        {/* Edit Form Actions */}
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={saveRevealEdits}
                            disabled={savingReveal}
                            className="bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white hover:opacity-90 active:scale-[0.98] transition-all font-bold text-xs uppercase tracking-wider rounded-xl py-3 px-5 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                          >
                            {savingReveal ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            className="border border-gray-200 text-[#374151] hover:bg-gray-100 font-bold text-xs uppercase tracking-wider rounded-xl py-3 px-5 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                            onClick={() => {
                              setEditingRevealId(null);
                              setEditForm(null);
                              setEditPhotoFiles([]);
                            }}
                            disabled={savingReveal}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          hasPlan && (
            <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-[20px] p-10 text-center shadow-sm">
              <Sparkles className="w-12 h-12 text-[#E8449A] mx-auto mb-4 animate-bounce" />
              <h3 className="font-nunito font-extrabold text-xl text-gray-900 mb-1">Create your first reveal event</h3>
              <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto mb-6">
                Tell us about your little one, configure invite codes, dates, and send your mid-wife or secure revealer link to play a cinematic reveal.
              </p>
              {canCreateReveal ? (
                <button
                  onClick={startNewReveal}
                  className="bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white font-extrabold hover:opacity-95 rounded-xl py-3 px-6 text-xs uppercase tracking-wider transition-all animate-pulse focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                >
                  ✦ Start New Reveal
                </button>
              ) : (
                <p className="text-xs text-red-500 font-bold">Please check your active plans below to activate purchase slots.</p>
              )}
            </div>
          )
        )}

        {/* Guest Invites Portal */}
        {latestReveal && (
          <section className="space-y-6">
            <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-2xl p-4 shadow-sm mb-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Users className="w-4 h-4 text-[#3A9FE8]" />
                Invite Guests
              </h2>
              <p className="text-xs text-gray-600 font-semibold mt-1">
                Invite your guests by adding their phone number, email or both! We’ll send them a secure invite link.
              </p>
            </div>

            <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-[20px] p-6 md:p-8 shadow-sm space-y-6">


              {guestImportSummary && (
                <div className="bg-blue-50 border border-blue-100 text-[#1B4F8C] text-xs font-semibold rounded-xl p-4">
                  📋 {guestImportSummary.fileName}: {guestImportSummary.added} row(s) in table,{" "}
                  {guestImportSummary.invalid} invalid, {guestImportSummary.duplicates} duplicate.
                </div>
              )}

              {/* Input Table */}
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 font-bold text-gray-400 uppercase text-[10px] tracking-wider">
                      <th className="p-4">Name</th>
                      <th className="p-4">Phone Number</th>
                      <th className="p-4">Email</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {guestDraftRows.map((row) => (
                      <tr key={row.rowId}>
                        <td className="p-3">
                          <input
                            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] w-full font-medium transition-all"
                            value={row.name}
                            onChange={(e) => updateGuestDraft(row.rowId, "name", e.target.value)}
                            placeholder="Guest name"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] w-full font-medium transition-all"
                            value={row.phone}
                            onChange={(e) => updateGuestDraft(row.rowId, "phone", e.target.value)}
                            placeholder="Phone number"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] w-full font-medium transition-all"
                            type="email"
                            value={row.email}
                            onChange={(e) => updateGuestDraft(row.rowId, "email", e.target.value)}
                            placeholder="guest@example.com"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeGuestDraft(row.rowId)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label="Remove guest"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pt-6 border-t border-gray-100">
                {/* Left group: Add Guest Row */}
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setGuestDraftRows((rows) => [...rows, makeGuestRow()])}
                    className="w-full md:w-auto bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white hover:opacity-95 font-bold text-xs uppercase tracking-wider rounded-xl py-3 px-5 transition-all shadow-sm flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                  >
                    <Plus className="w-4 h-4" />
                    Add Guest Row
                  </button>
                  <span className="text-xs text-gray-400 font-medium text-center md:text-left">
                    Add one guest at a time to your list.
                  </span>
                </div>

                {/* Right group: Submit & Send Links */}
                <div className="flex flex-col gap-2 w-full md:w-auto md:items-end">
                  <button
                    type="button"
                    onClick={() => sendGuestInvites(latestReveal.id)}
                    disabled={sendingInvites}
                    className="w-full md:w-auto bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white hover:opacity-95 font-bold text-xs uppercase tracking-wider rounded-xl py-3.5 px-6 disabled:opacity-50 transition-all shadow-md shadow-[#e8449a0c] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                  >
                    {sendingInvites ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        ✦ Submit &amp; Send Links
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-gray-400 font-medium text-center md:text-right w-full md:max-w-xs leading-normal">
                    The account email also receives a copy of the host party link automatically.
                  </span>
                </div>
              </div>

              {/* Sent Invites List */}
              {guestRows.length > 0 && (
                <div className="border-t border-gray-100 pt-6 space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sent Invites</h3>
                  
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs md:text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 font-bold text-gray-400 uppercase text-[10px] tracking-wider">
                          <th className="p-4">Name</th>
                          <th className="p-4">Phone</th>
                          <th className="p-4">Email</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Prediction</th>
                          <th className="p-4">Message</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white text-gray-700 font-medium">
                        {guestRows.map((guest) => (
                          <tr key={guest.guestId}>
                            <td className="p-4 flex items-center gap-2">
                              {guest.name}
                              {guest.isHost && (
                                <span className="bg-blue-50 text-[#1B4F8C] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                  Host
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-gray-500">{guest.phone || "-"}</td>
                            <td className="p-4 text-gray-500">{guest.email}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                guest.responded ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                              }`}>
                                {guest.responded ? "Responded" : "Pending"}
                              </span>
                            </td>
                            <td className="p-4 font-semibold">
                              {revealUnlocked ? (
                                guest.prediction === "boy" ? "💙 Boy" : guest.prediction === "girl" ? "🩷 Girl" : "-"
                              ) : (
                                <span className="text-gray-300 italic font-normal">Locked</span>
                              )}
                            </td>
                            <td className="p-4 max-w-[200px] truncate text-gray-500">
                              {revealUnlocked ? guest.message || "-" : guest.hasMessage ? "🔐 Locked" : "-"}
                            </td>
                            <td className="p-4 text-right flex items-center justify-end gap-2">
                              <button
                                onClick={() => manageGuest(guest.guestId, "resend", latestReveal.id)}
                                className="border border-gray-200 text-[#374151] hover:bg-gray-50 font-bold text-xs uppercase tracking-wider rounded-lg px-2.5 py-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
                              >
                                Resend
                              </button>
                              {/* Hidden from UI as requested, but keeping functionality intact */}
                              <button
                                onClick={() => manageGuest(guest.guestId, "revoke", latestReveal.id)}
                                className="hidden"
                              >
                                Revoke
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Reveals Loading State */}
        {revealsLoading && reveals.length === 0 && hasPlan && (
          <div className="text-center text-xs text-gray-400 font-bold py-12">Loading your reveals...</div>
        )}

        {/* Pricing/Plans Grid Sections */}
        {!hasPlan && reveals.length === 0 && (
          <PlanSection
            title="Choose Your Plan"
            plans={PLANS}
            activatingPlan={activatingPlan}
            onSelect={requestPlanCheckout}
          />
        )}

        {activePlan === "basic" && reveals.length === 0 && (
          <PlanSection
            title="Unlock More"
            plans={PLANS.filter((p) => p.id !== "basic")}
            activatingPlan={activatingPlan}
            onSelect={requestPlanCheckout}
            upgrade
          />
        )}

        {hasPlan && !canCreateReveal && (
          <PlanSection
            title="Need Another Reveal?"
            plans={PLANS.filter((p) => p.id !== "basic")}
            activatingPlan={activatingPlan}
            onSelect={requestPlanCheckout}
          />
        )}
      </div>
    </DashboardShell>
  );
}

// ─── Payment prompts & plan blocks ──────────────────────────

function PaymentGatewayPrompt({
  plan,
  onProceed,
  onCancel,
}: {
  plan: PlanDefinition;
  onProceed: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-2xl p-6 md:p-8 max-w-md w-full animate-fade-up">
        <span className="text-[10px] font-bold text-[#E8449A] uppercase tracking-widest block mb-1">Payment Gateway</span>
        <h2 id="payment-prompt-title" className="font-nunito font-extrabold text-xl text-gray-900 mb-3">
          Taking you to payment gateway
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed font-semibold mb-6">
          You selected the <strong className="text-gray-800">{plan.name}</strong> for <strong className="text-gray-800">{plan.priceLabel}</strong>. Proceed to secure Stripe Checkout or cancel to return to the pricing plans.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="border border-gray-200 text-[#374151] hover:bg-gray-50 rounded-xl py-2.5 px-4 font-bold text-xs uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white hover:opacity-90 active:scale-[0.98] rounded-xl py-2.5 px-4 font-bold text-xs shadow-md tracking-wider uppercase transition-all focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
            onClick={onProceed}
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanSection({
  title,
  plans,
  activatingPlan,
  onSelect,
  upgrade,
}: {
  title: string;
  plans: PlanDefinition[];
  activatingPlan: string | null;
  onSelect: (plan: PlanDefinition) => void;
  upgrade?: boolean;
}) {
  return (
    <section className="space-y-6">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#f1f1f5] pb-3 mb-1 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#E8449A]" />
        {title}
      </h2>

      {upgrade && (
        <div className="bg-gradient-to-r from-[#FDE8F2] to-[#D6EAFE] border border-white rounded-2xl p-5 shadow-sm text-sm text-gray-700 leading-relaxed font-semibold">
          🎉 You are on the Freemium plan. Upgrade anytime for a cinematic reveal experience!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
        {plans.map((plan) => {
          const isPremium = plan.id === "premium";
          const isCustom = plan.id === "custom";
          return (
            <div
              key={plan.id}
              className={`relative bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-[20px] p-6 shadow-sm flex flex-col justify-between transition-all duration-200 ${
                isPremium
                  ? "border-[#E8449A] ring-2 ring-[#E8449A]/10 scale-100 lg:scale-[1.02]"
                  : "border-white/60"
              }`}
            >
              {isPremium && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white text-[9px] font-bold tracking-widest uppercase py-1 px-3 rounded-full shadow-sm">
                  Most Popular
                </div>
              )}

              <div>
                <h3 className="font-nunito font-extrabold text-xl text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex flex-col mb-4">
                  {plan.id === "basic" && (
                    <span className="text-xs line-through text-gray-400 font-bold mb-1">$29.99</span>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-gray-900">
                      {plan.id === "basic" ? "Free" : `$${(plan.priceCents / 100).toFixed(2)}`}
                    </span>
                    {plan.priceCents > 0 && (
                      <span className="text-xs text-gray-400 font-semibold ml-0.5">one-time</span>
                    )}
                  </div>
                  {plan.id === "basic" && (
                    <span className="text-[10px] text-[#E8449A] font-bold mt-1.5 uppercase tracking-wider">Free for a limited time</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed font-semibold mb-5">{plan.description}</p>
                <div className="border-t border-gray-100 my-4" />
                
                <ul className="space-y-2.5 mb-6 text-xs text-gray-600 font-semibold">
                  <li className="flex items-center gap-2">
                    <span className="text-[#3A9FE8]">✓</span>
                    {plan.revealsGranted} reveal{plan.revealsGranted === 1 ? "" : "s"}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#3A9FE8]">✓</span>
                    Secure revealer link
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#3A9FE8]">✓</span>
                    Live broadcast to guests
                  </li>
                  {isPremium && (
                    <li className="flex items-center gap-2 text-[#E8449A]">
                      <span className="text-[#E8449A]">★</span>
                      Custom cinematic video
                    </li>
                  )}
                  {isCustom && (
                    <li className="flex items-center gap-2 text-[#3A9FE8]">
                      <span className="text-[#3A9FE8]">★</span>
                      Fully tailored assets
                    </li>
                  )}
                </ul>
              </div>

              <button
                type="button"
                disabled={!!activatingPlan}
                onClick={() => onSelect(plan)}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
                  isPremium
                    ? "bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white shadow-md hover:opacity-95"
                    : "border border-gray-200 text-[#374151] hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]`}
              >
                {activatingPlan === plan.id
                  ? "Activating..."
                  : plan.priceCents === 0
                  ? `Choose ${plan.name}`
                  : `Buy ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Shell Export ───────────────────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafafd] flex items-center justify-center font-jakarta">
        <p className="text-gray-400 text-xs font-bold animate-pulse">Loading dashboard view…</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
