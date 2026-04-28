"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnquiryData {
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
  photos: string[];
  videoUrl: string | null;
  videoStatus: "uploaded" | "pending" | "none";
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
  latestEnquiry: EnquiryData | null;
}

interface DeletedRow {
  originalUid: string;
  parentName: string | null;
  email: string | null;
  phoneNumber: string | null;
  deletedBy: "user" | "admin";
  deletedAt: Date;
  purgeAt: Date;
}

type SortKey =
  | "name"
  | "email"
  | "plan"
  | "gender"
  | "revealDate"
  | "type"
  | "status"
  | "video";

type SortDir = "asc" | "desc";

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

function getInitials(name: string, email: string): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/[\s@]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.substring(0, 2).toUpperCase();
}

function avatarColor(seed: string): string {
  const palette = [
    "linear-gradient(135deg, #fadce9, #f5b8d4)",
    "linear-gradient(135deg, #d4dcfa, #b8c5f5)",
    "linear-gradient(135deg, #d4f4dd, #b8e8c5)",
    "linear-gradient(135deg, #fff3c4, #ffe6a8)",
    "linear-gradient(135deg, #e6dafa, #c8b8f5)",
    "linear-gradient(135deg, #fde0e0, #f5b8b8)",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

function avatarTextColor(seed: string): string {
  const palette = ["#7a1f4f", "#1f3a7a", "#1f5f33", "#6a4f00", "#4a3a8b", "#8b1f1f"];
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

function deriveVideoStatus(e: EnquiryData | null): "uploaded" | "pending" | "none" {
  if (!e) return "none";
  if (e.videoUrl) return "uploaded";
  if (e.stages.paymentReceived) return "pending";
  return "none";
}

function deriveOverallStatus(e: EnquiryData | null): {
  label: string;
  tone: "green" | "yellow" | "blue" | "gray";
} {
  if (!e) return { label: "No reveal", tone: "gray" };
  if (e.stages.eventCompleted) return { label: "Completed", tone: "green" };
  if (e.videoUrl || e.stages.videoGenerated)
    return { label: "Video Completed", tone: "green" };
  if (e.mode === "reveal" && e.genderStatus !== "submitted")
    return { label: "Reveal Pending", tone: "blue" };
  if (e.stages.paymentReceived) return { label: "Video Pending", tone: "yellow" };
  return { label: "Pending Payment", tone: "gray" };
}

function daysUntil(target: Date): number {
  const ms = target.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, firestoreUser, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [deleted, setDeleted] = useState<DeletedRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [videoStatusFilter, setVideoStatusFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const [sortKey, setSortKey] = useState<SortKey>("revealDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (firestoreUser && firestoreUser.role?.toLowerCase() !== "admin") {
      router.push("/dashboard");
    }
  }, [user, firestoreUser, authLoading, router]);

  const loadAll = useCallback(async () => {
    if (!user || firestoreUser?.role?.toLowerCase() !== "admin") return;
    setLoadingData(true);
    try {
      const db = getFirebaseDb();

      const enquiriesSnap = await getDocs(
        query(collection(db, "enquiries"), orderBy("createdAt", "desc"))
      );
      const enquiriesList: EnquiryData[] = enquiriesSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const stages = (data.stages as Record<string, unknown>) ?? {};
        const enq: EnquiryData = {
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
          photos: (data.photos as string[]) ?? [],
          videoUrl: (data.videoUrl as string) ?? null,
          videoStatus: "none",
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
        enq.videoStatus = deriveVideoStatus(enq);
        return enq;
      });

      const enquiryByUser = new Map<string, EnquiryData>();
      for (const e of enquiriesList) {
        const existing = enquiryByUser.get(e.userId);
        if (
          !existing ||
          (e.createdAt &&
            existing.createdAt &&
            e.createdAt.getTime() > existing.createdAt.getTime())
        ) {
          enquiryByUser.set(e.userId, e);
        }
      }

      const usersSnap = await getDocs(
        query(collection(db, "users"), orderBy("createdAt", "desc"))
      );
      const usersList: UserRow[] = usersSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const purchases =
          (data.purchases as Array<Record<string, unknown>>) ?? [];
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
          latestEnquiry: enquiryByUser.get(d.id) ?? null,
        };
      });
      setUsers(usersList);

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
          deletedBy: (data.deletedBy as "user" | "admin") ?? "admin",
          deletedAt: tsToDate(data.deletedAt) ?? new Date(),
          purgeAt: tsToDate(data.purgeAt) ?? new Date(),
        };
      });
      setDeleted(deletedList);
    } catch (err) {
      console.error("[admin] Failed to load data:", err);
      alert("Failed to load admin data. Check Firestore rules allow admin reads.");
    } finally {
      setLoadingData(false);
    }
  }, [user, firestoreUser]);

  useEffect(() => {
    loadAll();
  }, [loadAll, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const callAdminApi = async (
    body: Record<string, unknown>,
    method: "POST" | "PUT" = "POST"
  ): Promise<boolean> => {
    if (!user) return false;
    setActionInProgress(true);
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
      alert("Action failed.");
      return false;
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDisable = async (uid: string) => {
    if (!confirm("Disable this user?")) return;
    if (await callAdminApi({ uid, action: "disable" }, "PUT")) {
      refresh();
      setSelectedUser(null);
    }
  };
  const handleEnable = async (uid: string) => {
    if (!confirm("Re-enable this user?")) return;
    if (await callAdminApi({ uid, action: "enable" }, "PUT")) {
      refresh();
      setSelectedUser(null);
    }
  };
  const handleSoftDelete = async (uid: string) => {
    if (!confirm("Soft-delete this user? 30-day shadow record will be kept.")) return;
    if (await callAdminApi({ uid, hardDelete: false }, "POST")) {
      refresh();
      setSelectedUser(null);
    }
  };
  const handleHardDelete = async (uid: string, email: string) => {
    if (!confirm(`PERMANENTLY DELETE ${email}?`)) return;
    const c = prompt(`Type DELETE to confirm hard delete of ${email}`);
    if (c !== "DELETE") {
      alert("Cancelled.");
      return;
    }
    if (await callAdminApi({ uid, hardDelete: true }, "POST")) {
      refresh();
      setSelectedUser(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return users.filter((u) => {
      if (term) {
        const haystack = `${u.fullName} ${u.email} ${u.phone}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (planFilter !== "all") {
        if ((u.activePlan || "none").toLowerCase() !== planFilter) return false;
      }
      const e = u.latestEnquiry;
      if (videoStatusFilter !== "all") {
        if (deriveVideoStatus(e) !== videoStatusFilter) return false;
      }
      if (statusFilter !== "all") {
        const s = deriveOverallStatus(e).label.toLowerCase().replace(/ /g, "-");
        if (s !== statusFilter) return false;
      }
      if (typeFilter !== "all") {
        if (!e || e.mode !== typeFilter) return false;
      }
      if (dateFrom && e?.revealAt) {
        if (e.revealAt < new Date(dateFrom)) return false;
      } else if (dateFrom && !e?.revealAt) return false;
      if (dateTo && e?.revealAt) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (e.revealAt > end) return false;
      } else if (dateTo && !e?.revealAt) return false;
      return true;
    });
  }, [users, searchTerm, planFilter, videoStatusFilter, statusFilter, typeFilter, dateFrom, dateTo]);

  const sortedUsers = useMemo(() => {
    const copy = [...filteredUsers];
    copy.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "name": av = a.fullName.toLowerCase(); bv = b.fullName.toLowerCase(); break;
        case "email": av = a.email.toLowerCase(); bv = b.email.toLowerCase(); break;
        case "plan": av = a.activePlan; bv = b.activePlan; break;
        case "revealDate":
          av = a.latestEnquiry?.revealAt?.getTime() ?? 0;
          bv = b.latestEnquiry?.revealAt?.getTime() ?? 0;
          break;
        case "type": av = a.latestEnquiry?.mode ?? ""; bv = b.latestEnquiry?.mode ?? ""; break;
        case "status":
          av = deriveOverallStatus(a.latestEnquiry).label;
          bv = deriveOverallStatus(b.latestEnquiry).label;
          break;
        case "video":
          av = deriveVideoStatus(a.latestEnquiry);
          bv = deriveVideoStatus(b.latestEnquiry);
          break;
        case "gender":
          av = a.latestEnquiry?.genderStatus ?? "z";
          bv = b.latestEnquiry?.genderStatus ?? "z";
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filteredUsers, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = sortedUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, planFilter, videoStatusFilter, statusFilter, typeFilter, dateFrom, dateTo]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setPlanFilter("all");
    setVideoStatusFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const handleExportCsv = async () => {
    if (!user) return;
    setActionInProgress(true);
    try {
      const token = await user.getIdToken();
      const csvField = (s: unknown) => {
        const str = s == null ? "" : String(s);
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };
      const rows: string[] = [
        ["Name","Email","Phone","Plan","Role","Status","Reveals Created","Total Spent (USD)","Reveal ID","Mode","Reveal Date","Baby Gender","Reveal Status","Video Status","Joined"].join(","),
      ];
      for (const u of sortedUsers) {
        const e = u.latestEnquiry;
        let gender = "";
        if (e && e.id) {
          try {
            const r = await fetch(`/api/admin/gender/${e.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await r.json();
            if (r.ok && data.gender) gender = data.gender;
          } catch {}
        }
        rows.push([
          csvField(u.fullName), csvField(u.email), csvField(u.phone), csvField(u.activePlan),
          csvField(u.role),
          csvField(u.isDeleted || u.status === "disabled" ? "Disabled" : "Active"),
          csvField(u.revealsCreated), csvField((u.totalSpentCents / 100).toFixed(2)),
          csvField(e?.id ?? ""), csvField(e?.mode ?? ""),
          csvField(e?.revealAt ? fmtDate(e.revealAt) : ""), csvField(gender),
          csvField(deriveOverallStatus(e).label), csvField(deriveVideoStatus(e)),
          csvField(u.createdAt ? fmtDate(u.createdAt) : ""),
        ].join(","));
      }
      const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vgr-users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("CSV export failed.");
    } finally {
      setActionInProgress(false);
    }
  };

  if (authLoading || !firestoreUser) {
    return (
      <div className="vgr-loading">
        <div className="vgr-loading-text">Loading…</div>
        <style jsx>{`
          .vgr-loading {
            min-height: 100vh;
            background: linear-gradient(135deg, #faf6fa 0%, #f3e9f4 100%);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .vgr-loading-text {
            font-family: "Playfair Display", serif;
            font-size: 24px;
            color: #888;
          }
        `}</style>
      </div>
    );
  }
  if (firestoreUser.role?.toLowerCase() !== "admin") return null;

  return (
    <div className="vgr-admin">
      <aside className="vgr-sidebar">
        <div className="vgr-brand">
          <div className="vgr-brand-icon">
            <span className="balloon balloon-blue">●</span>
            <span className="balloon balloon-pink">●</span>
          </div>
          <div className="vgr-brand-text">
            <div className="vgr-brand-name">
              <span className="brand-gender">Gender</span>
              <span className="brand-reveal">Reveal</span>
            </div>
            <div className="vgr-brand-sub">Admin Dashboard</div>
          </div>
        </div>

        <nav className="vgr-nav">
          {[
            { key: "dashboard", label: "Dashboard", icon: "▦" },
            { key: "users", label: "Users", icon: "◉", active: true },
            { key: "reveals", label: "Reveals", icon: "❤" },
            { key: "videos", label: "Videos", icon: "▶" },
            { key: "orders", label: "Orders", icon: "$" },
            { key: "settings", label: "Settings", icon: "⚙" },
            { key: "billing", label: "Billing", icon: "▤" },
            { key: "support", label: "Support", icon: "?" },
          ].map((item) => (
            <button
              key={item.key}
              className={`vgr-nav-item ${item.active ? "active" : "disabled"}`}
              disabled={!item.active}
              title={item.active ? undefined : "Coming soon"}
            >
              <span className="vgr-nav-icon">{item.icon}</span>
              <span className="vgr-nav-label">{item.label}</span>
              {!item.active && <span className="vgr-nav-soon">soon</span>}
            </button>
          ))}
        </nav>

        <div className="vgr-sidebar-footer">
          <div className="vgr-account">
            <div
              className="vgr-account-avatar"
              style={{
                background: avatarColor(firestoreUser.email || "admin"),
                color: avatarTextColor(firestoreUser.email || "admin"),
              }}
            >
              {getInitials("", firestoreUser.email || "Admin")}
            </div>
            <div className="vgr-account-info">
              <div className="vgr-account-name">Admin</div>
              <div className="vgr-account-role">Business Owner</div>
            </div>
            <button
              className="vgr-account-menu"
              onClick={async () => {
                if (!confirm("Sign out?")) return;
                try {
                  await signOut(getAuth());
                } catch (err) {
                  console.error(err);
                }
                router.push("/login");
              }}
              title="Sign out"
              aria-label="Sign out"
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      <main className="vgr-main">
        <header className="vgr-page-header">
          <div>
            <h1 className="vgr-page-title">Users</h1>
            <p className="vgr-page-sub">Manage all users and their reveal parties</p>
          </div>
          <button
            className="vgr-btn vgr-btn-export"
            onClick={handleExportCsv}
            disabled={actionInProgress || sortedUsers.length === 0}
          >
            <span className="vgr-btn-icon">↓</span> Export CSV
          </button>
        </header>

        <section className="vgr-filters">
          <div className="vgr-filter-group">
            <label className="vgr-filter-label">Search</label>
            <div className="vgr-search-wrap">
              <input
                className="vgr-input"
                type="text"
                placeholder="Search by name, email, or phone…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="vgr-search-icon">⌕</span>
            </div>
          </div>
          <div className="vgr-filter-group">
            <label className="vgr-filter-label">Plan</label>
            <select className="vgr-select" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="all">All Plans</option>
              <option value="premium">Premium</option>
              <option value="basic">Basic</option>
              <option value="spark">Spark</option>
              <option value="none">None</option>
            </select>
          </div>
          <div className="vgr-filter-group">
            <label className="vgr-filter-label">Video Status</label>
            <select className="vgr-select" value={videoStatusFilter} onChange={(e) => setVideoStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="uploaded">Uploaded</option>
              <option value="pending">Pending</option>
              <option value="none">Not started</option>
            </select>
          </div>
          <div className="vgr-filter-group">
            <label className="vgr-filter-label">Status</label>
            <select className="vgr-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="video-completed">Video Completed</option>
              <option value="video-pending">Video Pending</option>
              <option value="reveal-pending">Reveal Pending</option>
              <option value="pending-payment">Pending Payment</option>
            </select>
          </div>
          <div className="vgr-filter-group">
            <label className="vgr-filter-label">Type</label>
            <select className="vgr-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="reveal">Reveal</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>
          <div className="vgr-filter-group vgr-filter-group-date">
            <label className="vgr-filter-label">Reveal Date</label>
            <div className="vgr-date-range">
              <input className="vgr-input vgr-input-date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="vgr-date-sep">→</span>
              <input className="vgr-input vgr-input-date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="vgr-filter-group vgr-filter-group-reset">
            <label className="vgr-filter-label">&nbsp;</label>
            <button className="vgr-btn vgr-btn-reset" onClick={resetFilters}>
              <span className="vgr-btn-icon">↺</span> Reset Filters
            </button>
          </div>
        </section>

        <div className="vgr-total-row">
          <div className="vgr-total">
            <span className="vgr-total-icon">▦</span>
            <span>
              Total Users: <strong>{filteredUsers.length}</strong>
              {filteredUsers.length !== users.length && (
                <span className="vgr-total-note"> (of {users.length})</span>
              )}
            </span>
          </div>
          <button className="vgr-btn vgr-btn-ghost" onClick={refresh} disabled={loadingData}>
            {loadingData ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        <section className="vgr-table-card">
          {loadingData ? (
            <div className="vgr-table-loading">Loading users…</div>
          ) : sortedUsers.length === 0 ? (
            <div className="vgr-table-empty">
              No users match your filters. <button className="vgr-link" onClick={resetFilters}>Reset filters</button>
            </div>
          ) : (
            <>
              <div className="vgr-table-scroll">
                <table className="vgr-table">
                  <thead>
                    <tr>
                      <SortHeader label="Name" sortKey="name" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Email" sortKey="email" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Plan" sortKey="plan" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Baby Gender" sortKey="gender" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Reveal Date" sortKey="revealDate" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Type" sortKey="type" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Video" sortKey="video" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} />
                      <th className="vgr-th vgr-th-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedUsers.map((u) => (
                      <UserTableRow
                        key={u.uid}
                        user={u}
                        onSelect={() => setSelectedUser(u)}
                        onUploadClick={() => setShowVideoModal(true)}
                        getIdToken={async () => (user ? await user.getIdToken() : "")}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="vgr-pagination">
                <div className="vgr-pagination-info">
                  Showing <strong>{(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, sortedUsers.length)}</strong> of <strong>{sortedUsers.length}</strong> users
                </div>
                <Pagination current={currentPage} total={totalPages} onPage={setPage} />
              </div>
            </>
          )}
        </section>

        {deleted.length > 0 && (
          <details className="vgr-deleted-section">
            <summary>{deleted.length} deleted user{deleted.length === 1 ? "" : "s"} (30-day shadow records)</summary>
            <div className="vgr-deleted-list">
              {deleted.map((d) => {
                const days = daysUntil(d.purgeAt);
                return (
                  <div key={d.originalUid} className="vgr-deleted-row">
                    <div>
                      <strong>{d.parentName || d.email || "—"}</strong>
                      <span className="vgr-deleted-meta">
                        {" · "}{d.email || "no email"}{" · deleted by "}{d.deletedBy}{" · "}{fmtDate(d.deletedAt)}
                      </span>
                    </div>
                    <span className={`vgr-pill ${days <= 3 ? "vgr-pill-red" : "vgr-pill-amber"}`}>
                      Purges in {days} day{days === 1 ? "" : "s"}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </main>

      {selectedUser && (
        <UserProfileOverlay
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onDisable={() => handleDisable(selectedUser.uid)}
          onEnable={() => handleEnable(selectedUser.uid)}
          onSoftDelete={() => handleSoftDelete(selectedUser.uid)}
          onHardDelete={() => handleHardDelete(selectedUser.uid, selectedUser.email)}
          actionInProgress={actionInProgress}
          isSelf={selectedUser.uid === user?.uid}
          getIdToken={async () => (user ? await user.getIdToken() : "")}
          onUploadClick={() => setShowVideoModal(true)}
        />
      )}

      {showVideoModal && <VideoUploadModal onClose={() => setShowVideoModal(false)} />}

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");

        :root {
          --vgr-sidebar-from: #f8d8e8;
          --vgr-sidebar-to: #e3d4f5;
          --vgr-bg: #f8f5f9;
          --vgr-card: #ffffff;
          --vgr-border: #ece6ee;
          --vgr-border-light: #f4eef5;
          --vgr-text: #1a1a1a;
          --vgr-text-muted: #6b6b6b;
          --vgr-text-light: #9b9b9b;
          --vgr-pink: #ec90c6;
          --vgr-blue: #6c8eef;
          --vgr-purple: #8b5cf6;
          --vgr-green: #22c55e;
          --vgr-amber: #f59e0b;
          --vgr-red: #ef4444;
        }

        * { box-sizing: border-box; }
        body { margin: 0; }

        .vgr-admin {
          font-family: "Plus Jakarta Sans", -apple-system, sans-serif;
          background: var(--vgr-bg);
          color: var(--vgr-text);
          min-height: 100vh;
          display: flex;
        }

        .vgr-sidebar {
          width: 240px;
          flex-shrink: 0;
          background: linear-gradient(180deg, var(--vgr-sidebar-from) 0%, var(--vgr-sidebar-to) 100%);
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
        }
        .vgr-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 8px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.4);
          margin-bottom: 16px;
        }
        .vgr-brand-icon { position: relative; width: 36px; height: 36px; flex-shrink: 0; }
        .balloon { position: absolute; font-size: 20px; line-height: 1; }
        .balloon-blue { color: #6c8eef; top: 0; left: 0; }
        .balloon-pink { color: #ec90c6; bottom: 0; right: 0; }
        .vgr-brand-text { flex: 1; min-width: 0; }
        .vgr-brand-name {
          font-family: "Playfair Display", serif;
          font-weight: 700;
          font-size: 18px;
          line-height: 1.1;
        }
        .brand-gender { color: #6c8eef; margin-right: 4px; }
        .brand-reveal { color: #ec90c6; }
        .vgr-brand-sub { font-size: 11px; color: var(--vgr-text-muted); margin-top: 2px; }

        .vgr-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .vgr-nav-item {
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: var(--vgr-text);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
          width: 100%;
        }
        .vgr-nav-item:hover:not(.disabled):not(.active) { background: rgba(255,255,255,0.5); }
        .vgr-nav-item.active {
          background: rgba(255,255,255,0.85);
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(140,100,200,0.08);
        }
        .vgr-nav-item.disabled { color: var(--vgr-text-light); cursor: not-allowed; }
        .vgr-nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
        .vgr-nav-label { flex: 1; }
        .vgr-nav-soon {
          font-size: 9px;
          background: rgba(255,255,255,0.6);
          color: var(--vgr-text-light);
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .vgr-sidebar-footer { padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.4); }
        .vgr-account {
          display: flex; align-items: center; gap: 10px;
          padding: 8px;
          background: rgba(255,255,255,0.6);
          border-radius: 12px;
        }
        .vgr-account-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 13px; flex-shrink: 0;
        }
        .vgr-account-info { flex: 1; min-width: 0; }
        .vgr-account-name { font-size: 13px; font-weight: 600; }
        .vgr-account-role { font-size: 11px; color: var(--vgr-text-muted); }
        .vgr-account-menu {
          background: none; border: none; cursor: pointer;
          color: var(--vgr-text-muted); font-size: 16px;
          padding: 4px 8px; border-radius: 6px; transition: all 0.15s;
        }
        .vgr-account-menu:hover { background: rgba(255,255,255,0.8); color: var(--vgr-text); }

        .vgr-main { flex: 1; padding: 32px 40px; min-width: 0; }
        .vgr-page-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 24px;
        }
        .vgr-page-title {
          font-family: "Playfair Display", serif;
          font-size: 32px; font-weight: 700; margin: 0;
          letter-spacing: -0.5px;
        }
        .vgr-page-sub { font-size: 14px; color: var(--vgr-text-muted); margin: 4px 0 0; }

        .vgr-btn {
          font-family: inherit;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 9px 16px; font-size: 13px; font-weight: 600;
          border: 1px solid var(--vgr-border); border-radius: 8px;
          background: white; color: var(--vgr-text); cursor: pointer;
          transition: all 0.15s;
        }
        .vgr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .vgr-btn:hover:not(:disabled) { background: var(--vgr-bg); }
        .vgr-btn-export { color: var(--vgr-purple); border-color: rgba(139,92,246,0.3); }
        .vgr-btn-export:hover:not(:disabled) { background: rgba(139,92,246,0.05); }
        .vgr-btn-reset { color: var(--vgr-text-muted); }
        .vgr-btn-ghost { background: transparent; border-color: transparent; color: var(--vgr-text-muted); }
        .vgr-btn-ghost:hover:not(:disabled) {
          background: white; border-color: var(--vgr-border); color: var(--vgr-text);
        }
        .vgr-btn-icon { font-size: 14px; line-height: 1; }
        .vgr-btn-primary { background: linear-gradient(90deg, #6c8eef, #ec90c6); color: white; border-color: transparent; }
        .vgr-btn-primary:hover:not(:disabled) { opacity: 0.92; }
        .vgr-btn-warn { background: #fff3c4; border-color: #d4af37; color: #6a4f00; }
        .vgr-btn-danger { background: #ef4444; color: white; border-color: transparent; }
        .vgr-btn-danger:hover:not(:disabled) { background: #dc2626; }

        .vgr-filters {
          background: white; border: 1px solid var(--vgr-border);
          border-radius: 14px; padding: 20px 24px; margin-bottom: 20px;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1.5fr auto;
          gap: 16px; align-items: end;
        }
        @media (max-width: 1500px) {
          .vgr-filters { grid-template-columns: 1fr 1fr 1fr 1fr; }
          .vgr-filter-group-date { grid-column: span 2; }
        }
        @media (max-width: 900px) {
          .vgr-filters { grid-template-columns: 1fr 1fr; }
          .vgr-filter-group-date { grid-column: span 2; }
        }
        .vgr-filter-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .vgr-filter-label {
          font-size: 11px; font-weight: 600; color: var(--vgr-text-muted);
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .vgr-input, .vgr-select {
          font-family: inherit; padding: 9px 12px; font-size: 13px;
          border: 1px solid var(--vgr-border); border-radius: 8px;
          background: white; color: var(--vgr-text); outline: none;
          transition: border-color 0.15s; width: 100%;
        }
        .vgr-input:focus, .vgr-select:focus { border-color: var(--vgr-blue); }
        .vgr-search-wrap { position: relative; }
        .vgr-search-icon {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          color: var(--vgr-text-light); font-size: 14px; pointer-events: none;
        }
        .vgr-search-wrap .vgr-input { padding-right: 32px; }
        .vgr-date-range { display: flex; align-items: center; gap: 6px; }
        .vgr-date-sep { color: var(--vgr-text-light); font-size: 12px; flex-shrink: 0; }
        .vgr-input-date { font-size: 12px; padding: 9px 8px; }

        .vgr-total-row {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px; padding: 0 4px;
        }
        .vgr-total {
          display: flex; align-items: center; gap: 8px;
          font-size: 14px; color: var(--vgr-text-muted);
          background: white; padding: 8px 14px;
          border-radius: 8px; border: 1px solid var(--vgr-border);
        }
        .vgr-total-icon { color: var(--vgr-purple); }
        .vgr-total-note { color: var(--vgr-text-light); font-size: 12px; }

        .vgr-table-card {
          background: white; border: 1px solid var(--vgr-border);
          border-radius: 14px; overflow: hidden;
        }
        .vgr-table-loading, .vgr-table-empty {
          padding: 60px 20px; text-align: center; color: var(--vgr-text-muted);
        }
        .vgr-link {
          background: none; border: none; color: var(--vgr-blue);
          cursor: pointer; font: inherit; padding: 0; text-decoration: underline;
        }
        .vgr-table-scroll { overflow-x: auto; }
        .vgr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .vgr-th {
          text-align: left; padding: 14px 16px;
          font-size: 11px; font-weight: 700; color: var(--vgr-text-muted);
          text-transform: uppercase; letter-spacing: 0.7px;
          border-bottom: 1px solid var(--vgr-border);
          background: #fafafa; white-space: nowrap;
          cursor: pointer; user-select: none; transition: color 0.15s;
        }
        .vgr-th:hover { color: var(--vgr-text); }
        .vgr-th-actions { cursor: default; }
        .vgr-th-actions:hover { color: var(--vgr-text-muted); }
        .vgr-sort-arrow { margin-left: 4px; font-size: 9px; color: var(--vgr-text-light); }
        .vgr-sort-arrow.active { color: var(--vgr-blue); }
        .vgr-table tbody tr { transition: background 0.15s; cursor: pointer; }
        .vgr-table tbody tr:hover { background: #fafaf8; }
        .vgr-table tbody td {
          padding: 14px 16px; border-bottom: 1px solid var(--vgr-border-light); vertical-align: middle;
        }
        .vgr-table tbody tr:last-child td { border-bottom: none; }

        .vgr-name-cell { display: flex; align-items: center; gap: 10px; }
        .vgr-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; flex-shrink: 0;
        }
        .vgr-avatar-lg { width: 56px; height: 56px; font-size: 16px; }
        .vgr-name-text { font-weight: 500; color: var(--vgr-text); white-space: nowrap; }
        .vgr-email { color: var(--vgr-text-muted); white-space: nowrap; }

        .vgr-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; font-size: 11px; font-weight: 600;
          border-radius: 999px; white-space: nowrap;
        }
        .vgr-pill-purple { background: rgba(139,92,246,0.12); color: #7c3aed; }
        .vgr-pill-blue { background: rgba(108,142,239,0.15); color: #4267d4; }
        .vgr-pill-yellow { background: rgba(245,158,11,0.15); color: #b45309; }
        .vgr-pill-amber { background: rgba(245,158,11,0.15); color: #b45309; }
        .vgr-pill-pink { background: rgba(236,144,198,0.18); color: #be4a8b; }
        .vgr-pill-green { background: rgba(34,197,94,0.12); color: #15803d; }
        .vgr-pill-gray { background: #f0eeea; color: #777; }
        .vgr-pill-red { background: rgba(239,68,68,0.12); color: #b91c1c; }

        .vgr-gender-cell { display: inline-flex; align-items: center; gap: 6px; }
        .vgr-gender-icon {
          width: 18px; height: 18px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: white; flex-shrink: 0;
        }
        .vgr-gender-icon.girl { background: #ec90c6; }
        .vgr-gender-icon.boy { background: #6c8eef; }
        .vgr-gender-icon.pending { background: #f59e0b; }
        .vgr-gender-icon.hidden {
          background: linear-gradient(135deg, #d4dcfa, #fadce9); color: #555;
        }
        .vgr-gender-blur {
          color: transparent; text-shadow: 0 0 8px rgba(0,0,0,0.5);
          cursor: pointer; padding: 2px 8px;
          background: linear-gradient(90deg, #d4dcfa, #fadce9);
          border-radius: 4px; font-weight: 600; font-size: 11px; letter-spacing: 1px;
        }
        .vgr-gender-blur:hover { opacity: 0.9; }

        .vgr-video-cell { display: inline-flex; align-items: center; gap: 6px; }
        .vgr-video-uploaded {
          display: inline-flex; align-items: center; gap: 4px;
          color: #15803d; font-size: 12px; font-weight: 600;
        }
        .vgr-video-edit {
          background: none; border: none; cursor: pointer; padding: 4px;
          color: var(--vgr-text-light); border-radius: 4px; font-size: 12px;
        }
        .vgr-video-edit:hover { color: var(--vgr-blue); background: rgba(108,142,239,0.08); }
        .vgr-video-upload-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; font-size: 12px; font-weight: 600;
          color: var(--vgr-blue); background: rgba(108,142,239,0.08);
          border: 1px solid rgba(108,142,239,0.3); border-radius: 6px;
          cursor: pointer; font-family: inherit;
        }
        .vgr-video-upload-btn:hover { background: rgba(108,142,239,0.15); }

        .vgr-actions-cell { position: relative; }
        .vgr-actions-btn {
          background: none; border: none; cursor: pointer;
          padding: 6px 8px; color: var(--vgr-text-muted);
          border-radius: 6px; font-size: 16px; line-height: 1;
        }
        .vgr-actions-btn:hover { background: var(--vgr-bg); color: var(--vgr-text); }
        .vgr-actions-menu {
          position: absolute; right: 12px; top: 100%; margin-top: 4px;
          background: white; border: 1px solid var(--vgr-border);
          border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          padding: 6px; z-index: 50; min-width: 180px;
        }
        .vgr-actions-menu button {
          display: block; width: 100%; text-align: left;
          padding: 8px 12px; background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: 13px; color: var(--vgr-text); border-radius: 6px;
        }
        .vgr-actions-menu button:hover:not(:disabled) { background: var(--vgr-bg); }
        .vgr-actions-menu button:disabled { opacity: 0.4; cursor: not-allowed; }
        .vgr-actions-menu button.danger { color: var(--vgr-red); }
        .vgr-actions-menu .vgr-actions-divider {
          height: 1px; background: var(--vgr-border-light); margin: 4px 0;
        }

        .vgr-pagination {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 20px; border-top: 1px solid var(--vgr-border-light);
          background: #fafafa;
        }
        .vgr-pagination-info { font-size: 12px; color: var(--vgr-text-muted); }
        .vgr-page-btns { display: flex; gap: 4px; align-items: center; }
        .vgr-page-btn {
          min-width: 32px; height: 32px; padding: 0 8px;
          border-radius: 8px; background: white;
          border: 1px solid var(--vgr-border); color: var(--vgr-text);
          cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600;
        }
        .vgr-page-btn:hover:not(:disabled):not(.active) { background: var(--vgr-bg); }
        .vgr-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .vgr-page-btn.active {
          background: linear-gradient(135deg, #8b5cf6, #ec90c6);
          color: white; border-color: transparent;
        }
        .vgr-page-ellipsis { color: var(--vgr-text-light); padding: 0 4px; }

        .vgr-deleted-section {
          margin-top: 24px; background: white;
          border: 1px solid var(--vgr-border);
          border-radius: 14px; padding: 14px 20px;
        }
        .vgr-deleted-section summary {
          font-size: 13px; font-weight: 600;
          color: var(--vgr-text-muted); cursor: pointer; padding: 4px 0;
        }
        .vgr-deleted-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
        .vgr-deleted-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 14px; background: var(--vgr-bg);
          border-radius: 8px; font-size: 13px;
        }
        .vgr-deleted-meta { color: var(--vgr-text-muted); font-size: 12px; }

        .vgr-overlay {
          position: fixed; inset: 0;
          background: rgba(20,15,30,0.55); backdrop-filter: blur(4px);
          z-index: 100; display: flex; padding: 32px; overflow: auto;
        }
        .vgr-overlay-content {
          background: white; border-radius: 18px;
          width: 100%; max-width: 980px; margin: auto; padding: 0;
          box-shadow: 0 24px 60px rgba(0,0,0,0.18); overflow: hidden;
        }
        .vgr-overlay-hero {
          background: linear-gradient(135deg, #fadce9 0%, #d4dcfa 100%);
          padding: 28px 32px;
          display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
        }
        .vgr-overlay-hero-info { display: flex; gap: 16px; align-items: center; }
        .vgr-overlay-title {
          font-family: "Playfair Display", serif;
          font-size: 28px; font-weight: 700; margin: 0;
        }
        .vgr-overlay-sub { font-size: 13px; color: var(--vgr-text-muted); margin: 2px 0 0; }
        .vgr-overlay-close {
          background: rgba(255,255,255,0.7); border: none;
          width: 36px; height: 36px; border-radius: 50%;
          font-size: 18px; cursor: pointer; color: var(--vgr-text);
        }
        .vgr-overlay-close:hover { background: white; }
        .vgr-overlay-body { padding: 28px 32px; }
        .vgr-section { margin-bottom: 28px; }
        .vgr-section h3 {
          font-family: "Playfair Display", serif;
          font-size: 17px; font-weight: 600;
          margin: 0 0 14px; color: var(--vgr-text);
        }
        .vgr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 28px; }
        .vgr-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 28px; }
        .vgr-field-label {
          font-size: 11px; font-weight: 600; color: var(--vgr-text-light);
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;
        }
        .vgr-field-value { font-size: 14px; color: var(--vgr-text); word-break: break-word; }
        .vgr-photos {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px;
        }
        .vgr-photo {
          width: 100%; aspect-ratio: 1; object-fit: cover;
          border-radius: 10px; border: 1px solid var(--vgr-border);
        }
        .vgr-stages {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px;
        }
        .vgr-stage {
          padding: 12px 10px; background: #faf8fa;
          border: 2px solid transparent; border-radius: 10px; text-align: center;
        }
        .vgr-stage.done {
          background: linear-gradient(135deg, rgba(108,142,239,0.12), rgba(236,144,198,0.12));
          border-color: rgba(139,92,246,0.25);
        }
        .vgr-stage-label { font-size: 11px; font-weight: 600; margin-bottom: 4px; color: var(--vgr-text); }
        .vgr-stage-when { font-size: 10px; color: var(--vgr-text-muted); }
        .vgr-actions-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .vgr-self-warning {
          background: #fff3c4; color: #6a4f00;
          padding: 12px 16px; border-radius: 10px;
          font-size: 13px; margin-bottom: 14px;
        }

        .vgr-video-modal {
          position: fixed; inset: 0;
          background: rgba(20,15,30,0.55); backdrop-filter: blur(4px);
          z-index: 200;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
        }
        .vgr-video-modal-content {
          background: white; border-radius: 16px; padding: 32px;
          max-width: 460px; width: 100%; text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .vgr-video-modal-icon { font-size: 40px; margin-bottom: 12px; }
        .vgr-video-modal h3 {
          font-family: "Playfair Display", serif; font-size: 22px; margin: 0 0 8px;
        }
        .vgr-video-modal p {
          color: var(--vgr-text-muted); font-size: 14px; line-height: 1.5; margin: 0 0 20px;
        }
        .vgr-progress-bar {
          height: 8px; background: var(--vgr-bg);
          border-radius: 999px; overflow: hidden; margin: 16px 0 8px;
        }
        .vgr-progress-fill {
          height: 100%; width: 0%;
          background: linear-gradient(90deg, #6c8eef, #ec90c6);
          border-radius: 999px; transition: width 0.3s;
        }
      `}</style>
    </div>
  );
}

// ─── Sortable column header ─────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = sortKey === currentKey;
  return (
    <th className="vgr-th" onClick={() => onClick(sortKey)}>
      {label}
      <span className={`vgr-sort-arrow ${active ? "active" : ""}`}>
        {active ? (currentDir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </th>
  );
}

// ─── Pagination ─────────────────────────────────────────────────────────────

function Pagination({
  current,
  total,
  onPage,
}: {
  current: number;
  total: number;
  onPage: (n: number) => void;
}) {
  // Compact page list with ellipsis, max ~7 visible
  const pages: (number | "…")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push("…");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push("…");
    pages.push(total);
  }

  return (
    <div className="vgr-page-btns">
      <button
        className="vgr-page-btn"
        disabled={current === 1}
        onClick={() => onPage(current - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p, idx) =>
        p === "…" ? (
          <span key={`e-${idx}`} className="vgr-page-ellipsis">
            …
          </span>
        ) : (
          <button
            key={p}
            className={`vgr-page-btn ${p === current ? "active" : ""}`}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="vgr-page-btn"
        disabled={current === total}
        onClick={() => onPage(current + 1)}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}

// ─── User table row ─────────────────────────────────────────────────────────

function UserTableRow({
  user,
  onSelect,
  onUploadClick,
  getIdToken,
}: {
  user: UserRow;
  onSelect: () => void;
  onUploadClick: () => void;
  getIdToken: () => Promise<string>;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const e = user.latestEnquiry;
  const status = deriveOverallStatus(e);
  const videoStatus = deriveVideoStatus(e);
  const planLabel =
    user.activePlan && user.activePlan !== "none" ? user.activePlan : "None";

  const planPillClass =
    user.activePlan === "premium"
      ? "vgr-pill-purple"
      : user.activePlan === "basic"
      ? "vgr-pill-blue"
      : user.activePlan === "spark"
      ? "vgr-pill-pink"
      : "vgr-pill-gray";

  return (
    <tr onClick={onSelect}>
      <td>
        <div className="vgr-name-cell">
          <div
            className="vgr-avatar"
            style={{
              background: avatarColor(user.email),
              color: avatarTextColor(user.email),
            }}
          >
            {getInitials(user.fullName, user.email)}
          </div>
          <div className="vgr-name-text">{user.fullName || "—"}</div>
        </div>
      </td>
      <td className="vgr-email">{user.email || "—"}</td>
      <td>
        <span className={`vgr-pill ${planPillClass}`}>
          {planLabel.charAt(0).toUpperCase() + planLabel.slice(1)}
        </span>
      </td>
      <td>
        <GenderCell enquiry={e} getIdToken={getIdToken} />
      </td>
      <td className="vgr-email">{e?.revealAt ? fmtDate(e.revealAt) : "—"}</td>
      <td>
        {e ? (
          <span
            className={`vgr-pill ${
              e.mode === "reveal" ? "vgr-pill-pink" : "vgr-pill-green"
            }`}
          >
            {e.mode === "reveal" ? "Reveal" : "Announcement"}
          </span>
        ) : (
          <span className="vgr-pill vgr-pill-gray">—</span>
        )}
      </td>
      <td>
        <span
          className={`vgr-pill vgr-pill-${
            status.tone === "green"
              ? "green"
              : status.tone === "yellow"
              ? "yellow"
              : status.tone === "blue"
              ? "blue"
              : "gray"
          }`}
        >
          {status.label}
        </span>
      </td>
      <td onClick={(ev) => ev.stopPropagation()}>
        {videoStatus === "uploaded" ? (
          <div className="vgr-video-cell">
            <span className="vgr-video-uploaded">
              <span style={{ fontSize: 10 }}>✓</span> Uploaded
            </span>
            <button
              className="vgr-video-edit"
              onClick={onUploadClick}
              title="Replace video"
              aria-label="Replace video"
            >
              ✎
            </button>
          </div>
        ) : videoStatus === "pending" ? (
          <button className="vgr-video-upload-btn" onClick={onUploadClick}>
            <span style={{ fontSize: 12 }}>↑</span> Upload Video
          </button>
        ) : (
          <span className="vgr-pill vgr-pill-gray">—</span>
        )}
      </td>
      <td className="vgr-actions-cell" onClick={(ev) => ev.stopPropagation()}>
        <button
          className="vgr-actions-btn"
          onClick={() => setActionsOpen((o) => !o)}
          aria-label="Actions"
        >
          ⋯
        </button>
        {actionsOpen && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 40 }}
              onClick={() => setActionsOpen(false)}
            />
            <div className="vgr-actions-menu">
              <button
                onClick={() => {
                  setActionsOpen(false);
                  onSelect();
                }}
              >
                View profile
              </button>
              <div className="vgr-actions-divider" />
              <button
                onClick={() => {
                  setActionsOpen(false);
                  onSelect();
                }}
              >
                Manage user…
              </button>
            </div>
          </>
        )}
      </td>
    </tr>
  );
}

// ─── Gender cell with click-to-reveal ───────────────────────────────────────

function GenderCell({
  enquiry,
  getIdToken,
}: {
  enquiry: EnquiryData | null;
  getIdToken: () => Promise<string>;
}) {
  const [revealed, setRevealed] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notSubmitted, setNotSubmitted] = useState(false);

  if (!enquiry) {
    return (
      <span className="vgr-gender-cell">
        <span className="vgr-gender-icon hidden">—</span>
        <span style={{ color: "#999" }}>—</span>
      </span>
    );
  }

  const handleClick = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (loading) return;
    if (revealed) {
      setRevealed(false);
      return;
    }
    if (value) {
      setRevealed(true);
      return;
    }
    setLoading(true);
    setNotSubmitted(false);
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
        setNotSubmitted(true);
        return;
      }
      setValue(data.gender);
      setRevealed(true);
    } catch (err) {
      console.error(err);
      alert("Failed to decrypt gender.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <span className="vgr-gender-cell" style={{ color: "#999" }}>
        Decrypting…
      </span>
    );
  }
  if (notSubmitted) {
    return (
      <span className="vgr-gender-cell" onClick={handleClick}>
        <span className="vgr-gender-icon pending">?</span>
        <span style={{ color: "#b45309" }}>Pending</span>
      </span>
    );
  }
  if (revealed && value) {
    const isGirl = value.toLowerCase() === "girl";
    return (
      <span
        className="vgr-gender-cell"
        onClick={handleClick}
        title="Click to hide"
      >
        <span className={`vgr-gender-icon ${isGirl ? "girl" : "boy"}`}>
          {isGirl ? "♀" : "♂"}
        </span>
        <span
          style={{
            color: isGirl ? "#be4a8b" : "#4267d4",
            fontWeight: 600,
          }}
        >
          {isGirl ? "Girl" : "Boy"}
        </span>
      </span>
    );
  }
  return (
    <span
      className="vgr-gender-cell"
      onClick={handleClick}
      title="Click to reveal"
    >
      <span className="vgr-gender-icon hidden">?</span>
      <span className="vgr-gender-blur">HIDDEN</span>
    </span>
  );
}

// ─── User profile overlay (unified — account + plan + reveal + photos + actions) ───

function UserProfileOverlay({
  user,
  onClose,
  onDisable,
  onEnable,
  onSoftDelete,
  onHardDelete,
  actionInProgress,
  isSelf,
  getIdToken,
  onUploadClick,
}: {
  user: UserRow;
  onClose: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onSoftDelete: () => void;
  onHardDelete: () => void;
  actionInProgress: boolean;
  isSelf: boolean;
  getIdToken: () => Promise<string>;
  onUploadClick: () => void;
}) {
  const e = user.latestEnquiry;
  const status = deriveOverallStatus(e);

  // Mode-specific stages: announcement = 5, reveal = 7
  const allStages: Array<[keyof EnquiryData["stages"], string]> = [
    ["paymentReceived", "Payment"],
    ["revealerLinkSent", "Link sent"],
    ["revealerSubmitted", "Revealer in"],
    ["videoGenerated", "Video"],
    ["guestInvitesSent", "Invites"],
    ["eventScheduled", "Scheduled"],
    ["eventCompleted", "Completed"],
  ];
  const stages = e
    ? e.mode === "reveal"
      ? allStages
      : allStages.filter(
          ([k]) => k !== "revealerLinkSent" && k !== "revealerSubmitted"
        )
    : [];

  return (
    <div className="vgr-overlay" onClick={onClose}>
      <div
        className="vgr-overlay-content"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Hero header */}
        <div className="vgr-overlay-hero">
          <div className="vgr-overlay-hero-info">
            <div
              className="vgr-avatar vgr-avatar-lg"
              style={{
                background: avatarColor(user.email),
                color: avatarTextColor(user.email),
              }}
            >
              {getInitials(user.fullName, user.email)}
            </div>
            <div>
              <h2 className="vgr-overlay-title">
                {user.fullName || "Unnamed user"}
              </h2>
              <p className="vgr-overlay-sub">
                {user.email}
                {user.phone ? ` · ${user.phone}` : ""}
              </p>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {user.role?.toLowerCase() === "admin" && (
                  <span className="vgr-pill vgr-pill-purple">Admin</span>
                )}
                {user.isDeleted || user.status === "disabled" ? (
                  <span className="vgr-pill vgr-pill-red">Disabled</span>
                ) : (
                  <span className="vgr-pill vgr-pill-green">Active</span>
                )}
                {user.activePlan && user.activePlan !== "none" && (
                  <span className="vgr-pill vgr-pill-blue">
                    {user.activePlan.charAt(0).toUpperCase() +
                      user.activePlan.slice(1)}{" "}
                    plan
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            className="vgr-overlay-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="vgr-overlay-body">
          {/* Account info */}
          <div className="vgr-section">
            <h3>Account Information</h3>
            <div className="vgr-grid-3">
              <div>
                <div className="vgr-field-label">Provider</div>
                <div className="vgr-field-value">{user.provider || "—"}</div>
              </div>
              <div>
                <div className="vgr-field-label">Email Verified</div>
                <div className="vgr-field-value">
                  {user.emailVerified ? "Yes" : "No"}
                </div>
              </div>
              <div>
                <div className="vgr-field-label">Last Login</div>
                <div className="vgr-field-value">
                  {fmtDateTime(user.lastLogin)}
                </div>
              </div>
              <div>
                <div className="vgr-field-label">Joined</div>
                <div className="vgr-field-value">
                  {fmtDateTime(user.createdAt)}
                </div>
              </div>
              <div>
                <div className="vgr-field-label">User ID</div>
                <div
                  className="vgr-field-value"
                  style={{ fontSize: 11, fontFamily: "monospace" }}
                >
                  {user.uid}
                </div>
              </div>
            </div>
          </div>

          {/* Plan & spending */}
          <div className="vgr-section">
            <h3>Plan & Spending</h3>
            <div className="vgr-grid-3">
              <div>
                <div className="vgr-field-label">Active Plan</div>
                <div className="vgr-field-value">{user.activePlan}</div>
              </div>
              <div>
                <div className="vgr-field-label">Total Spent</div>
                <div className="vgr-field-value">
                  {fmtMoney(user.totalSpentCents)}
                </div>
              </div>
              <div>
                <div className="vgr-field-label">Total Purchases</div>
                <div className="vgr-field-value">{user.totalPurchases}</div>
              </div>
              <div>
                <div className="vgr-field-label">Reveals Used</div>
                <div className="vgr-field-value">{user.revealsCreated}</div>
              </div>
              <div>
                <div className="vgr-field-label">Reveals Remaining</div>
                <div className="vgr-field-value">{user.revealsAllowed}</div>
              </div>
            </div>
          </div>

          {/* Latest reveal */}
          {e ? (
            <>
              <div className="vgr-section">
                <h3>
                  Latest Reveal —{" "}
                  <span
                    className={`vgr-pill vgr-pill-${
                      status.tone === "green"
                        ? "green"
                        : status.tone === "yellow"
                        ? "yellow"
                        : status.tone === "blue"
                        ? "blue"
                        : "gray"
                    }`}
                  >
                    {status.label}
                  </span>
                </h3>
                <div className="vgr-grid">
                  <div>
                    <div className="vgr-field-label">Mode</div>
                    <div className="vgr-field-value">
                      <span
                        className={`vgr-pill ${
                          e.mode === "reveal"
                            ? "vgr-pill-pink"
                            : "vgr-pill-green"
                        }`}
                      >
                        {e.mode === "reveal" ? "Reveal" : "Announcement"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="vgr-field-label">Plan</div>
                    <div className="vgr-field-value">{e.plan || "—"}</div>
                  </div>
                  <div>
                    <div className="vgr-field-label">Reveal Date</div>
                    <div className="vgr-field-value">
                      {fmtDateTime(e.revealAt)} ({e.revealTimezone})
                    </div>
                  </div>
                  <div>
                    <div className="vgr-field-label">Guest Count</div>
                    <div className="vgr-field-value">{e.guestCount}</div>
                  </div>
                  <div>
                    <div className="vgr-field-label">Gender</div>
                    <div className="vgr-field-value">
                      <GenderCell enquiry={e} getIdToken={getIdToken} />
                    </div>
                  </div>
                  {e.mode === "announcement" ? (
                    <div>
                      <div className="vgr-field-label">Baby Name</div>
                      <div className="vgr-field-value">
                        {e.babyName || "—"}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="vgr-field-label">Girl Name</div>
                        <div className="vgr-field-value">
                          {e.babyNameGirl || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="vgr-field-label">Boy Name</div>
                        <div className="vgr-field-value">
                          {e.babyNameBoy || "—"}
                        </div>
                      </div>
                    </>
                  )}
                  <div>
                    <div className="vgr-field-label">Enquiry ID</div>
                    <div
                      className="vgr-field-value"
                      style={{ fontSize: 11, fontFamily: "monospace" }}
                    >
                      {e.id}
                    </div>
                  </div>
                </div>
              </div>

              {/* Revealer (reveal mode only) */}
              {e.mode === "reveal" && (
                <div className="vgr-section">
                  <h3>Revealer</h3>
                  <div className="vgr-grid-3">
                    <div>
                      <div className="vgr-field-label">Email</div>
                      <div className="vgr-field-value">
                        {e.revealerEmail || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="vgr-field-label">Relation</div>
                      <div className="vgr-field-value">
                        {e.revealerRelation || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="vgr-field-label">Name</div>
                      <div className="vgr-field-value">
                        {e.revealerName || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Photos */}
              {e.photos.length > 0 && (
                <div className="vgr-section">
                  <h3>Photos ({e.photos.length})</h3>
                  <div className="vgr-photos">
                    {e.photos.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="vgr-photo"
                          src={url}
                          alt={`Photo ${i + 1}`}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Video */}
              <div className="vgr-section">
                <h3>Video</h3>
                <div
                  style={{
                    padding: 18,
                    background: "#faf8fa",
                    borderRadius: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {e.videoUrl
                        ? "Video uploaded"
                        : e.stages.paymentReceived
                        ? "Awaiting upload"
                        : "Not yet uploaded"}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--vgr-text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {e.videoUrl
                        ? "Click to replace the current video."
                        : "Cloudflare Stream upload integration coming soon."}
                    </div>
                  </div>
                  <button
                    className="vgr-btn vgr-btn-primary"
                    onClick={onUploadClick}
                  >
                    {e.videoUrl ? "Replace Video" : "Upload Video"}
                  </button>
                </div>
              </div>

              {/* Progress (mode-specific) */}
              <div className="vgr-section">
                <h3>
                  Progress — {stages.length} stages (
                  {e.mode === "reveal" ? "Reveal flow" : "Announcement flow"}
                  )
                </h3>
                <div className="vgr-stages">
                  {stages.map(([key, label]) => (
                    <div
                      key={key}
                      className={`vgr-stage ${e.stages[key] ? "done" : ""}`}
                    >
                      <div className="vgr-stage-label">{label}</div>
                      <div className="vgr-stage-when">
                        {e.stages[key] ? fmtDate(e.stages[key]) : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="vgr-section">
              <h3>Reveal</h3>
              <p
                style={{
                  color: "var(--vgr-text-muted)",
                  fontStyle: "italic",
                }}
              >
                This user hasn&apos;t created a reveal yet.
              </p>
            </div>
          )}

          {/* Admin actions */}
          <div className="vgr-section">
            <h3>Admin Actions</h3>
            {isSelf && (
              <div className="vgr-self-warning">
                ⚠️ This is your own account. You can&apos;t disable or delete
                yourself.
              </div>
            )}
            <div className="vgr-actions-row">
              {!isSelf &&
                (user.isDeleted || user.status === "disabled" ? (
                  <button
                    className="vgr-btn vgr-btn-primary"
                    onClick={onEnable}
                    disabled={actionInProgress}
                  >
                    Enable User
                  </button>
                ) : (
                  <button
                    className="vgr-btn vgr-btn-warn"
                    onClick={onDisable}
                    disabled={actionInProgress}
                  >
                    Disable User
                  </button>
                ))}
              {!isSelf && !user.isDeleted && (
                <button
                  className="vgr-btn"
                  onClick={onSoftDelete}
                  disabled={actionInProgress}
                >
                  Soft Delete
                </button>
              )}
              {!isSelf && (
                <button
                  className="vgr-btn vgr-btn-danger"
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
    </div>
  );
}

// ─── Video upload placeholder modal ─────────────────────────────────────────

function VideoUploadModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="vgr-video-modal" onClick={onClose}>
      <div
        className="vgr-video-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vgr-video-modal-icon">📤</div>
        <h3>Video Upload</h3>
        <p>
          Cloudflare Stream integration is coming soon. Once enabled, you&apos;ll
          be able to upload videos directly from this dialog and watch real-time
          upload progress.
        </p>
        <div className="vgr-progress-bar">
          <div className="vgr-progress-fill" />
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--vgr-text-light)",
            marginBottom: 20,
          }}
        >
          Upload pipeline: pending Cloudflare setup
        </div>
        <button className="vgr-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
