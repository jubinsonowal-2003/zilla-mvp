"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import TopAppBar from "../../components/TopAppBar";
import BottomNav from "../../components/BottomNav";
import { supabase } from "@/lib/supabase";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCWBNlcG9YcIUJqpqMBSxtbZUYqdg0VgM-QcbmI8Vdk5aSiXa7ZUnC_tQ_wVzyydo_HPBEUT-fgARlpVkCrsk_htxt39xXAYiFu3glIFSfs5h2ESQWuwTw6bpfE6MQddAuw5gCkyMN6gSl76uAGZFD_fGVYhwVqSbzpcZU-cksc0Sn_xBKIV_mPyBUEcGrxXWznDvHdtH0ZQMevd6cTA_JrfOtQz07qJF5edYlbe3o3EsVofIofZpQXpIdthVdr7OwH99zVazJ02wQ";

/* ─── Types ─── */
interface Preferences {
  budgetMin: string;
  budgetMax: string;
  preferredArea: string;
  sleepSchedule: string;
  workStyle: string;
  smokingAllowed: boolean;
}

interface Room {
  id: string;
  title: string;
  price: number;
  location: string;
  description: string;
  image_url: string | null;
  status: string;
}

interface SeekerProfile {
  id: string;
  user_id: string;
  full_name: string;
  budget_min: number;
  budget_max: number;
  location: string;
  vibe: string;
  work_style: string;
}

const defaultPrefs: Preferences = {
  budgetMin: "20000",
  budgetMax: "35000",
  preferredArea: "Bandra West",
  sleepSchedule: "Night Owl",
  workStyle: "Remote",
  smokingAllowed: false,
};

/* ─── Matching Algorithm ─── */
// Location is a STRICT filter (applied before this function).
// This function scores only vibe + budget for profiles that already match on location.
function calculateMatch(seeker: SeekerProfile, prefs: Preferences): number {
  // Base: 40% (location is already a 100% match if they passed the filter)
  let score = 40;

  // +35% Vibe (sleep schedule) match
  if (seeker.vibe === prefs.sleepSchedule) {
    score += 35;
  }

  // +25% Budget overlap (user min <= their max AND user max >= their min)
  const userMin = parseInt(prefs.budgetMin) || 0;
  const userMax = parseInt(prefs.budgetMax) || 999999;
  if (userMin <= seeker.budget_max && userMax >= seeker.budget_min) {
    score += 25;
  }

  return score;
}

const roommateAvatars = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBdeLKQmqkDnXZiYFUiWhO92w-BSZ-2BFfoqIizt1NA0DzmZgiEXGv0WNHcQOXgEScX0rWtPHKfj2CwKK-MvmCf6nnOPLbO0Dx_kCx0wQPkKUlAkMQAx-cun6bMj0Asx4n5RsZnq1q0It7TubIpag3vt6xzUMjbYvecqNeM_mGaRC9YbFZ3wKCXnJA2XHkb6WJP20-au_raSVqWmzBHl43G060mZsIt1ff54jB_LF6Fok82ukXrAf-Gve_8dGSD7-g0WMVQ8CRmGxA",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCCgnHWSl8oYI0sf0qoTfaKQlcxFZisVrzg8q3KrsbkY23nEpVX3eE6K5FMfEQv-r5YZzx6wUVulxwEGTVZXaLSSI5ZCfmONrk96gQ841J32USGAacfEi1I8Tw_oK8jyPjkTVSIjoeCn1PYnlx49bJaUj_eK4CaTVboFXtwwqPw3UYaoj4sjrKxHPYOC_bCf8vGQWpKcvRjWCmX3DKjHKbWbuAFMhu9bT7Tq4gctks9zM7gnmZgmqxiWZByu4oHE9LqEeRUxN0Z5Vo",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAoo-V3nvhWHSu4DV_zB0MaT4aty5nWI41K2wrfLE87HL8mobJebOFrq6vXXDCkED8Dr6DIT5cc_AS4qsDDn9VWwr-fc5aj0-JGgImovoZMykOGqcPI--mXg9yeiC0lIchj8aQ-H3-vJDBLKDxH2E9DjfmzXRuLnE4b0GSC_s8XFS6N_10uRbz5XIhO1likb2etn5Xr6Gy3slEdVJbw_PMADkyZEqJlV3MXhzqu0Q1LBf7LG0HyvLl49cFlCA5UZKx9xN3XenNTnto",
];

const filterChips = [
  { icon: "payments", label: "Budget Range" },
  { icon: "bed", label: "Sleep Habits" },
  { icon: "restaurant", label: "Dietary Preferences" },
];

