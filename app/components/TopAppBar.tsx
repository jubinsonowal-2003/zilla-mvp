"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-outline-variant/40 bg-surface-container-lowest transition-all duration-200 cursor-pointer hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] ${
          open ? "shadow-[0_2px_12px_rgba(0,0,0,0.12)]" : ""
        }`}
      >
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">
          menu
        </span>
        {avatarUrl ? (
          <div className={`${imgSize} rounded-full overflow-hidden relative flex-shrink-0`}>
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
          className="absolute right-0 mt-2 w-52 bg-surface-container-lowest rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] border border-outline-variant/20 overflow-hidden z-[300] animate-[fadeIn_0.15s_ease-out]"
        >
          {/* Nav links */}
          <div className="py-1.5">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-body font-medium text-on-surface hover:bg-surface-container transition-colors duration-150"
              >
                <span className="material-symbols-outlined text-[18px] text-outline">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-outline-variant/20 mx-3" />

          {/* Log Out */}
          <div className="py-1.5">
            <button
              role="menuitem"
              onClick={handleLogOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body font-medium text-error hover:bg-error/5 transition-colors duration-150 cursor-pointer"
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
      <header className="hidden md:flex fixed top-4 inset-x-4 rounded-2xl z-50 glass-panel shadow-ambient items-center justify-between px-6 h-16 max-w-7xl mx-auto">
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
          <Link href="/" className="text-2xl font-bold tracking-tighter text-primary font-headline">
            ZILLA
          </Link>
          {label && (
            <span className="text-sm font-medium text-outline ml-4 hidden lg:block">{label}</span>
          )}
        </div>

        {/* Right: desktop search · preferences · user menu */}
        <div className="flex items-center gap-4">
          {showDesktopSearch && (
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
                <input
                  className="w-full bg-surface-container-low text-on-surface placeholder:text-outline rounded-full py-2 pl-12 pr-4 border-none focus:ring-2 focus:ring-primary/40 focus:outline-none font-body text-sm"
                  placeholder="Search neighborhoods..."
                  type="text"
                />
              </div>
            </div>
          )}
          {showSearch && (
            <button className="hover:scale-105 transition-transform duration-200 p-2 rounded-full text-primary">
              <span className="material-symbols-outlined">search</span>
            </button>
          )}
          {showPreferences && (
            <Link
              href="/onboarding"
              className="flex items-center gap-1.5 text-xs font-semibold font-body text-on-surface-variant hover:text-primary border border-outline-variant/25 hover:border-primary/40 bg-surface-container-low hover:bg-primary/5 px-3 py-1.5 rounded-full transition-all duration-200"
            >
              <span className="material-symbols-outlined text-[15px]">tune</span>
              Preferences
            </Link>
          )}
          {/* Pill user menu */}
          <UserMenu avatarUrl={avatarUrl} size="md" />
        </div>
      </header>

      {/* ══ Mobile Top Bar ══ */}
      <header className="md:hidden fixed top-0 inset-x-0 h-16 glass-panel z-50 flex items-center justify-between px-5">
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
          <Link href="/" className="text-2xl font-bold tracking-tighter text-primary font-headline">
            ZILLA
          </Link>
        </div>

        {/* Right: prefs · search · pill menu */}
        <div className="flex items-center gap-2.5">
          {showPreferences && (
            <Link
              href="/onboarding"
              className="flex items-center gap-1 text-xs font-semibold font-body text-on-surface-variant hover:text-primary border border-outline-variant/25 hover:border-primary/40 bg-surface-container-low hover:bg-primary/5 px-2.5 py-1.5 rounded-full transition-all duration-200"
            >
              <span className="material-symbols-outlined text-[14px]">tune</span>
              Prefs
            </Link>
          )}
          {showSearch && (
            <button className="text-primary hover:scale-105 transition-transform duration-200 p-1">
              <span className="material-symbols-outlined">search</span>
            </button>
          )}
          {/* Pill user menu — smaller variant */}
          <UserMenu avatarUrl={avatarUrl} size="sm" />
        </div>
      </header>
    </>
  );
}
