"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "active" | "deleted" | "enquiries";

interface UserRow {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  provider: string;
  activePlan: string;
  role: string;
  status: string;
  isDeleted: boolean;
  emailVerified: boolean;
  revealsAllowed: number;
  revealsCreated: number;
  totalSpentCents: number;
  totalPurchases: number;
  purchases: Array<Record<string, unknown>>;
  createdAt: Date | null;
  lastLogin: Date | null;
}

interface DeletedRow {
  originalUid: string;
  parentName: string | null;
  email: string | null;
  phoneNumber: string | null;
  activePlan: string | null;
  totalPurchases: number;
  totalSpentCents: number;
  revealsAllowed: number;
  revealsCreated: number;
  enquiryCount: number;
  deletedBy: "user" | "admin";
  deletedAt: Date;
  purgeAt: Date;
}

interface EnquiryRow {
  id: string;
  userId: string;
  parentName: string;
  mode: "announcement" | "reveal";
  plan: string | null;
  status: string;
  genderStatus: "submitted" | "not_submitted";
  babyName: string | null;
  babyNameGirl: string | null;
  babyNameBoy: string | null;
  revealerEmail: string | null;
  revealerRelation: string | null;
  revealerName: string | null;
  revealAt: Date | null;
  revealTimezone: string;
  guestCount: number;
  photoCount: number;
  photos: string[];
  stages: {
    paymentReceived: Date | null;
    revealerLinkSent: Date | null;
    revealerSubmitted: Date | null;
    videoGenerated: Date | null;
    guestInvitesSent: Date | null;
    eventScheduled: Date | null;
    eventCompleted: Date | null;
  };
  createdAt: Date | null;
}

