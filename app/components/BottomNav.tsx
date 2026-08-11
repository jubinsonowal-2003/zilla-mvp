"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ownerNavItems = [
  { icon: "apartment", label: "Listings", href: "/dashboard/owner" },
  { icon: "cloud_upload", label: "Upload", href: "/dashboard/owner" },
  { icon: "person", label: "Profile", href: "/dashboard/owner/profile" },
];

const seekerNavItems = [
  { icon: "explore", label: "Explore", href: "/dashboard/seeker" },
  { icon: "group_add", label: "Matches", href: "/dashboard/seeker" },
  { icon: "bookmark", label: "Saved", href: "/dashboard/seeker/saved" },
  { icon: "person", label: "Profile", href: "/dashboard/seeker/profile" },
];

interface BottomNavProps {
  activeTab?: string;
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRole(localStorage.getItem("zilla_user_role"));
    setMounted(true);
  }, []);

  // Don't render on /role or /login
  if (pathname === "/role" || pathname === "/login") return null;

  // Don't render until we've read localStorage (avoid hydration mismatch)
  if (!mounted) return null;

  // Don't render if no role is set
  if (!role) return null;

  const navItems = role === "owner" ? ownerNavItems : seekerNavItems;

  const getIsActive = (item: (typeof navItems)[0]) => {
    if (activeTab) return item.label === activeTab;
    return pathname === item.href;
  };

  return (
    <nav className="md:hidden fixed bottom-6 inset-x-6 rounded-3xl z-[100] pointer-events-auto glass-panel shadow-ambient-up">
      <div className="flex justify-around items-center h-20 w-full">
        {navItems.map((item) => {
          const isActive = getIsActive(item);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center px-5 py-2 transition-all duration-200 ease-out ${
                isActive
                  ? "bg-primary text-on-primary rounded-2xl"
                  : "text-outline hover:text-primary"
              }`}
            >
              <span
                className={`material-symbols-outlined text-2xl mb-1 ${
                  isActive ? "filled" : ""
                }`}
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                {item.icon}
              </span>
              <span className="font-label text-[10px] font-semibold uppercase tracking-wider">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
