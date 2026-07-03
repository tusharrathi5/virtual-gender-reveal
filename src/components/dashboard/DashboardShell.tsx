"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Sparkles, 
  ChevronRight, 
  ShieldCheck 
} from "lucide-react";

interface DashboardShellProps {
  children: React.ReactNode;
  activeTab?: "dashboard" | "create" | "settings";
  title?: string;
}

export default function DashboardShell({ children, activeTab = "create", title = "Create Your Reveal" }: DashboardShellProps) {
  const { user, firestoreUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Handle keyboard escape key to close drawer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isMobileOpen) {
        setIsMobileOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  // Trap focus within drawer when open for keyboard accessibility
  useEffect(() => {
    if (!isMobileOpen || !drawerRef.current) return;
    const focusableElements = drawerRef.current.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex="0"]'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }

    window.addEventListener("keydown", handleTab);
    firstElement?.focus();
    return () => window.removeEventListener("keydown", handleTab);
  }, [isMobileOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
      setLoggingOut(false);
    }
  };

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      id: "create",
      label: "Create Reveal",
      icon: PlusCircle,
      path: "/new-reveal",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/settings",
    },
  ];

  const planName = firestoreUser?.activePlan ?? "none";
  const planDisplayNames: Record<string, string> = {
    none: "No Plan",
    basic: "Spark Plan",
    premium: "Premium Plan",
    custom: "Custom Plan",
  };
  const isPremium = planName === "premium" || planName === "custom";

  const userDisplayName = firestoreUser?.fullName || user?.displayName || user?.email || "User";
  const userInitials = userDisplayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#fafafd] text-[#111827] flex font-jakarta">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-white border-r border-[#f1f1f5] fixed inset-y-0 left-0 z-40 p-6">
        {/* Brand Logo */}
        <a href="/" className="flex items-center gap-3 mb-8 group focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] rounded-lg p-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E8449A] to-[#3A9FE8] flex items-center justify-center shadow-md shadow-[#e8449a2a] group-hover:scale-105 transition-transform duration-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-nunito font-extrabold text-lg leading-tight bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] bg-clip-text text-transparent">
              Virtual Gender
            </span>
            <span className="text-[10px] tracking-[0.2em] font-medium text-[#c2527a] uppercase font-nunito">
              Reveal
            </span>
          </div>
        </a>

        {/* Navigation Section */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3A9FE8] ${
                  isActive
                    ? "bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white shadow-sm shadow-[#e8449a22]"
                    : "text-[#6b7280] hover:text-[#111827] hover:bg-[#f6f6f9]"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-[#9ca3af]"}`} />
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Plan / Entitlement Badge */}
        {firestoreUser && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-tr from-[#FDE8F2] to-[#D6EAFE] border border-white/60 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-[#1B4F8C]" />
              <span className="text-xs font-semibold text-[#1B4F8C] uppercase tracking-wider">
                Membership
              </span>
            </div>
            <p className="text-sm font-bold text-[#111827]">
              {planDisplayNames[planName] || planName}
            </p>
            {isPremium && (
              <span className="inline-block mt-2 text-[10px] bg-white/70 text-[#C2527A] px-2 py-0.5 rounded-full font-bold">
                PRO FEATURES ACTIVE
              </span>
            )}
          </div>
        )}

        {/* User Profile Info & Sign Out */}
        <div className="border-t border-[#f1f1f5] pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#E07FAA] to-[#2E7DD1] flex items-center justify-center text-white font-bold text-sm shadow-inner shadow-black/10">
              {userInitials}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-[#111827] truncate">
                {userDisplayName}
              </span>
              <span className="text-xs text-[#6b7280] truncate">
                {user?.email}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <LogOut className="w-5 h-5 text-red-400" />
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-[#111827]/40 backdrop-blur-[2px] transition-opacity duration-300"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Drawer content */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
            className="relative flex flex-col w-[280px] bg-white h-full p-6 shadow-2xl transition-transform duration-300 animate-slide-in"
          >
            <div className="flex items-center justify-between mb-8">
              <a href="/" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#E8449A] to-[#3A9FE8] flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="font-nunito font-extrabold text-md bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] bg-clip-text text-transparent">
                  Virtual Reveal
                </span>
              </a>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:bg-[#f3f4f6]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 space-y-1.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <a
                    key={item.id}
                    href={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-[#E8449A] to-[#3A9FE8] text-white shadow-sm"
                        : "text-[#6b7280] hover:text-[#111827] hover:bg-[#f6f6f9]"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </a>
                );
              })}
            </nav>

            {/* Mobile Plan Badge */}
            {firestoreUser && (
              <div className="mb-4 p-4 rounded-xl bg-gradient-to-tr from-[#FDE8F2] to-[#D6EAFE] border border-white">
                <span className="text-[10px] font-bold text-[#1B4F8C] uppercase tracking-wide block mb-0.5">
                  Current plan
                </span>
                <p className="text-sm font-bold text-[#111827]">
                  {planDisplayNames[planName] || planName}
                </p>
              </div>
            )}

            {/* User Profile & Sign Out bottom */}
            <div className="border-t border-[#f1f1f5] pt-4 flex flex-col gap-2">
              <div className="flex items-center gap-3 px-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#E07FAA] to-[#2E7DD1] flex items-center justify-center text-white font-bold text-sm">
                  {userInitials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold truncate">{userDisplayName}</span>
                  <span className="text-xs text-[#6b7280] truncate">{user?.email}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5 text-red-400" />
                {loggingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Layout View Area ── */}
      <div className="flex-1 lg:pl-[280px] flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-[#f1f1f5] px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Hamburger Button */}
            <button
              ref={triggerRef}
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center border border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb] focus:outline-none focus:ring-2 focus:ring-[#3A9FE8]"
              aria-label="Open sidebar menu"
              aria-expanded={isMobileOpen}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Title */}
            <nav className="flex items-center gap-2 text-sm text-[#6b7280]" aria-label="Breadcrumbs">
              <a href="/dashboard" className="hover:text-[#111827] transition-colors">
                Dashboard
              </a>
              <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af]" />
              <span className="font-semibold text-[#111827] truncate max-w-[160px] md:max-w-none">
                {title}
              </span>
            </nav>
          </div>

          {/* Quick Profile Widget */}
          <div className="flex items-center gap-3">
            {firestoreUser && (
              <span className="hidden sm:inline-block text-[11px] font-bold text-[#E8449A] bg-[#FDE8F2] px-2.5 py-1 rounded-full border border-[#f2b8cf]">
                {planDisplayNames[planName] || planName}
              </span>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#E07FAA] to-[#2E7DD1] flex items-center justify-center text-white font-bold text-xs select-none">
              {userInitials}
            </div>
          </div>
        </header>

        {/* Dashboard Content Container */}
        <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Slide-in Keyframe Animation Style */}
      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