export default function SeekerDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<"rooms" | "roommates">("rooms");
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);

  // Real data from Supabase
  const [rooms, setRooms] = useState<Room[]>([]);
  const [seekers, setSeekers] = useState<SeekerProfile[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingSeekers, setLoadingSeekers] = useState(true);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("zillaPreferences");
      if (stored) {
        setPrefs({ ...defaultPrefs, ...JSON.parse(stored) });
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch ALL active rooms from Supabase (filtering happens on frontend)
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (!error && data) setRooms(data);
    setLoadingRooms(false);
  }, []);

  // Fetch seeker profiles — exclude the current user
  const fetchSeekers = useCallback(async () => {
    setLoadingSeekers(true);
    const sessionId = localStorage.getItem("zilla_session_id") || "";

    const query = supabase
      .from("seeker_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (sessionId) {
      query.neq("user_id", sessionId);
    }

    const { data, error } = await query;
    if (!error && data) setSeekers(data);
    setLoadingSeekers(false);
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchSeekers();
  }, [fetchRooms, fetchSeekers]);

  // Frontend location filter for rooms — bulletproof case-insensitive
  const userLoc = prefs.preferredArea.toLowerCase().trim();
  const filteredRooms = userLoc
    ? rooms.filter((room) => room.location.toLowerCase().includes(userLoc))
    : rooms;

  // STRICT location filter for roommates — same logic as rooms
  const locationFilteredSeekers = userLoc
    ? seekers.filter((s) => s.location.toLowerCase().includes(userLoc))
    : seekers;

  // Score + sort location-filtered roommates by match % (highest first)
  const sortedSeekers = locationFilteredSeekers
    .map((s) => ({ ...s, matchScore: calculateMatch(s, prefs) }))
    .sort((a, b) => b.matchScore - a.matchScore);

  /* ─── Loading Spinner Component ─── */
  const Spinner = () => (
    <div className="flex items-center justify-center py-20">
      <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  /* ─── Empty State Component ─── */
  const EmptyState = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="material-symbols-outlined text-6xl text-outline/40 mb-4">{icon}</span>
      <h3 className="font-headline font-semibold text-lg text-on-surface mb-2">{title}</h3>
      <p className="text-sm text-on-surface-variant max-w-xs">{desc}</p>
    </div>
  );

  return (
    <div className="bg-surface text-on-surface font-body min-h-dvh pb-32 md:pb-8">
      <TopAppBar avatarUrl={AVATAR_URL} showSearch showDesktopSearch />

      <main className="pt-28 px-4 max-w-7xl mx-auto">
        {/* Tab Menu */}
        <div className="flex items-center justify-center mb-12">
          <div className="bg-surface-container-low rounded-full p-1 inline-flex shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
            <button
              onClick={() => setActiveSubTab("rooms")}
              className={`px-8 py-3 rounded-full text-sm font-semibold font-body transition-colors cursor-pointer ${
                activeSubTab === "rooms"
                  ? "bg-surface-container-lowest text-on-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Explore Rooms
            </button>
            <button
              onClick={() => setActiveSubTab("roommates")}
              className={`px-8 py-3 rounded-full text-sm font-semibold font-body transition-colors cursor-pointer ${
                activeSubTab === "roommates"
                  ? "bg-surface-container-lowest text-on-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Find Roommates
            </button>
          </div>
        </div>

        {/* ═══════════ EXPLORE ROOMS TAB ═══════════ */}
        {activeSubTab === "rooms" && (
          <section>
            {/* Preference summary pills */}
            <div className="flex items-center gap-2 mb-8 flex-wrap">
              <span className="bg-primary-fixed text-on-primary-fixed px-4 py-1.5 rounded-full text-xs font-semibold font-label flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                {prefs.preferredArea}
              </span>
              <span className="bg-surface-container-lowest border border-outline-variant/15 px-4 py-1.5 rounded-full text-xs font-semibold font-label text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">payments</span>
                ₹{parseInt(prefs.budgetMin).toLocaleString("en-IN")} – ₹{parseInt(prefs.budgetMax).toLocaleString("en-IN")}
              </span>
            </div>

            {loadingRooms ? (
              <Spinner />
            ) : filteredRooms.length === 0 ? (
              <EmptyState
                icon="search_off"
                title="No rooms listed yet"
                desc="Check back soon! Owners are adding new listings."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-surface-container-lowest rounded-2xl overflow-hidden flex flex-col shadow-[0_10px_30px_rgba(70,72,212,0.03)] hover:shadow-ambient hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <div className="relative h-52 w-full overflow-hidden p-2">
                      {room.image_url ? (
                        <Image
                          alt={room.title}
                          src={room.image_url}
                          fill
                          className="object-cover rounded-xl group-hover:scale-105 transition-transform duration-700 ease-out"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full rounded-xl bg-surface-container flex items-center justify-center">
                          <span className="material-symbols-outlined text-4xl text-outline/40">image</span>
                        </div>
                      )}
                      <div className="absolute top-4 right-4 bg-surface-container-lowest/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary flex items-center gap-1 shadow-sm z-10">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Available
                      </div>
                    </div>

                    <div className="p-5 flex flex-col flex-grow">
                      <h3 className="text-lg font-headline font-semibold text-on-surface mb-1 line-clamp-1">
                        {room.title}
                      </h3>
                      <p className="text-sm text-on-surface-variant flex items-center gap-1 mb-4">
                        <span className="material-symbols-outlined text-[16px] text-outline">location_on</span>
                        {room.location}
                      </p>
                      {room.description && (
                        <p className="text-xs text-on-surface-variant line-clamp-2 mb-4">{room.description}</p>
                      )}
                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-surface-container/50">
                        <div className="font-headline font-bold text-lg text-primary">
                          ₹{room.price?.toLocaleString("en-IN")}
                          <span className="text-xs text-on-surface-variant font-body font-normal">/mo</span>
                        </div>
                        <button className="bg-gradient-to-br from-primary to-primary-container text-white px-4 py-2 rounded-[0.75rem] text-xs font-semibold font-body hover:scale-105 transition-transform duration-200 cursor-pointer flex items-center gap-1">
                          View
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══════════ FIND ROOMMATES TAB ═══════════ */}
        {activeSubTab === "roommates" && (
          <section>
            {/* Filters */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6 mb-8 -mx-4 px-4 md:mx-0 md:px-0">
              {filterChips.map((filter) => (
                <button
                  key={filter.label}
                  className="shrink-0 flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/15 px-4 py-2 rounded-full text-sm font-body text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">{filter.icon}</span>
                  {filter.label}
                  <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                </button>
              ))}
            </div>

            {loadingSeekers ? (
              <Spinner />
            ) : sortedSeekers.length === 0 ? (
              <EmptyState
                icon="group_off"
                title="No roommates found"
                desc="Be the first seeker! Complete onboarding to appear here."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedSeekers.map((person, idx) => (
                  <div
                    key={person.id}
                    className="bg-surface-container-lowest rounded-xl p-6 relative group hover:-translate-y-1 transition-transform duration-300"
                  >
                    {/* Match Badge */}
                    <div className="absolute top-4 right-4 bg-tertiary-container/10 text-tertiary px-3 py-1 rounded-full text-xs font-bold font-headline flex items-center gap-1 z-10">
                      🔥 {person.matchScore}% Match
                    </div>

                    {/* Profile */}
                    <div className="flex items-center gap-4 mb-6 relative z-0">
                      <div className="w-16 h-16 rounded-full overflow-hidden shadow-sm relative shrink-0">
                        <Image
                          alt={person.full_name}
                          src={roommateAvatars[idx % roommateAvatars.length]}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-headline font-semibold text-on-surface">
                          {person.full_name}
                        </h3>
                        <p className="text-sm font-body text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">location_on</span>
                          {person.location}
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center justify-between text-sm font-body">
                        <span className="text-on-surface-variant">Budget</span>
                        <span className="font-semibold text-on-surface">
                          ₹{Math.round(person.budget_min / 1000)}k - ₹{Math.round(person.budget_max / 1000)}k
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-body">
                        <span className="text-on-surface-variant">Vibe</span>
                        <span className="font-medium text-on-surface bg-surface-container px-2 py-1 rounded-[0.75rem]">
                          {person.vibe}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-body">
                        <span className="text-on-surface-variant">Work</span>
                        <span className="font-medium text-on-surface bg-surface-container px-2 py-1 rounded-[0.75rem]">
                          {person.work_style}
                        </span>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      className={`w-full py-3 rounded-[0.75rem] font-body font-semibold text-sm hover:scale-[1.02] transition-transform duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                        person.matchScore >= 90
                          ? "bg-gradient-to-br from-primary to-primary-container text-white"
                          : "bg-surface-container-high text-on-surface"
                      }`}
                    >
                      Send Match Request
                      <span className="material-symbols-outlined text-[18px]">handshake</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <BottomNav activeTab="Match" />
    </div>
  );
}