const STAGE_LABELS: Array<[keyof EnquiryRow["stages"], string]> = [
  ["paymentReceived", "Payment"],
  ["revealerLinkSent", "Link sent"],
  ["revealerSubmitted", "Revealer in"],
  ["videoGenerated", "Video"],
  ["guestInvitesSent", "Invites"],
  ["eventScheduled", "Scheduled"],
  ["eventCompleted", "Completed"],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tsToDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "object" && v !== null && "toDate" in v) {
    try {
      return (v as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function daysUntil(target: Date): number {
  const ms = target.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, firestoreUser, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>("active");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [deleted, setDeleted] = useState<DeletedRow[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ─── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (firestoreUser && firestoreUser.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, firestoreUser, authLoading, router]);

  // ─── Data fetching ───────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!user || firestoreUser?.role !== "admin") return;
    setLoadingData(true);
    try {
      const db = getFirebaseDb();

      // Users
      const usersSnap = await getDocs(
        query(collection(db, "users"), orderBy("createdAt", "desc"))
      );
      const usersList: UserRow[] = usersSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const purchases = (data.purchases as Array<Record<string, unknown>>) ?? [];
        const completed = purchases.filter((p) => p.status === "completed");
        const totalSpentCents = completed.reduce(
          (sum, p) => sum + ((p.amountPaid as number) ?? 0),
          0
        );
        return {
          uid: d.id,
          email: (data.email as string) ?? "",
          fullName: (data.fullName as string) ?? "",
          phone: (data.phone as string) ?? "",
          provider: (data.provider as string) ?? "",
          activePlan: (data.activePlan as string) ?? "none",
          role: (data.role as string) ?? "user",
          status: (data.status as string) ?? "active",
          isDeleted: (data.isDeleted as boolean) ?? false,
          emailVerified: (data.emailVerified as boolean) ?? false,
          revealsAllowed: (data.revealsAllowed as number) ?? 0,
          revealsCreated: (data.revealsCreated as number) ?? 0,
          totalSpentCents,
          totalPurchases: completed.length,
          purchases,
          createdAt: tsToDate(data.createdAt),
          lastLogin: tsToDate(data.lastLogin),
        };
      });
      setUsers(usersList);

      // Deleted users (shadow records)
      const deletedSnap = await getDocs(
        query(collection(db, "deleted_users"), orderBy("deletedAt", "desc"))
      );
      const deletedList: DeletedRow[] = deletedSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          originalUid: (data.originalUid as string) ?? d.id,
          parentName: (data.parentName as string) ?? null,
          email: (data.email as string) ?? null,
          phoneNumber: (data.phoneNumber as string) ?? null,
          activePlan: (data.activePlan as string) ?? null,
          totalPurchases: (data.totalPurchases as number) ?? 0,
          totalSpentCents: (data.totalSpentCents as number) ?? 0,
          revealsAllowed: (data.revealsAllowed as number) ?? 0,
          revealsCreated: (data.revealsCreated as number) ?? 0,
          enquiryCount: (data.enquiryCount as number) ?? 0,
          deletedBy: (data.deletedBy as "user" | "admin") ?? "admin",
          deletedAt: tsToDate(data.deletedAt) ?? new Date(),
          purgeAt: tsToDate(data.purgeAt) ?? new Date(),
        };
      });
      setDeleted(deletedList);

      // Enquiries
      const enquiriesSnap = await getDocs(
        query(collection(db, "enquiries"), orderBy("createdAt", "desc"))
      );
      const enquiriesList: EnquiryRow[] = enquiriesSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const stages = (data.stages as Record<string, unknown>) ?? {};
        return {
          id: d.id,
          userId: (data.userId as string) ?? "",
          parentName: (data.parentName as string) ?? "—",
          mode: (data.mode as "announcement" | "reveal") ?? "reveal",
          plan: (data.plan as string) ?? null,
          status: (data.status as string) ?? "pending",
          genderStatus:
            (data.genderStatus as "submitted" | "not_submitted") ??
            "not_submitted",
          babyName: (data.babyName as string) ?? null,
          babyNameGirl: (data.babyNameGirl as string) ?? null,
          babyNameBoy: (data.babyNameBoy as string) ?? null,
          revealerEmail: (data.revealerEmail as string) ?? null,
          revealerRelation: (data.revealerRelation as string) ?? null,
          revealerName: (data.revealerName as string) ?? null,
          revealAt: tsToDate(data.revealAt),
          revealTimezone: (data.revealTimezone as string) ?? "UTC",
          guestCount: (data.guestCount as number) ?? 0,
          photoCount: (data.photoCount as number) ?? 0,
          photos: (data.photos as string[]) ?? [],
          stages: {
            paymentReceived: tsToDate(stages.paymentReceived),
            revealerLinkSent: tsToDate(stages.revealerLinkSent),
            revealerSubmitted: tsToDate(stages.revealerSubmitted),
            videoGenerated: tsToDate(stages.videoGenerated),
            guestInvitesSent: tsToDate(stages.guestInvitesSent),
            eventScheduled: tsToDate(stages.eventScheduled),
            eventCompleted: tsToDate(stages.eventCompleted),
          },
          createdAt: tsToDate(data.createdAt),
        };
      });
      setEnquiries(enquiriesList);
    } catch (err) {
      console.error("[admin] Failed to load data:", err);
      alert(
        "Failed to load admin data. Check Firestore rules allow admin reads on users, enquiries, and deleted_users collections."
      );
    } finally {
      setLoadingData(false);
    }
  }, [user, firestoreUser]);

  useEffect(() => {
    loadAll();
  }, [loadAll, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  // ─── Admin actions ───────────────────────────────────────────────────────
  const callAdminApi = async (
    body: Record<string, unknown>,
    method: "POST" | "PUT" = "POST"
  ): Promise<boolean> => {
    if (!user) return false;
    setActionInProgress(JSON.stringify(body));
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/delete-user", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Action failed.");
        return false;
      }
      return true;
    } catch (err) {
      console.error("[admin] action failed:", err);
      alert("Action failed. Check your connection and try again.");
      return false;
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDisable = async (uid: string) => {
    if (!confirm("Disable this user? They won't be able to log in.")) return;
    const ok = await callAdminApi({ uid, action: "disable" }, "PUT");
    if (ok) {
      refresh();
      setSelectedUser(null);
    }
  };

  const handleEnable = async (uid: string) => {
    if (!confirm("Re-enable this user? Their shadow record will be deleted."))
      return;
    const ok = await callAdminApi({ uid, action: "enable" }, "PUT");
    if (ok) {
      refresh();
      setSelectedUser(null);
    }
  };

  const handleSoftDelete = async (uid: string) => {
    if (
      !confirm(
        "Soft-delete this user? They'll be disabled and a 30-day shadow record kept. Their data stays in Firestore."
      )
    )
      return;
    const ok = await callAdminApi({ uid, hardDelete: false }, "POST");
    if (ok) {
      refresh();
      setSelectedUser(null);
    }
  };

  const handleHardDelete = async (uid: string, email: string) => {
    const confirm1 = confirm(
      `PERMANENTLY DELETE ${email}?\n\nThis will:\n• Delete their auth account\n• Delete all their enquiries\n• Delete all their photos\n• Delete encrypted gender data\n\nA 30-day shadow record will be kept for support/fraud lookup.`
    );
    if (!confirm1) return;
    const confirm2 = prompt(`Type DELETE to confirm hard delete of ${email}`);
    if (confirm2 !== "DELETE") {
      alert("Hard delete cancelled.");
      return;
    }
    const ok = await callAdminApi({ uid, hardDelete: true }, "POST");
    if (ok) {
      refresh();
      setSelectedUser(null);
    }
  };

  // ─── Filtering ───────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        u.fullName.toLowerCase().includes(term) ||
        u.phone.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const filteredEnquiries = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return enquiries;
    return enquiries.filter(
      (e) =>
        e.parentName.toLowerCase().includes(term) ||
        (e.revealerEmail || "").toLowerCase().includes(term) ||
        (e.babyName || "").toLowerCase().includes(term)
    );
  }, [enquiries, searchTerm]);

  // ─── Loading / unauthorized states ───────────────────────────────────────
  if (authLoading || !firestoreUser) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-text">Loading…</div>
      </div>
    );
  }
  if (firestoreUser.role !== "admin") return null;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1 className="admin-title">VGR Admin</h1>
        <div className="admin-header-right">
          <span className="admin-user">{firestoreUser.email}</span>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={() => router.push("/dashboard")}
          >
            Exit Admin
          </button>
        </div>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === "active" ? "active" : ""}`}
          onClick={() => {
            setTab("active");
            setSearchTerm("");
          }}
        >
          Active Users <span className="admin-tab-count">{users.length}</span>
        </button>
        <button
          className={`admin-tab ${tab === "deleted" ? "active" : ""}`}
          onClick={() => {
            setTab("deleted");
            setSearchTerm("");
          }}
        >
          Deleted Users{" "}
          <span className="admin-tab-count">{deleted.length}</span>
        </button>
        <button
          className={`admin-tab ${tab === "enquiries" ? "active" : ""}`}
          onClick={() => {
            setTab("enquiries");
            setSearchTerm("");
          }}
        >
          Enquiries <span className="admin-tab-count">{enquiries.length}</span>
        </button>
        <div className="admin-tab-spacer" />
        <button
          className="admin-btn admin-btn-secondary"
          onClick={refresh}
          disabled={loadingData}
        >
          {loadingData ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {tab !== "deleted" && (
        <div className="admin-search-row">
          <input
            type="text"
            placeholder={
              tab === "active"
                ? "Search by name, email, or phone…"
                : "Search by parent name, baby name, or revealer email…"
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-search"
          />
        </div>
      )}

      <main className="admin-main">
        {loadingData ? (
          <div className="admin-empty">Loading…</div>
        ) : tab === "active" ? (
          <ActiveUsersTable
            rows={filteredUsers}
            onSelect={setSelectedUser}
          />
        ) : tab === "deleted" ? (
          <DeletedUsersTable rows={deleted} />
        ) : (
          <EnquiriesTable
            rows={filteredEnquiries}
            onSelect={setSelectedEnquiry}
          />
        )}
      </main>

      {/* User detail overlay */}
      {selectedUser && (
        <UserDetailOverlay
          user={selectedUser}
          enquiries={enquiries.filter((e) => e.userId === selectedUser.uid)}
          onClose={() => setSelectedUser(null)}
          onDisable={() => handleDisable(selectedUser.uid)}
          onEnable={() => handleEnable(selectedUser.uid)}
          onSoftDelete={() => handleSoftDelete(selectedUser.uid)}
          onHardDelete={() =>
            handleHardDelete(selectedUser.uid, selectedUser.email)
          }
          actionInProgress={actionInProgress !== null}
          isSelf={selectedUser.uid === user?.uid}
        />
      )}

      {/* Enquiry detail overlay */}
      {selectedEnquiry && (
        <EnquiryDetailOverlay
          enquiry={selectedEnquiry}
          owner={users.find((u) => u.uid === selectedEnquiry.userId)}
          onClose={() => setSelectedEnquiry(null)}
          getIdToken={async () => (user ? await user.getIdToken() : "")}
        />
      )}

      <style jsx global>{`
        .admin-page {
          font-family: "Plus Jakarta Sans", sans-serif;
          background: #f4f3f0;
          min-height: 100vh;
          color: #1a1a1a;
        }
        .admin-loading {
          min-height: 100vh;
          background: #f4f3f0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .admin-loading-text {
          font-family: "Playfair Display", serif;
          font-size: 24px;
          color: #888;
        }
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 40px;
          border-bottom: 1px solid #e5e3df;
          background: #fff;
        }
        .admin-title {
          font-family: "Playfair Display", serif;
          font-size: 32px;
          margin: 0;
          background: linear-gradient(90deg, #6c8eef 0%, #ec90c6 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .admin-header-right {
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .admin-user {
          font-size: 14px;
          color: #555;
        }
        .admin-btn {
          font-family: inherit;
          font-size: 14px;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid transparent;
          font-weight: 500;
          transition: all 0.15s;
        }
        .admin-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .admin-btn-primary {
          background: linear-gradient(90deg, #6c8eef, #ec90c6);
          color: #fff;
        }
        .admin-btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }
        .admin-btn-secondary {
          background: #fff;
          border-color: #d4d2cd;
          color: #1a1a1a;
        }
        .admin-btn-secondary:hover:not(:disabled) {
          background: #f4f3f0;
        }
        .admin-btn-danger {
          background: #c43c4f;
          color: #fff;
        }
        .admin-btn-danger:hover:not(:disabled) {
          background: #a82c3d;
        }
        .admin-btn-warn {
          background: #fff3c4;
          border-color: #d4af37;
          color: #6a4f00;
        }
        .admin-tabs {
          display: flex;
          gap: 8px;
          padding: 16px 40px 0;
          border-bottom: 1px solid #e5e3df;
          background: #fff;
          align-items: center;
        }
        .admin-tab {
          font-family: inherit;
          font-size: 15px;
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          color: #666;
          font-weight: 500;
          margin-bottom: -1px;
        }
        .admin-tab:hover {
          color: #1a1a1a;
        }
        .admin-tab.active {
          color: #6c8eef;
          border-bottom-color: #6c8eef;
        }
        .admin-tab-count {
          font-size: 12px;
          background: #f4f3f0;
          padding: 2px 8px;
          border-radius: 999px;
          margin-left: 6px;
          color: #555;
        }
        .admin-tab-spacer {
          flex: 1;
        }
        .admin-search-row {
          padding: 16px 40px 0;
        }
        .admin-search {
          width: 100%;
          max-width: 400px;
          padding: 10px 14px;
          font-family: inherit;
          font-size: 14px;
          border: 1px solid #d4d2cd;
          border-radius: 8px;
          background: #fff;
        }
        .admin-search:focus {
          outline: none;
          border-color: #6c8eef;
        }
        .admin-main {
          padding: 24px 40px 40px;
        }
        .admin-empty {
          text-align: center;
          padding: 80px 0;
          color: #888;
          font-style: italic;
        }
        .admin-table {
          width: 100%;
          background: #fff;
          border: 1px solid #e5e3df;
          border-radius: 12px;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
        }
        .admin-table th {
          text-align: left;
          padding: 14px 16px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
          background: #faf9f6;
          border-bottom: 1px solid #e5e3df;
        }
        .admin-table td {
          padding: 14px 16px;
          font-size: 14px;
          border-bottom: 1px solid #f0eeea;
        }
        .admin-table tbody tr:hover {
          background: #faf9f6;
        }
        .admin-table tbody tr:last-child td {
          border-bottom: none;
        }
        .admin-link {
          color: #6c8eef;
          background: none;
          border: none;
          font-family: inherit;
          font-size: inherit;
          cursor: pointer;
          padding: 0;
          text-align: left;
        }
        .admin-link:hover {
          text-decoration: underline;
        }
        .admin-badge {
          display: inline-block;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .admin-badge-active {
          background: #d4f4dd;
          color: #1f5f33;
        }
        .admin-badge-disabled {
          background: #fde0e0;
          color: #8b1f1f;
        }
        .admin-badge-admin {
          background: linear-gradient(90deg, #d4dcfa, #fadce9);
          color: #4a3a8b;
        }
        .admin-badge-plan {
          background: #fff3c4;
          color: #6a4f00;
        }
        .admin-badge-soon {
          background: #fde0e0;
          color: #8b1f1f;
        }
        .admin-progress {
          display: flex;
          gap: 3px;
          align-items: center;
        }
        .admin-progress-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #e0ddd5;
        }
        .admin-progress-dot.done {
          background: linear-gradient(135deg, #6c8eef, #ec90c6);
        }
        .admin-progress-text {
          font-size: 12px;
          color: #888;
          margin-left: 8px;
        }
        .admin-overlay {
          position: fixed;
          inset: 0;
          background: rgba(20, 20, 20, 0.5);
          z-index: 100;
          display: flex;
          padding: 32px;
          overflow: auto;
        }
        .admin-overlay-content {
          background: #fff;
          border-radius: 16px;
          width: 100%;
          max-width: 1100px;
          margin: auto;
          padding: 32px 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        }
        .admin-overlay-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e5e3df;
        }
        .admin-overlay-back {
          font-family: inherit;
          background: none;
          border: 1px solid #d4d2cd;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
        }
        .admin-overlay-title {
          font-family: "Playfair Display", serif;
          font-size: 28px;
          margin: 0 0 4px;
        }
        .admin-overlay-sub {
          font-size: 14px;
          color: #666;
          margin: 0;
        }
        .admin-overlay-section {
          margin-bottom: 28px;
        }
        .admin-overlay-section h3 {
          font-family: "Playfair Display", serif;
          font-size: 18px;
          margin: 0 0 14px;
          color: #1a1a1a;
        }
        .admin-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px 24px;
        }
        .admin-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px 24px;
        }
        .admin-field-label {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        .admin-field-value {
          font-size: 14px;
          color: #1a1a1a;
          word-break: break-word;
        }
        .admin-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .admin-gender-blur {
          display: inline-block;
          padding: 4px 12px;
          background: linear-gradient(90deg, #d4dcfa, #fadce9);
          border-radius: 6px;
          color: transparent;
          text-shadow: 0 0 12px rgba(0, 0, 0, 0.6);
          cursor: pointer;
          user-select: none;
          font-weight: 600;
        }
        .admin-gender-revealed {
          display: inline-block;
          padding: 4px 12px;
          background: linear-gradient(90deg, #d4dcfa, #fadce9);
          border-radius: 6px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .admin-photos {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .admin-photo {
          width: 120px;
          height: 120px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #e5e3df;
        }
        .admin-stages-detail {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
        }
        .admin-stage-cell {
          text-align: center;
          padding: 12px 4px;
          background: #f9f8f5;
          border-radius: 8px;
          border: 2px solid transparent;
        }
        .admin-stage-cell.done {
          background: linear-gradient(
            135deg,
            rgba(108, 142, 239, 0.15),
            rgba(236, 144, 198, 0.15)
          );
          border-color: rgba(108, 142, 239, 0.3);
        }
        .admin-stage-cell .label {
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .admin-stage-cell .when {
          font-size: 10px;
          color: #888;
        }
      `}</style>
    </div>
  );
}

// ─── Active Users Table ──────────────────────────────────────────────────────

function ActiveUsersTable({
  rows,
  onSelect,
}: {
  rows: UserRow[];
  onSelect: (u: UserRow) => void;
}) {
  if (rows.length === 0)
    return <div className="admin-empty">No users found.</div>;
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Plan</th>
          <th>Role</th>
          <th>Status</th>
          <th>Reveals</th>
          <th>Joined</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((u) => (
          <tr key={u.uid}>
            <td>
              <button className="admin-link" onClick={() => onSelect(u)}>
                {u.fullName || "—"}
              </button>
            </td>
            <td>{u.email}</td>
            <td>
              {u.activePlan && u.activePlan !== "none" ? (
                <span className="admin-badge admin-badge-plan">
                  {u.activePlan}
                </span>
              ) : (
                "—"
              )}
            </td>
            <td>
              {u.role === "admin" ? (
                <span className="admin-badge admin-badge-admin">Admin</span>
              ) : (
                "User"
              )}
            </td>
            <td>
              {u.isDeleted || u.status === "disabled" ? (
                <span className="admin-badge admin-badge-disabled">
                  Disabled
                </span>
              ) : (
                <span className="admin-badge admin-badge-active">Active</span>
              )}
            </td>
            <td>
              {u.revealsCreated} / {u.revealsCreated + u.revealsAllowed}
            </td>
            <td>{fmtDate(u.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Deleted Users Table ─────────────────────────────────────────────────────

function DeletedUsersTable({ rows }: { rows: DeletedRow[] }) {
  if (rows.length === 0)
    return (
      <div className="admin-empty">
        No deleted users. Shadow records appear here for 30 days after deletion.
      </div>
    );
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Plan</th>
          <th>Spent</th>
          <th>Reveals</th>
          <th>Deleted by</th>
          <th>Deleted at</th>
          <th>Expires in</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const days = daysUntil(r.purgeAt);
          return (
            <tr key={r.originalUid}>
              <td>{r.parentName || "—"}</td>
              <td>{r.email || "—"}</td>
              <td>{r.phoneNumber || "—"}</td>
              <td>{r.activePlan || "—"}</td>
              <td>{fmtMoney(r.totalSpentCents)}</td>
              <td>{r.revealsCreated}</td>
              <td>
                <span
                  className={
                    r.deletedBy === "admin"
                      ? "admin-badge admin-badge-disabled"
                      : "admin-badge admin-badge-plan"
                  }
                >
                  {r.deletedBy}
                </span>
              </td>
              <td>{fmtDate(r.deletedAt)}</td>
              <td>
                <span
                  className={
                    days <= 3
                      ? "admin-badge admin-badge-soon"
                      : "admin-badge admin-badge-active"
                  }
                >
                  {days} day{days === 1 ? "" : "s"}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Enquiries Table ─────────────────────────────────────────────────────────

function EnquiriesTable({
  rows,
  onSelect,
}: {
  rows: EnquiryRow[];
  onSelect: (e: EnquiryRow) => void;
}) {
  if (rows.length === 0)
    return <div className="admin-empty">No enquiries yet.</div>;
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Parent</th>
          <th>Mode</th>
          <th>Plan</th>
          <th>Status</th>
          <th>Revealer</th>
          <th>Progress</th>
          <th>Event</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => {
          const stagesDone = STAGE_LABELS.filter(
            ([key]) => e.stages[key] !== null
          ).length;
          return (
            <tr key={e.id}>
              <td>{fmtDate(e.createdAt)}</td>
              <td>
                <button className="admin-link" onClick={() => onSelect(e)}>
                  {e.parentName}
                </button>
              </td>
              <td>{e.mode}</td>
              <td>
                {e.plan ? (
                  <span className="admin-badge admin-badge-plan">{e.plan}</span>
                ) : (
                  "—"
                )}
              </td>
              <td>{e.status}</td>
              <td>
                {e.genderStatus === "submitted" ? (
                  <span className="admin-badge admin-badge-active">Submitted</span>
                ) : (
                  <span className="admin-badge admin-badge-disabled">Pending</span>
                )}
              </td>
              <td>
                <div className="admin-progress">
                  {STAGE_LABELS.map(([key]) => (
                    <span
                      key={key}
                      className={`admin-progress-dot ${
                        e.stages[key] ? "done" : ""
                      }`}
                      title={key}
                    />
                  ))}
                  <span className="admin-progress-text">
                    {stagesDone}/{STAGE_LABELS.length}
                  </span>
                </div>
              </td>
              <td>{fmtDate(e.revealAt)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── User Detail Overlay ─────────────────────────────────────────────────────

function UserDetailOverlay({
  user,
  enquiries,
  onClose,
  onDisable,
  onEnable,
  onSoftDelete,
  onHardDelete,
  actionInProgress,
  isSelf,
}: {
  user: UserRow;
  enquiries: EnquiryRow[];
  onClose: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onSoftDelete: () => void;
  onHardDelete: () => void;
  actionInProgress: boolean;
  isSelf: boolean;
}) {
  return (
    <div className="admin-overlay" onClick={onClose}>
      <div
        className="admin-overlay-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-overlay-header">
          <div>
            <h2 className="admin-overlay-title">{user.fullName || "—"}</h2>
            <p className="admin-overlay-sub">
              {user.email} · {user.uid}
            </p>
          </div>
          <button className="admin-overlay-back" onClick={onClose}>
            ← Back
          </button>
        </div>

        <div className="admin-overlay-section">
          <h3>Account Information</h3>
          <div className="admin-grid">
            <div>
              <div className="admin-field-label">Phone</div>
              <div className="admin-field-value">{user.phone || "—"}</div>
            </div>
            <div>
              <div className="admin-field-label">Provider</div>
              <div className="admin-field-value">{user.provider || "—"}</div>
            </div>
            <div>
              <div className="admin-field-label">Email Verified</div>
              <div className="admin-field-value">
                {user.emailVerified ? "Yes" : "No"}
              </div>
            </div>
            <div>
              <div className="admin-field-label">Role</div>
              <div className="admin-field-value">{user.role}</div>
            </div>
            <div>
              <div className="admin-field-label">Last Login</div>
              <div className="admin-field-value">
                {fmtDateTime(user.lastLogin)}
              </div>
            </div>
            <div>
              <div className="admin-field-label">Created</div>
              <div className="admin-field-value">
                {fmtDateTime(user.createdAt)}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-overlay-section">
          <h3>Plan & Spending</h3>
          <div className="admin-grid-3">
            <div>
              <div className="admin-field-label">Active Plan</div>
              <div className="admin-field-value">{user.activePlan}</div>
            </div>
            <div>
              <div className="admin-field-label">Total Spent</div>
              <div className="admin-field-value">
                {fmtMoney(user.totalSpentCents)}
              </div>
            </div>
            <div>
              <div className="admin-field-label">Purchases</div>
              <div className="admin-field-value">{user.totalPurchases}</div>
            </div>
            <div>
              <div className="admin-field-label">Reveals Used</div>
              <div className="admin-field-value">{user.revealsCreated}</div>
            </div>
            <div>
              <div className="admin-field-label">Reveals Remaining</div>
              <div className="admin-field-value">{user.revealsAllowed}</div>
            </div>
          </div>
        </div>

        <div className="admin-overlay-section">
          <h3>
            Enquiries{" "}
            <span style={{ color: "#888", fontSize: 14, fontWeight: 400 }}>
              ({enquiries.length})
            </span>
          </h3>
          {enquiries.length === 0 ? (
            <p style={{ color: "#888", fontStyle: "italic" }}>
              No enquiries yet.
            </p>
          ) : (
            enquiries.map((e) => {
              const stagesDone = STAGE_LABELS.filter(
                ([key]) => e.stages[key] !== null
              ).length;
              return (
                <div
                  key={e.id}
                  style={{
                    padding: 16,
                    background: "#faf9f6",
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <strong>{e.parentName}</strong> · {e.mode} ·{" "}
                      {fmtDate(e.createdAt)}
                    </div>
                    <span style={{ color: "#888", fontSize: 13 }}>
                      {stagesDone}/{STAGE_LABELS.length} stages
                    </span>
                  </div>
                  <div className="admin-stages-detail">
                    {STAGE_LABELS.map(([key, label]) => (
                      <div
                        key={key}
                        className={`admin-stage-cell ${
                          e.stages[key] ? "done" : ""
                        }`}
                      >
                        <div className="label">{label}</div>
                        <div className="when">
                          {e.stages[key] ? fmtDate(e.stages[key]) : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="admin-overlay-section">
          <h3>Admin Actions</h3>
          {isSelf && (
            <p
              style={{
                background: "#fff3c4",
                color: "#6a4f00",
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              ⚠️ This is your own account. You cannot disable or delete
              yourself.
            </p>
          )}
          <div className="admin-actions">
            {!isSelf &&
              (user.isDeleted || user.status === "disabled" ? (
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={onEnable}
                  disabled={actionInProgress}
                >
                  Enable User
                </button>
              ) : (
                <button
                  className="admin-btn admin-btn-warn"
                  onClick={onDisable}
                  disabled={actionInProgress}
                >
                  Disable User
                </button>
              ))}
            {!isSelf && !user.isDeleted && (
              <button
                className="admin-btn admin-btn-secondary"
                onClick={onSoftDelete}
                disabled={actionInProgress}
              >
                Soft Delete
              </button>
            )}
            {!isSelf && (
              <button
                className="admin-btn admin-btn-danger"
                onClick={onHardDelete}
                disabled={actionInProgress}
              >
                Hard Delete (Permanent)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Enquiry Detail Overlay ──────────────────────────────────────────────────

function EnquiryDetailOverlay({
  enquiry,
  owner,
  onClose,
  getIdToken,
}: {
  enquiry: EnquiryRow;
  owner: UserRow | undefined;
  onClose: () => void;
  getIdToken: () => Promise<string>;
}) {
  const [genderRevealed, setGenderRevealed] = useState(false);
  const [genderValue, setGenderValue] = useState<string | null>(null);
  const [genderLoading, setGenderLoading] = useState(false);

  const handleRevealGender = async () => {
    if (genderRevealed) {
      setGenderRevealed(false);
      return;
    }
    if (genderValue) {
      setGenderRevealed(true);
      return;
    }
    setGenderLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/gender/${enquiry.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to fetch gender.");
        return;
      }
      if (data.gender === null) {
        alert("Gender has not been submitted yet for this enquiry.");
        return;
      }
      setGenderValue(data.gender);
      setGenderRevealed(true);
    } catch (err) {
      console.error(err);
      alert("Failed to decrypt gender.");
    } finally {
      setGenderLoading(false);
    }
  };

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div
        className="admin-overlay-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-overlay-header">
          <div>
            <h2 className="admin-overlay-title">{enquiry.parentName}</h2>
            <p className="admin-overlay-sub">
              {enquiry.mode === "announcement"
                ? "Announcement"
                : "Reveal"}{" "}
              · created {fmtDate(enquiry.createdAt)} · ID {enquiry.id}
            </p>
          </div>
          <button className="admin-overlay-back" onClick={onClose}>
            ← Back
          </button>
        </div>

        <div className="admin-overlay-section">
          <h3>Owner</h3>
          {owner ? (
            <div className="admin-grid">
              <div>
                <div className="admin-field-label">Name</div>
                <div className="admin-field-value">
                  {owner.fullName || "—"}
                </div>
              </div>
              <div>
                <div className="admin-field-label">Email</div>
                <div className="admin-field-value">{owner.email}</div>
              </div>
              <div>
                <div className="admin-field-label">Phone</div>
                <div className="admin-field-value">{owner.phone || "—"}</div>
              </div>
              <div>
                <div className="admin-field-label">Plan</div>
                <div className="admin-field-value">{owner.activePlan}</div>
              </div>
            </div>
          ) : (
            <p style={{ color: "#888", fontStyle: "italic" }}>
              Owner record not found (user may have been deleted).
            </p>
          )}
        </div>

        <div className="admin-overlay-section">
          <h3>Reveal Details</h3>
          <div className="admin-grid">
            <div>
              <div className="admin-field-label">Plan</div>
              <div className="admin-field-value">{enquiry.plan || "—"}</div>
            </div>
            <div>
              <div className="admin-field-label">Status</div>
              <div className="admin-field-value">{enquiry.status}</div>
            </div>
            <div>
              <div className="admin-field-label">Reveal Date</div>
              <div className="admin-field-value">
                {fmtDateTime(enquiry.revealAt)} ({enquiry.revealTimezone})
              </div>
            </div>
            <div>
              <div className="admin-field-label">Guest Count</div>
              <div className="admin-field-value">{enquiry.guestCount}</div>
            </div>
            {enquiry.mode === "announcement" ? (
              <div>
                <div className="admin-field-label">Baby Name</div>
                <div className="admin-field-value">
                  {enquiry.babyName || "—"}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="admin-field-label">Girl Name (if girl)</div>
                  <div className="admin-field-value">
                    {enquiry.babyNameGirl || "—"}
                  </div>
                </div>
                <div>
                  <div className="admin-field-label">Boy Name (if boy)</div>
                  <div className="admin-field-value">
                    {enquiry.babyNameBoy || "—"}
                  </div>
                </div>
              </>
            )}
            <div>
              <div className="admin-field-label">Gender</div>
              <div className="admin-field-value">
                {enquiry.genderStatus === "not_submitted" ? (
                  <span style={{ color: "#888", fontStyle: "italic" }}>
                    Not submitted yet
                  </span>
                ) : genderLoading ? (
                  <span style={{ color: "#888" }}>Decrypting…</span>
                ) : genderRevealed && genderValue ? (
                  <span
                    className="admin-gender-revealed"
                    onClick={handleRevealGender}
                    style={{ cursor: "pointer" }}
                    title="Click to hide"
                  >
                    {genderValue}
                  </span>
                ) : (
                  <span
                    className="admin-gender-blur"
                    onClick={handleRevealGender}
                    title="Click to reveal"
                  >
                    XXXXXX
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {enquiry.mode === "reveal" && (
          <div className="admin-overlay-section">
            <h3>Revealer</h3>
            <div className="admin-grid">
              <div>
                <div className="admin-field-label">Email</div>
                <div className="admin-field-value">
                  {enquiry.revealerEmail || "—"}
                </div>
              </div>
              <div>
                <div className="admin-field-label">Relation</div>
                <div className="admin-field-value">
                  {enquiry.revealerRelation || "—"}
                </div>
              </div>
              <div>
                <div className="admin-field-label">Name</div>
                <div className="admin-field-value">
                  {enquiry.revealerName || "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        {enquiry.photos.length > 0 && (
          <div className="admin-overlay-section">
            <h3>Photos ({enquiry.photos.length})</h3>
            <div className="admin-photos">
              {enquiry.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="admin-photo" src={url} alt={`Photo ${i + 1}`} />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="admin-overlay-section">
          <h3>Progress (7 stages)</h3>
          <div className="admin-stages-detail">
            {STAGE_LABELS.map(([key, label]) => (
              <div
                key={key}
                className={`admin-stage-cell ${
                  enquiry.stages[key] ? "done" : ""
                }`}
              >
                <div className="label">{label}</div>
                <div className="when">
                  {enquiry.stages[key] ? fmtDate(enquiry.stages[key]) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
tjm
