"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { uploadPhotos, validatePhotoFiles } from "@/lib/storageService";
import {
  PHOTO_MAX,
  PLANS,
  type EnquiryMode,
  type GenderValue,
  type PlanDefinition,
  type RevealerRelation,
} from "@/lib/types";

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
  dueDate: string;
  announcementGender: "" | GenderValue;
  revealerEmail: string;
  revealerRelation: RevealerRelation;
  revealAt: string;
  revealTimezone: string;
  dueDate: string | null;
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
  const colors = { success: "#16a34a", error: "#dc2626", info: "#2563eb" };
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="dash-toast" style={{ borderLeftColor: colors[type] }}>
      <span style={{ color: colors[type], fontWeight: 700 }}>
        {type === "success" ? "OK" : type === "error" ? "!" : "i"}
      </span>
      <span>{message}</span>
      <button onClick={onClose} aria-label="Close notification">
        x
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
  if (!d) return "-";
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

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "Pending Payment",
    awaiting_revealer: "Awaiting Revealer",
    revealer_confirmed: "Revealer Confirmed",
    video_ready: "Video Ready",
    scheduled: "Scheduled",
    live: "Live",
    completed: "Completed",
  };
  return map[status] || status;
}

function statusTone(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "gray",
    awaiting_revealer: "yellow",
    revealer_confirmed: "blue",
    video_ready: "purple",
    scheduled: "blue",
    live: "red",
    completed: "green",
  };
  return map[status] || "gray";
}

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
          status: data.status ?? "pending_payment",
          genderStatus: data.genderStatus ?? "not_submitted",
          photos: Array.isArray(data.photos) ? data.photos.filter(Boolean) : [],
          createdAt: timestampToDate(data.createdAt),
          videoUrl: typeof data.videoUrl === "string" ? data.videoUrl : null,
          videoReady: Boolean(data.videoUrl) || Boolean(data?.stages?.videoGenerated),
        };
      });
      setReveals(items);
    } catch (err) {
      console.error("Failed to load reveals:", err);
      setToast({ type: "error", message: "Failed to load your reveals." });
    } finally {
      setRevealsLoading(false);
    }
  }, [user]);

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
    } else if (searchParams.get("noEntitlement") === "1") {
      setToast({ message: "Please choose a plan before creating a reveal.", type: "info" });
      router.replace("/dashboard");
    }
  // handleSelectPlan is intentionally omitted so dashboard checkout links only run once per URL change.
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
      setGuestDraftRows([blankGuestRow()]);
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
      message: plan.priceCents > 0 ? "Taking you to the payment gateway..." : "Activating your free plan...",
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
      dueDate: reveal.dueDate ? new Date(reveal.dueDate).toISOString().slice(0,10) : "",
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
    <>
      <style>{CSS}</style>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {pendingPaymentPlan && (
        <PaymentGatewayPrompt
          plan={pendingPaymentPlan}
          onProceed={proceedToPaymentGateway}
          onCancel={cancelPaymentPrompt}
        />
      )}

      <div className="dash-root">
        <header className="dash-header">
          <a href="/" className="dash-logo">
            Virtual Gender Reveal
            <span className="logo-tag">Crafted for Moments That Matter</span>
          </a>
          <div className="dash-user">
            <div className="dash-avatar">{firstName.charAt(0).toUpperCase()}</div>
            <span className="dash-user-name">{user.displayName || user.email}</span>
            <button className="btn-ghost-sm" onClick={() => router.push("/settings")}>
              Settings
            </button>
            <button
              className="btn-ghost-sm"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await logout();
                  router.push("/");
                } catch {
                  setLoggingOut(false);
                }
              }}
            >
              {loggingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </header>

        <main className="dash-main">
          <section className="welcome">
            <p className="welcome-tag">Your Dashboard</p>
            <h1 className="welcome-title">
              Hello, <em>{firstName}</em>
            </h1>
            <p className="welcome-sub">
              {!hasPlan && "Choose a plan to get started creating your reveal."}
              {hasPlan && canCreateReveal && reveals.length === 0 && "You're all set. Let's create your reveal."}
              {hasPlan && canCreateReveal && reveals.length > 0 && "Your reveal details, guests, and plans are here."}
              {hasPlan && !canCreateReveal && reveals.length > 0 && "Your reveal details, guests, and plans are here."}
            </p>
            {hasPlan && (
              <div className="plan-badge">
                <span className="plan-badge-dot" />
                Active Plan: <strong>{PLANS.find((p) => p.id === activePlan)?.name ?? activePlan}</strong>
                <span className="plan-badge-sep">/</span>
                <span>{revealsAllowed} remaining</span>
                <span className="plan-badge-sep">/</span>
                <span>{revealsCreated} created</span>
              </div>
            )}
          </section>

          {hasPlan && canCreateReveal && (
            <section className="cta-card">
              <div className="cta-card-inner">
                <div>
                  <p className="section-label">Ready When You Are</p>
                  <h2 className="cta-title">Create Your Reveal</h2>
                  <p className="cta-desc">
                    Start a new reveal, send a secure revealer link, and bring guests into the party room.
                  </p>
                </div>
                <button className="btn-primary-lg" onClick={startNewReveal} disabled={startingReveal}>
                  {startingReveal ? "Checking payment..." : "Start New Reveal"}
                </button>
              </div>
            </section>
          )}

          {reveals.length > 0 && (
            <section className="portal-section">
              <p className="section-label">Your Reveals</p>
              <div className="reveal-stack">
                {reveals.map((reveal) => {
                  const editable = canEditReveal(reveal);
                  const isEditing = editingRevealId === reveal.id && editForm;
                  return (
                    <article key={reveal.id} className="detail-panel">
                      <div className="detail-panel-header">
                        <div className="detail-title-wrap">
                          <div className="reveal-photo">
                            {reveal.photos[0] ? (
                              <img src={reveal.photos[0]} alt="" />
                            ) : (
                              <div className="reveal-photo-placeholder">No photo</div>
                            )}
                          </div>
                          <div>
                            <div className="reveal-mode-tag">
                              {reveal.mode === "announcement" ? "Announcement" : "Gender Reveal"}
                            </div>
                            <h2 className="detail-title">{reveal.parentName || "Untitled reveal"}</h2>
                            <p className="detail-sub">{formatRevealDate(reveal.revealAt)}</p>
                          </div>
                        </div>
                        <div className="detail-actions">
                          <span className={`status-pill ${statusTone(reveal.status)}`}>
                            {statusLabel(reveal.status)}
                          </span>
                          <span className={`edit-pill ${editable ? "open" : "locked"}`}>
                            {editWindowText(reveal)}
                          </span>
                          {editable && !isEditing && (
                            <button className="btn-ghost-sm" onClick={() => startEditingReveal(reveal)}>
                              Edit Details
                            </button>
                          )}
                          <button className="btn-ghost-sm" onClick={() => joinParty(reveal.id)} disabled={openingPartyId === reveal.id}>
                            {openingPartyId === reveal.id ? "Opening..." : "Join Party"}
                          </button>
                        </div>
                      </div>

                      {!isEditing && (
                        <div className="detail-grid">
                          <div>
                            <span>Mode</span>
                            <strong>{reveal.mode === "announcement" ? "Announcement" : "Reveal"}</strong>
                          </div>
                          <div>
                            <span>Reveal Time</span>
                            <strong>{formatRevealDate(reveal.revealAt)}</strong>
                          </div>
                          <div>
                            <span>Timezone</span>
                            <strong>{reveal.revealTimezone}</strong>
                          </div>
                          <div>
                            <span>Photos</span>
                            <strong>{reveal.photos.length}</strong>
                          </div>
                          {reveal.mode === "announcement" ? (
                            <div>
                              <span>Due Date</span>
                              <strong>{reveal.dueDate ? new Date(reveal.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "-"}</strong>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span>Due Date</span>
                                <strong>{reveal.dueDate ? new Date(reveal.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "-"}</strong>
                              </div>
                              <div>
                                <span>Timezone</span>
                                <strong>{reveal.revealTimezone || "-"}</strong>
                              </div>
                              <div>
                                <span>Revealer</span>
                                <strong>{reveal.revealerEmail || "-"}</strong>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {isEditing && editForm && (
                        <div className="edit-form">
                          <div className="mode-row">
                            <button
                              type="button"
                              className={`mode-chip${editForm.mode === "reveal" ? " selected" : ""}`}
                              onClick={() => updateEditForm("mode", "reveal")}
                            >
                              Gender Reveal
                            </button>
                            <button
                              type="button"
                              className={`mode-chip${editForm.mode === "announcement" ? " selected" : ""}`}
                              onClick={() => updateEditForm("mode", "announcement")}
                            >
                              Announcement
                            </button>
                          </div>

                          <div className="form-grid">
                            <label>
                              <span>Parent Name(s)</span>
                              <input
                                value={editForm.parentName}
                                onChange={(e) => updateEditForm("parentName", e.target.value)}
                              />
                            </label>
                            <label>
                              <span>Reveal Date & Time</span>
                              <input
                                type="datetime-local"
                                value={editForm.revealAt}
                                onChange={(e) => updateEditForm("revealAt", e.target.value)}
                              />
                            </label>
                            <label>
                              <span>Timezone</span>
                              <input
                                value={editForm.revealTimezone}
                                onChange={(e) => updateEditForm("revealTimezone", e.target.value)}
                              />
                            </label>
                          </div>

                          {editForm.mode === "announcement" ? (
                            <div className="form-grid">
                              <label>
                                <span>Due Date</span>
                                <input type="date" value={editForm.dueDate} onChange={(e) => updateEditForm("dueDate", e.target.value)} />
                              </label>
                              <label>
                                <span>Gender Update</span>
                                <select
                                  value={editForm.announcementGender}
                                  onChange={(e) =>
                                    updateEditForm("announcementGender", e.target.value as "" | GenderValue)
                                  }
                                >
                                  <option value="">Keep current gender</option>
                                  <option value="boy">Boy</option>
                                  <option value="girl">Girl</option>
                                </select>
                              </label>
                            </div>
                          ) : (
                            <div className="form-grid">
                              <label>
                                <span>Due Date</span>
                                <input type="date" value={editForm.dueDate} onChange={(e) => updateEditForm("dueDate", e.target.value)} />
                              </label>
                              <label>
                                <span>Revealer Email</span>
                                <input
                                  type="email"
                                  value={editForm.revealerEmail}
                                  onChange={(e) => updateEditForm("revealerEmail", e.target.value)}
                                />
                              </label>
                              <label>
                                <span>Relation</span>
                                <select
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
                              </label>
                            </div>
                          )}

                          <div className="photo-edit-row">
                            <div>
                              <span className="mini-label">Current Photos</span>
                              <div className="photo-strip">
                                {editForm.photos.length === 0 && <span className="empty-note">None selected</span>}
                                {editForm.photos.map((url, index) => (
                                  <div key={url} className="photo-thumb">
                                    <img src={url} alt="" />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateEditForm(
                                          "photos",
                                          editForm.photos.filter((_, i) => i !== index)
                                        )
                                      }
                                    >
                                      x
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <label className="file-input-label">
                              <span>Replace Photos</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
                                multiple
                                onChange={(e) => setEditPhotoFiles(Array.from(e.target.files || []).slice(0, PHOTO_MAX))}
                              />
                              <small>
                                {editPhotoFiles.length > 0
                                  ? `${editPhotoFiles.length} new file(s) selected`
                                  : `Optional, up to ${PHOTO_MAX}`}
                              </small>
                            </label>
                          </div>

                          <div className="edit-actions">
                            <button className="btn-primary-lg" onClick={saveRevealEdits} disabled={savingReveal}>
                              {savingReveal ? "Saving..." : "Save Changes"}
                            </button>
                            <button
                              className="btn-ghost-sm"
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
          )}

          {latestReveal && (
            <section className="portal-section">
              <p className="section-label">Invite Guests</p>
              <div className="invite-panel">
                <div className="invite-toolbar">
                  <label className="upload-button">
                    Import CSV/XLSX
                    <input
                      type="file"
                      accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleGuestFile(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button className="btn-ghost-sm" onClick={() => setGuestDraftRows((rows) => [...rows, makeGuestRow()])}>
                    Add Guest Row
                  </button>
                  <button className="btn-ghost-sm" onClick={() => loadGuestList(latestReveal.id)}>
                    Refresh List
                  </button>
                  <button className="btn-ghost-sm" onClick={() => sendGuestDigest(latestReveal.id)}>
                    Send Parent Digest
                  </button>
                </div>

                {guestImportSummary && (
                  <div className="import-summary">
                    {guestImportSummary.fileName}: {guestImportSummary.added} row(s) in table,
                    {guestImportSummary.invalid} invalid, {guestImportSummary.duplicates} duplicate.
                  </div>
                )}

                <div className="table-wrap">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Number</th>
                        <th>Email</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {guestDraftRows.map((row) => (
                        <tr key={row.rowId}>
                          <td>
                            <input
                              value={row.name}
                              onChange={(e) => updateGuestDraft(row.rowId, "name", e.target.value)}
                              placeholder="Guest name"
                            />
                          </td>
                          <td>
                            <input
                              value={row.phone}
                              onChange={(e) => updateGuestDraft(row.rowId, "phone", e.target.value)}
                              placeholder="Phone number"
                            />
                          </td>
                          <td>
                            <input
                              type="email"
                              value={row.email}
                              onChange={(e) => updateGuestDraft(row.rowId, "email", e.target.value)}
                              placeholder="guest@example.com"
                            />
                          </td>
                          <td>
                            <button className="btn-ghost-sm" onClick={() => removeGuestDraft(row.rowId)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="invite-submit-row">
                  <button className="btn-primary-lg" onClick={() => sendGuestInvites(latestReveal.id)} disabled={sendingInvites}>
                    {sendingInvites ? "Sending..." : "Submit & Send Links"}
                  </button>
                  <span>The account email also receives a host party link.</span>
                </div>

                {guestRows.length > 0 && (
                  <div className="sent-list">
                    <h3>Sent Invites</h3>
                    <div className="table-wrap">
                      <table className="portal-table readonly">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Number</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Prediction</th>
                            <th>Message</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {guestRows.map((guest) => (
                            <tr key={guest.guestId}>
                              <td>
                                {guest.name}
                                {guest.isHost && <span className="host-badge">Host</span>}
                              </td>
                              <td>{guest.phone || "-"}</td>
                              <td>{guest.email}</td>
                              <td>
                                {guest.responded ? "Responded" : "Pending"} ({guest.inviteStatus})
                              </td>
                              <td>{revealUnlocked ? guest.prediction || "-" : "Locked"}</td>
                              <td>{revealUnlocked ? guest.message || "-" : guest.hasMessage ? "Locked" : "-"}</td>
                              <td>
                                <button className="btn-ghost-sm" onClick={() => manageGuest(guest.guestId, "resend", latestReveal.id)}>
                                  Resend
                                </button>
                                <button className="btn-ghost-sm" onClick={() => manageGuest(guest.guestId, "revoke", latestReveal.id)}>
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

          {revealsLoading && reveals.length === 0 && hasPlan && (
            <div className="reveals-loading">Loading your reveals...</div>
          )}

          {!hasPlan && (
            <PlanSection
              title="Choose Your Plan"
              plans={PLANS}
              activatingPlan={activatingPlan}
              onSelect={requestPlanCheckout}
            />
          )}

          {activePlan === "basic" && (
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
        </main>
      </div>
    </>
  );
}

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
    <div className="payment-prompt-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-prompt-title">
      <div className="payment-prompt-card">
        <p className="section-label">Payment Gateway</p>
        <h2 id="payment-prompt-title" className="payment-prompt-title">
          Taking you to payment gateway
        </h2>
        <p className="payment-prompt-copy">
          You selected the {plan.name} plan for {plan.priceLabel}. Proceed to secure Stripe Checkout or cancel to return to the pricing plans.
        </p>
        <div className="payment-prompt-actions">
          <button type="button" className="btn-ghost-sm" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary-sm" onClick={onProceed}>
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
    <section className="portal-section">
      <p className="section-label">{title}</p>
      {upgrade && (
        <div className="notice-panel">
          You are on the Spark plan. Upgrade anytime for a cinematic reveal experience.
        </div>
      )}
      <div className="plans-grid">
        {plans.map((plan) => (
          <div key={plan.id} className={`plan-card${plan.id === "premium" ? " plan-popular" : ""}`}>
            {plan.id === "premium" && <div className="plan-badge-top">Most Popular</div>}
            <div className="plan-name">{plan.name}</div>
            <div className="plan-price">
              <span className="plan-curr">{plan.priceCents === 0 ? "" : "$"}</span>
              <span className="plan-amount">
                {plan.priceCents === 0 ? "Free" : (plan.priceCents / 100).toFixed(0)}
              </span>
              {plan.priceCents > 0 && <span className="plan-per"> one-time</span>}
            </div>
            <p className="plan-desc">{plan.description}</p>
            <div className="plan-divider" />
            <ul className="plan-feats">
              <li>{plan.revealsGranted} reveal{plan.revealsGranted === 1 ? "" : "s"}</li>
              <li>Secure revealer link</li>
              <li>Live broadcast to guests</li>
              {plan.id === "premium" && <li>Custom cinematic video</li>}
              {}
            </ul>
            <button
              className={`plan-btn${plan.id === "premium" ? " plan-btn-primary" : ""}`}
              onClick={() => onSelect(plan)}
              disabled={!!activatingPlan}
            >
              {activatingPlan === plan.id ? "Activating..." : plan.priceCents === 0 ? `Choose ${plan.name}` : `Buy ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f6f4f1" }} />}>
      <DashboardContent />
    </Suspense>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
@keyframes slideIn{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:translateX(0);}}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#f6f4f1;color:#171717;min-height:100vh;}
button,input,select{font-family:'Plus Jakarta Sans',sans-serif;}
.dash-root{min-height:100vh;}
.dash-header{position:sticky;top:0;z-index:50;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 2rem;background:rgba(246,244,241,0.92);backdrop-filter:blur(14px);border-bottom:1px solid rgba(0,0,0,0.08);}
.dash-logo{font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:400;color:#111827;text-decoration:none;line-height:1.2;}
.logo-tag{display:block;font-size:0.58rem;font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:0.22em;text-transform:uppercase;color:#b5476d;font-weight:400;}
.dash-user{display:flex;align-items:center;gap:0.7rem;}
.dash-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2e7dd1,#c2527a);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:600;flex-shrink:0;}
.dash-user-name{font-size:0.82rem;color:#6b7280;display:none;}
@media(min-width:760px){.dash-user-name{display:inline;}}
.dash-main{max-width:1180px;margin:0 auto;padding:3rem 2rem 4rem;}
.welcome{margin-bottom:2.4rem;}
.welcome-tag,.section-label{font-size:0.68rem;letter-spacing:0.32em;text-transform:uppercase;color:#b5476d;font-weight:600;margin-bottom:0.8rem;}
.welcome-title{font-family:'Playfair Display',serif;font-size:2.8rem;font-weight:300;color:#111827;line-height:1.12;margin-bottom:0.6rem;}
.welcome-title em{font-style:italic;color:#1b4f8c;}
.welcome-sub{font-size:0.95rem;font-weight:300;color:#6b7280;line-height:1.7;max-width:620px;margin-bottom:1.2rem;}
.plan-badge{display:inline-flex;align-items:center;gap:0.5rem;flex-wrap:wrap;padding:0.5rem 1rem;background:white;border:1px solid rgba(0,0,0,0.08);border-radius:999px;font-size:0.82rem;color:#374151;box-shadow:0 1px 4px rgba(0,0,0,0.04);}
.plan-badge strong{color:#1b4f8c;font-weight:600;}
.plan-badge-dot{width:8px;height:8px;border-radius:50%;background:#16a34a;box-shadow:0 0 10px rgba(22,163,74,0.5);}
.plan-badge-sep{color:#d1d5db;}
.portal-section{margin-bottom:2.2rem;}
.section-label{display:flex;align-items:center;gap:0.9rem;color:#8a8f98;}
.section-label::after{content:'';flex:1;height:1px;background:rgba(0,0,0,0.07);}
.cta-card{background:linear-gradient(135deg,#143d6e 0%,#2e7dd1 58%,#c2527a 100%);border-radius:8px;padding:2rem 2.2rem;margin-bottom:2.4rem;box-shadow:0 14px 36px rgba(27,79,140,0.18);}
.cta-card-inner{display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap;}
.cta-card .section-label{color:rgba(255,255,255,0.72);margin-bottom:0.5rem;}
.cta-card .section-label::after{background:rgba(255,255,255,0.16);}
.cta-title{font-family:'Playfair Display',serif;font-size:2rem;font-weight:300;color:white;line-height:1.2;margin-bottom:0.5rem;}
.cta-desc{font-size:0.88rem;font-weight:300;color:rgba(255,255,255,0.84);line-height:1.7;max-width:540px;}
.btn-primary-lg{padding:0.9rem 1.5rem;background:#111827;color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.78rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;box-shadow:0 6px 20px rgba(0,0,0,0.12);transition:transform 0.2s,box-shadow 0.2s;white-space:nowrap;}
.btn-primary-lg:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 10px 28px rgba(0,0,0,0.18);}
.btn-primary-lg:disabled{opacity:0.55;cursor:not-allowed;}
.btn-ghost-sm{padding:7px 12px;background:white;border:1px solid rgba(0,0,0,0.12);border-radius:5px;font-size:0.76rem;color:#374151;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
.btn-ghost-sm:hover:not(:disabled){border-color:#2e7dd1;color:#1b4f8c;background:#f8fbff;}
.btn-ghost-sm:disabled{opacity:0.5;cursor:not-allowed;}
.reveal-stack{display:flex;flex-direction:column;gap:0.9rem;}
.detail-panel,.invite-panel,.notice-panel{background:white;border:1px solid rgba(0,0,0,0.08);border-radius:8px;box-shadow:0 1px 8px rgba(0,0,0,0.04);}
.detail-panel{padding:1.2rem;}
.detail-panel-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1.2rem;margin-bottom:1rem;}
.detail-title-wrap{display:flex;align-items:center;gap:1rem;min-width:0;}
.reveal-photo{width:64px;height:64px;border-radius:8px;overflow:hidden;background:#f2f0ed;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.reveal-photo img{width:100%;height:100%;object-fit:cover;}
.reveal-photo-placeholder{font-size:0.68rem;color:#8a8f98;text-align:center;padding:0.4rem;}
.reveal-mode-tag{font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;color:#8a8f98;margin-bottom:0.25rem;}
.detail-title{font-family:'Playfair Display',serif;font-size:1.35rem;font-weight:400;color:#111827;}
.detail-sub{font-size:0.82rem;color:#6b7280;margin-top:0.2rem;}
.detail-actions{display:flex;align-items:center;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap;}
.status-pill,.edit-pill,.host-badge{display:inline-flex;align-items:center;border-radius:999px;padding:0.32rem 0.62rem;font-size:0.7rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;}
.status-pill.gray{background:#f3f4f6;color:#4b5563;}
.status-pill.yellow{background:#fffbeb;color:#92400e;}
.status-pill.blue{background:#eff6ff;color:#1d4ed8;}
.status-pill.purple{background:#f5f3ff;color:#6d28d9;}
.status-pill.red{background:#fef2f2;color:#b91c1c;}
.status-pill.green{background:#ecfdf5;color:#047857;}
.edit-pill.open{background:#eefaf2;color:#15803d;}
.edit-pill.locked{background:#f4f4f5;color:#71717a;}
.detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.75rem;border-top:1px solid rgba(0,0,0,0.06);padding-top:1rem;}
.detail-grid div{background:#faf9f7;border:1px solid rgba(0,0,0,0.05);border-radius:6px;padding:0.8rem;min-width:0;}
.detail-grid span,.mini-label,.edit-form label span,.file-input-label span{display:block;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;color:#8a8f98;font-weight:700;margin-bottom:0.35rem;}
.detail-grid strong{font-size:0.9rem;color:#111827;font-weight:600;word-break:break-word;}
.edit-form{border-top:1px solid rgba(0,0,0,0.06);padding-top:1rem;}
.mode-row{display:flex;gap:0.6rem;margin-bottom:1rem;flex-wrap:wrap;}
.mode-chip{padding:0.75rem 1rem;border:1px solid rgba(0,0,0,0.14);background:white;border-radius:5px;cursor:pointer;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#374151;}
.mode-chip.selected{border-color:#2e7dd1;background:#eff6ff;color:#1b4f8c;}
.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin-bottom:1rem;}
.edit-form input,.edit-form select,.portal-table input{width:100%;border:1px solid rgba(0,0,0,0.12);border-radius:4px;background:white;color:#111827;padding:0.76rem 0.8rem;font-size:0.88rem;outline:none;}
.edit-form input:focus,.edit-form select:focus,.portal-table input:focus{border-color:#2e7dd1;box-shadow:0 0 0 3px rgba(46,125,209,0.1);}
.photo-edit-row{display:grid;grid-template-columns:1fr 260px;gap:1rem;margin:0.5rem 0 1rem;}
.photo-strip{display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;}
.photo-thumb{width:68px;height:68px;border-radius:6px;overflow:hidden;position:relative;background:#f4f4f5;border:1px solid rgba(0,0,0,0.08);}
.photo-thumb img{width:100%;height:100%;object-fit:cover;}
.photo-thumb button{position:absolute;top:4px;right:4px;width:20px;height:20px;border:none;border-radius:50%;background:rgba(17,24,39,0.78);color:white;cursor:pointer;}
.empty-note{font-size:0.84rem;color:#8a8f98;}
.file-input-label{display:block;border:1px dashed rgba(0,0,0,0.2);border-radius:6px;padding:0.8rem;background:#faf9f7;}
.file-input-label input{padding:0;border:none;margin-top:0.4rem;box-shadow:none;}
.file-input-label small{display:block;color:#8a8f98;font-size:0.75rem;margin-top:0.45rem;}
.edit-actions{display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;}
.invite-panel{padding:1rem;}
.invite-toolbar{display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.8rem;}
.upload-button{position:relative;display:inline-flex;align-items:center;justify-content:center;padding:7px 12px;border:1px solid rgba(0,0,0,0.12);border-radius:5px;background:white;color:#374151;cursor:pointer;font-size:0.76rem;font-weight:500;}
.upload-button input{position:absolute;inset:0;opacity:0;cursor:pointer;}
.import-summary{font-size:0.8rem;color:#4b5563;background:#f8fafc;border:1px solid rgba(0,0,0,0.06);border-radius:6px;padding:0.65rem 0.8rem;margin-bottom:0.8rem;}
.table-wrap{overflow-x:auto;}
.portal-table{width:100%;border-collapse:separate;border-spacing:0;font-size:0.84rem;min-width:760px;}
.portal-table th{background:#f5f3f0;color:#6b7280;text-align:left;font-size:0.68rem;letter-spacing:0.13em;text-transform:uppercase;padding:0.72rem;border-top:1px solid rgba(0,0,0,0.07);border-bottom:1px solid rgba(0,0,0,0.07);}
.portal-table td{padding:0.68rem;border-bottom:1px solid rgba(0,0,0,0.06);vertical-align:middle;color:#374151;}
.portal-table th:first-child{border-left:1px solid rgba(0,0,0,0.07);border-top-left-radius:6px;}
.portal-table th:last-child{border-right:1px solid rgba(0,0,0,0.07);border-top-right-radius:6px;}
.portal-table.readonly td{background:white;}
.invite-submit-row{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:1rem;}
.invite-submit-row span{font-size:0.8rem;color:#6b7280;}
.sent-list{margin-top:1.2rem;border-top:1px solid rgba(0,0,0,0.06);padding-top:1rem;}
.sent-list h3{font-size:0.86rem;text-transform:uppercase;letter-spacing:0.16em;color:#6b7280;margin-bottom:0.8rem;}
.host-badge{margin-left:0.45rem;background:#eff6ff;color:#1d4ed8;font-size:0.62rem;padding:0.22rem 0.45rem;}
.notice-panel{padding:1rem 1.1rem;color:#4b5563;font-size:0.9rem;line-height:1.6;margin-bottom:1rem;}
.reveals-loading{text-align:center;color:#8a8f98;padding:2rem;font-size:0.88rem;}
.plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;}
.plan-card{position:relative;background:white;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:1.6rem;box-shadow:0 1px 8px rgba(0,0,0,0.04);}
.plan-popular{border:1.5px solid #2e7dd1;box-shadow:0 10px 28px rgba(46,125,209,0.12);}
.plan-badge-top{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#2e7dd1,#c2527a);color:white;font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;padding:0.3rem 0.8rem;border-radius:999px;font-weight:700;white-space:nowrap;}
.plan-name{font-family:'Playfair Display',serif;font-size:1.35rem;font-weight:400;color:#111827;margin-bottom:0.8rem;}
.plan-price{font-family:'Playfair Display',serif;font-weight:300;color:#111827;margin-bottom:0.6rem;line-height:1;}
.plan-curr{font-size:1.3rem;vertical-align:super;}
.plan-amount{font-size:3rem;}
.plan-per{font-size:0.8rem;font-family:'Plus Jakarta Sans',sans-serif;color:#8a8f98;}
.plan-desc{font-size:0.85rem;color:#6b7280;line-height:1.6;margin-bottom:1.1rem;font-weight:300;}
.plan-divider{height:1px;background:rgba(0,0,0,0.06);margin-bottom:1rem;}
.plan-feats{list-style:none;margin-bottom:1.4rem;}
.plan-feats li{font-size:0.83rem;color:#374151;padding:0.28rem 0;}
.plan-btn{width:100%;padding:0.82rem;background:white;color:#374151;border:1.5px solid rgba(0,0,0,0.12);border-radius:4px;cursor:pointer;font-size:0.76rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;transition:all 0.2s;}
.plan-btn:hover:not(:disabled){border-color:#2e7dd1;color:#1b4f8c;}
.plan-btn-primary{background:linear-gradient(135deg,#2e7dd1,#c2527a);color:white;border:none;box-shadow:0 4px 16px rgba(46,125,209,0.22);}
.plan-btn-primary:hover:not(:disabled){color:white;transform:translateY(-1px);}
.plan-btn:disabled{opacity:0.5;cursor:not-allowed;}
.payment-prompt-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(17,24,39,0.58);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1.5rem;}
.payment-prompt-card{width:min(440px,100%);background:white;border-radius:12px;border:1px solid rgba(0,0,0,0.08);box-shadow:0 24px 70px rgba(0,0,0,0.24);padding:1.8rem;}
.payment-prompt-title{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:300;color:#111827;margin-bottom:0.65rem;}
.payment-prompt-copy{font-size:0.92rem;color:#4b5563;line-height:1.7;margin-bottom:1.4rem;}
.payment-prompt-actions{display:flex;align-items:center;justify-content:flex-end;gap:0.75rem;flex-wrap:wrap;}
.btn-primary-sm{padding:8px 14px;background:#111827;color:white;border:1px solid #111827;border-radius:5px;font-size:0.76rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
.btn-primary-sm:hover{background:#1b4f8c;border-color:#1b4f8c;transform:translateY(-1px);}
.dash-toast{position:fixed;top:20px;right:20px;z-index:9999;background:white;border-left:4px solid #2563eb;border-radius:8px;padding:14px 16px;max-width:390px;display:flex;align-items:flex-start;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,0.12);font-size:14px;animation:slideIn .3s ease-out;}
.dash-toast span:nth-child(2){color:#111827;line-height:1.5;flex:1;}
.dash-toast button{background:none;border:none;color:#8a8f98;cursor:pointer;font-size:14px;}
@media(max-width:900px){
  .detail-panel-header{flex-direction:column;}
  .detail-actions{justify-content:flex-start;}
  .detail-grid,.form-grid,.photo-edit-row{grid-template-columns:1fr;}
}
@media(max-width:640px){
  .dash-header{height:auto;align-items:flex-start;gap:1rem;padding:1rem;flex-direction:column;}
  .dash-user{width:100%;flex-wrap:wrap;}
  .dash-main{padding:2rem 1rem 3rem;}
  .welcome-title{font-size:2.2rem;}
  .cta-card{padding:1.5rem;}
  .btn-primary-lg{width:100%;}
}
`;
