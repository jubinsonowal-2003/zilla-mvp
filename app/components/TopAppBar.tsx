"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

interface TopAppBarProps {
  avatarUrl?: string;
  showSearch?: boolean;
  showDesktopSearch?: boolean;
  showPreferences?: boolean;
  label?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

/* ─── Menu items ────────────────────────────────────────────────────────── */
const menuItems = [
  { icon: "person",       label: "Profile",      href: "/dashboard/seeker/profile" },
  { icon: "bookmark",     label: "Saved Rooms",  href: "/dashboard/seeker/saved" },
  { icon: "receipt_long", label: "My Bookings",  href: "/booking" },
];

/* ─── Shared UserMenu dropdown ──────────────────────────────────────────── */
function UserMenu({
  avatarUrl,
  size = "md",
}: {
  avatarUrl?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleLogOut = () => {
    setOpen(false);
    ["zilla_session_id", "zilla_user_role", "zillaPreferences", "zillaUser"].forEach(
      (k) => localStorage.removeItem(k)
    );
    router.push("/role");
  };

  const imgSize = size === "sm" ? "w-7 h-7" : "w-8 h-8";

  return (
    <div ref={menuRef} className="relative">
      {/* Pill trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Open user menu"
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-outline-variant/40 dark:border-slate-700/80 bg-surface-container-lowest dark:bg-slate-900/90 transition-all duration-200 cursor-pointer hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] ${
          open ? "shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-2 ring-indigo-500/20" : ""
        }`}
      >
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-slate-300" aria-hidden="true">
          menu
        </span>
        {avatarUrl ? (
          <div className={`${imgSize} rounded-full overflow-hidden relative flex-shrink-0 border border-slate-200 dark:border-slate-700`}>
            <Image src={avatarUrl} alt="User profile" fill className="object-cover" sizes="32px" />
          </div>
        ) : (
          <div className={`${imgSize} rounded-full bg-primary flex items-center justify-center flex-shrink-0`}>
            <span className="text-on-primary text-xs font-bold font-headline">N</span>
          </div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-52 bg-surface-container-lowest dark:bg-slate-900 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-outline-variant/20 dark:border-slate-800 overflow-hidden z-[300] animate-[fadeIn_0.15s_ease-out]"
        >
          {/* Nav links */}
          <div className="py-1.5">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-body font-medium text-on-surface dark:text-slate-200 hover:bg-surface-container dark:hover:bg-slate-800 transition-colors duration-150"
              >
                <span className="material-symbols-outlined text-[18px] text-outline dark:text-slate-400">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-outline-variant/20 dark:bg-slate-800 mx-3" />

          {/* Log Out */}
          <div className="py-1.5">
            <button
              role="menuitem"
              onClick={handleLogOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body font-medium text-error hover:bg-error/5 dark:hover:bg-error/10 transition-colors duration-150 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── TopAppBar ─────────────────────────────────────────────────────────── */
export default function TopAppBar({
  avatarUrl,
  showSearch = true,
  showDesktopSearch = false,
  showPreferences = false,
  label,
  showBackButton = false,
  onBackClick,
}: TopAppBarProps) {
  return (
    <>
      {/* ══ Desktop Top Bar ══ */}
      <header className="hidden md:flex fixed top-4 inset-x-4 rounded-2xl z-50 glass-panel shadow-ambient items-center justify-between px-6 h-16 max-w-7xl mx-auto border border-white/40 dark:border-slate-800/80">
        {/* Left: back · logo · label */}
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={onBackClick}
              className="p-2 -ml-2 text-primary hover:scale-105 transition-transform duration-200"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <Link href="/" className="text-2xl font-bold tracking-tighter text-primary dark:text-indigo-400 font-headline">
            ZILLA
          </Link>
          {label && (
            <span className="text-sm font-medium text-outline dark:text-slate-400 ml-4 hidden lg:block">{label}</span>
          )}
        </div>

        {/* Right: desktop search · preferences · theme toggle · user menu */}
        <div className="flex items-center gap-3">
          {showDesktopSearch && (
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline dark:text-slate-400">search</span>
                <input
                  className="w-full bg-surface-container-low dark:bg-slate-800/70 text-on-surface dark:text-slate-100 placeholder:text-outline dark:placeholder:text-slate-400 rounded-full py-2 pl-12 pr-4 border-none focus:ring-2 focus:ring-primary/40 focus:outline-none font-body text-sm"
                  placeholder="Search neighborhoods..."
                  type="text"
                />
              </div>
            </div>
          )}
          {showSearch && (
            <button className="hover:scale-105 transition-transform duration-200 p-2 rounded-full text-primary dark:text-indigo-400">
              <span className="material-symbols-outlined">search</span>
            </button>
          )}
          {showPreferences && (
            <Link
              href="/onboarding"
              className="flex items-center gap-1.5 text-xs font-semibold font-body text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-indigo-400 border border-outline-variant/25 dark:border-slate-700/60 hover:border-primary/40 bg-surface-container-low dark:bg-slate-800/60 hover:bg-primary/5 px-3 py-1.5 rounded-full transition-all duration-200"
            >
              <span className="material-symbols-outlined text-[15px]">tune</span>
              Preferences
            </Link>
          )}

          <Link
            href="/booking"
            className="flex items-center gap-1.5 text-xs font-semibold font-body text-primary dark:text-indigo-400 hover:text-primary-container dark:hover:text-indigo-300 border border-primary/30 dark:border-indigo-400/30 hover:border-primary/60 bg-primary/5 dark:bg-indigo-400/10 px-3 py-1.5 rounded-full transition-all duration-200 shadow-sm"
          >
            <span className="material-symbols-outlined text-[15px]">calendar_month</span>
            My Bookings
          </Link>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* Pill user menu */}
          <UserMenu avatarUrl={avatarUrl} size="md" />
        </div>
      </header>

      {/* ══ Mobile Top Bar ══ */}
      <header className="md:hidden fixed top-0 inset-x-0 h-16 glass-panel z-50 flex items-center justify-between px-5 border-b border-slate-200/50 dark:border-slate-800/80">
        {/* Left: back · logo */}
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={onBackClick}
              className="p-2 -ml-2 text-primary hover:scale-105 transition-transform duration-200"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <Link href="/" className="text-2xl font-bold tracking-tighter text-primary dark:text-indigo-400 font-headline">
            ZILLA
          </Link>
        </div>

        {/* Right: prefs · search · theme toggle · pill menu */}
        <div className="flex items-center gap-2">
          {showPreferences && (
            <Link
              href="/onboarding"
              className="flex items-center gap-1 text-xs font-semibold font-body text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-indigo-400 border border-outline-variant/25 dark:border-slate-700/60 hover:border-primary/40 bg-surface-container-low dark:bg-slate-800/60 hover:bg-primary/5 px-2.5 py-1.5 rounded-full transition-all duration-200"
            >
              <span className="material-symbols-outlined text-[14px]">tune</span>
              Prefs
            </Link>
          )}
          {showSearch && (
            <button className="text-primary dark:text-indigo-400 hover:scale-105 transition-transform duration-200 p-1">
              <span className="material-symbols-outlined">search</span>
            </button>
          )}

          <Link
            href="/booking"
            className="text-primary dark:text-indigo-400 hover:scale-105 transition-transform duration-200 p-1 flex items-center"
            aria-label="My Bookings"
          >
            <span className="material-symbols-outlined text-[20px]">calendar_month</span>
          </Link>

          {/* Mobile Theme Toggle */}
          <ThemeToggle />

          {/* Pill user menu — smaller variant */}
          <UserMenu avatarUrl={avatarUrl} size="sm" />
        </div>
      </header>
    </>
  );
}
