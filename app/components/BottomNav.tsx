"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "explore", label: "Explore", href: "/" },
  { icon: "favorite", label: "Saved", href: "#" },
  { icon: "group_add", label: "Match", href: "/dashboard/seeker" },
  { icon: "person", label: "Profile", href: "/dashboard/owner" },
];

interface BottomNavProps {
  activeTab?: string;
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const pathname = usePathname();

  const getIsActive = (item: (typeof navItems)[0]) => {
    if (activeTab) return item.label === activeTab;
    return pathname === item.href;
  };

  return (
    <nav className="md:hidden fixed bottom-6 inset-x-6 rounded-3xl z-50 glass-panel shadow-ambient-up">
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
