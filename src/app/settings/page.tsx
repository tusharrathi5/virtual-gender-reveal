"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function SettingsPage() {
  const { user, firestoreUser, deleteAccount, logout } = useAuth();
  const router = useRouter();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"confirm" | "reauth">("confirm");

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  if (!user || !firestoreUser) return null;

  const isGoogleOnly = firestoreUser.provider === "google";
  const hasEmailProvider = firestoreUser.provider === "email" || firestoreUser.provider === "both";

  function openDeleteModal() {
    setShowDeleteModal(true);
    setDeleteConfirmText("");
    setReauthPassword("");
    setError("");
    setStep("confirm");
  }

  function handleConfirmStep() {
    if (deleteConfirmText !== "DELETE") {
      setError('Please type "DELETE" exactly to confirm.');
      return;
    }
    setError("");
    setStep("reauth");
  }

  async function handleDeleteAccount() {
    setError("");
    setDeleting(true);
    try {
      if (isGoogleOnly) {
        await deleteAccount({ type: "google" });
      } else {
        if (!reauthPassword) { setError("Please enter your password."); setDeleting(false); return; }
        await deleteAccount({ type: "email", password: reauthPassword });
      }
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete account.";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("Incorrect password. Please try again.");
      } else if (msg.includes("requires-recent-login")) {
        setError("Please sign out and sign back in before deleting your account.");
      } else {
        setError(msg.replace("Firebase: ", "").replace(/\s*\(auth\/.*?\)\.?/, "").trim());
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes modalIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:system-ui,-apple-system,sans-serif; background:#f3f4f6; }
        .page { max-width:640px; margin:0 auto; padding:40px 24px; }
        .header { display:flex; align-items:center; gap:16px; margin-bottom:32px; }
        .back-btn { background:none; border:1.5px solid #e5e7eb; border-radius:8px; padding:8px 16px; font-size:13px; color:#374151; cursor:pointer; text-decoration:none; display:inline-block; }
        .back-btn:hover { background:#f9fafb; }
        .page-title { font-size:24px; font-weight:700; color:#111827; }
        .card { background:white; border-radius:16px; padding:28px; margin-bottom:20px; box-shadow:0 1px 8px rgba(0,0,0,0.06); }
        .card-title { font-size:16px; font-weight:600; color:#111827; margin-bottom:20px; }
        .info-row { display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f3f4f6; }
        .info-row:last-child { border-bottom:none; padding-bottom:0; }
        .info-label { font-size:13px; color:#6b7280; font-weight:500; }
        .info-value { font-size:14px; color:#111827; font-weight:500; }
        .badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:500; }
        .badge-blue { background:#eff6ff; color:#1d4ed8; }
        .badge-green { background:#f0fdf4; color:#15803d; }
        .badge-purple { background:#faf5ff; color:#7c3aed; }
        .badge-orange { background:#fff7ed; color:#c2410c; }
        .danger-card { border:1px solid #fee2e2; }
        .danger-title { color:#dc2626; }
        .danger-text { font-size:14px; color:#6b7280; margin-bottom:20px; line-height:1.6; }
        .btn-danger { padding:11px 20px; background:#dc2626; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:background .2s; }
        .btn-danger:hover { background:#b91c1c; }
        /* Modal */
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:1000; padding:24px; }
        .modal { background:white; border-radius:16px; padding:32px; width:100%; max-width:440px; animation:modalIn .2s ease-out; }
        .modal-icon { font-size:40px; margin-bottom:16px; display:block; text-align:center; }
        .modal-title { font-size:20px; font-weight:700; color:#111827; text-align:center; margin-bottom:8px; }
        .modal-text { font-size:14px; color:#6b7280; text-align:center; margin-bottom:24px; line-height:1.6; }
        .modal-warning { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px 14px; font-size:13px; color:#dc2626; margin-bottom:20px; line-height:1.5; }
        .form-label { display:block; font-size:13px; font-weight:500; color:#374151; margin-bottom:6px; }
        .form-input { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; color:#111827; outline:none; transition:border-color .2s; margin-bottom:16px; }
        .form-input:focus { border-color:#dc2626; box-shadow:0 0 0 3px rgba(220,38,38,.1); }
        .error-box { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 12px; color:#dc2626; font-size:13px; margin-bottom:16px; }
        .modal-actions { display:flex; gap:12px; }
        .btn-cancel { flex:1; padding:12px; background:white; color:#374151; border:1.5px solid #e5e7eb; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; }
        .btn-cancel:hover { background:#f9fafb; }
        .btn-delete { flex:1; padding:12px; background:#dc2626; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; }
        .btn-delete:hover:not(:disabled) { background:#b91c1c; }
        .btn-delete:disabled { opacity:.5; cursor:not-allowed; }
        .btn-continue { width:100%; padding:12px; background:#dc2626; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; margin-bottom:10px; }
        .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:white; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; margin-right:8px; }
      `}</style>

      <div className="page">
        <div className="header">
          <a href="/dashboard" className="back-btn">← Dashboard</a>
          <h1 className="page-title">Account Settings</h1>
        </div>

        {/* Account Info */}
        <div className="card">
          <h2 className="card-title">Account Information</h2>
          <div className="info-row">
            <span className="info-label">Full Name</span>
            <span className="info-value">{firestoreUser.fullName}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Email</span>
            <span className="info-value">{firestoreUser.email}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Phone</span>
            <span className="info-value">{firestoreUser.phone || "Not set"}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Role</span>
            <span className={`badge ${firestoreUser.role === "admin" ? "badge-purple" : "badge-blue"}`}>
              {firestoreUser.role === "admin" ? "👑 Admin" : "👤 User"}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Sign-in Method</span>
            <span className={`badge ${firestoreUser.provider === "both" ? "badge-green" : firestoreUser.provider === "google" ? "badge-orange" : "badge-blue"}`}>
              {firestoreUser.provider === "both" ? "🔗 Google + Email" : firestoreUser.provider === "google" ? "🟠 Google" : "✉️ Email"}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Email Verified</span>
            <span className={`badge ${firestoreUser.emailVerified ? "badge-green" : "badge-orange"}`}>
              {firestoreUser.emailVerified ? "✓ Verified" : "⚠ Not verified"}
            </span>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card danger-card">
          <h2 className="card-title danger-title">⚠ Danger Zone</h2>
          <p className="danger-text">
            Permanently delete your account and all associated data. This action
            cannot be undone. Your reveal data, settings, and account information
            will be permanently removed.
          </p>
          <button className="btn-danger" onClick={openDeleteModal}>
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <span className="modal-icon">🗑️</span>
            <h2 className="modal-title">Delete Account</h2>
            <p className="modal-text">
              This will permanently delete your account and all your data.
              This action <strong>cannot be undone</strong>.
            </p>

            <div className="modal-warning">
              ⚠ All your reveals, data, and settings will be permanently deleted.
            </div>

            {error && <div className="error-box">{error}</div>}

            {step === "confirm" && (
              <>
                <label className="form-label">Type <strong>DELETE</strong> to confirm</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  style={{ borderColor: deleteConfirmText && deleteConfirmText !== "DELETE" ? "#ef4444" : undefined }}
                />
                <button
                  className="btn-continue"
                  onClick={handleConfirmStep}
                  disabled={deleteConfirmText !== "DELETE"}
                  style={{ opacity: deleteConfirmText !== "DELETE" ? .4 : 1 }}
                >
                  Continue
                </button>
                <div className="modal-actions">
                  <button className="btn-cancel" onClick={() => setShowDeleteModal(false)}>
                    Cancel
                  </button>
                </div>
              </>
            )}

            {step === "reauth" && (
              <>
                {isGoogleOnly ? (
                  <>
                    <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20, lineHeight: 1.5 }}>
                      You&apos;ll be prompted to re-authenticate with Google to confirm deletion.
                    </p>
                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                      <button className="btn-delete" onClick={handleDeleteAccount} disabled={deleting}>
                        {deleting ? <><span className="spinner" />Deleting...</> : "Re-auth & Delete"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="form-label">Enter your password to confirm</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="Your password"
                      value={reauthPassword}
                      onChange={e => setReauthPassword(e.target.value)}
                      autoFocus
                    />
                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                      <button className="btn-delete" onClick={handleDeleteAccount} disabled={deleting || !reauthPassword}>
                        {deleting ? <><span className="spinner" />Deleting...</> : "Delete My Account"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
