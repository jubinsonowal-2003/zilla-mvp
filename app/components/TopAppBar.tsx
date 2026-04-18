"use client";

import Link from "next/link";
import Image from "next/image";

interface TopAppBarProps {
  avatarUrl?: string;
  showSearch?: boolean;
  showDesktopSearch?: boolean;
  label?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export default function TopAppBar({
  avatarUrl,
  showSearch = true,
  showDesktopSearch = false,
  label,
  showBackButton = false,
  onBackClick,
}: TopAppBarProps) {
  return (
    <>
      {/* Desktop Top Bar */}
      <header className="hidden md:flex fixed top-4 inset-x-4 rounded-2xl z-50 glass-panel shadow-ambient items-center justify-between px-6 h-16 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={onBackClick}
              className="p-2 -ml-2 text-primary hover:scale-105 transition-transform duration-200"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          {avatarUrl && (
            <div className="w-10 h-10 rounded-full overflow-hidden hover:scale-105 transition-transform duration-200 cursor-pointer relative">
              <Image
                src={avatarUrl}
                alt="User profile"
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
          )}
          <Link
            href="/"
            className="text-2xl font-bold tracking-tighter text-primary font-headline"
          >
            ZILLA
          </Link>
          {label && (
            <span className="text-sm font-medium text-outline ml-4 hidden lg:block">
              {label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          {showDesktopSearch && (
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                  search
                </span>
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
          {avatarUrl && (
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-surface-container hover:scale-105 transition-transform duration-200 cursor-pointer relative">
              <Image
                src={avatarUrl}
                alt="User profile"
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
          )}
        </div>
      </header>

      {/* Mobile Top Bar */}
      <header className="md:hidden fixed top-0 inset-x-0 h-16 glass-panel z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={onBackClick}
              className="p-2 -ml-2 text-primary hover:scale-105 transition-transform duration-200"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <Link
            href="/"
            className="text-2xl font-bold tracking-tighter text-primary font-headline"
          >
            ZILLA
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {showSearch && (
            <button className="text-primary hover:scale-105 transition-transform duration-200">
              <span className="material-symbols-outlined">search</span>
            </button>
          )}
          {avatarUrl && (
            <div className="w-8 h-8 rounded-full overflow-hidden border border-surface-container relative">
              <Image
                src={avatarUrl}
                alt="User profile"
                fill
                className="object-cover"
                sizes="32px"
              />
            </div>
          )}
        </div>
      </header>
    </>
  );
}
