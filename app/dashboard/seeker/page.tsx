"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import TopAppBar from "../../components/TopAppBar";
import BottomNav from "../../components/BottomNav";
import { supabase } from "@/lib/supabase";
import RoomCard, { Room } from "../../components/RoomCard";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCWBNlcG9YcIUJqpqMBSxtbZUYqdg0VgM-QcbmI8Vdk5aSiXa7ZUnC_tQ_wVzyydo_HPBEUT-fgARlpVkCrsk_htxt39xXAYiFu3glIFSfs5h2ESQWuwTw6bpfE6MQddAuw5gCkyMN6gSl76uAGZFD_fGVYhwVqSbzpcZU-cksc0Sn_xBKIV_mPyBUEcGrxXWznDvHdtH0ZQMevd6cTA_JrfOtQz07qJF5edYlbe3o3EsVofIofZpQXpIdthVdr7OwH99zVazJ02wQ";

// ─── Dynamically import the read-only detail map (SSR disabled, uses window/Leaflet) ──
const RoomDetailMap = dynamic(() => import("../../components/RoomDetailMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface-container-low rounded-xl">
      <div className="flex flex-col items-center gap-2 text-outline">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs font-body">Loading map…</span>
      </div>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Preferences {
  budgetMin: string;
  budgetMax: string;
  preferredArea: string;
  sleepSchedule: string;
  workStyle: string;
  smokingAllowed: boolean;
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

// ─── Category filter chips ────────────────────────────────────────────────────
const CATEGORY_CHIPS = [
  { label: "All",         value: "all",         icon: "apps" },
  { label: "Rental Room", value: "rental_room",  icon: "bed" },
  { label: "Flat",        value: "flat",         icon: "apartment" },
  { label: "PG",          value: "pg",           icon: "groups" },
  { label: "Hostel",      value: "hostel",       icon: "corporate_fare" },
];

// ─── Search stop-words (common noise words to strip from tokens) ──────────────
const STOP_WORDS = new Set([
  "a","an","the","in","on","at","for","of","and","or","to","with","near","by",
  "is","are","was","has","room","rooms","flat","pg","hostel",
]);

// ─── Tokenizer ────────────────────────────────────────────────────────────────
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// ─── Relevance scorer ─────────────────────────────────────────────────────────
/**
 * Returns a relevance score ≥ 0 for a room against a set of search tokens.
 * Weights:  location match = 3 pts, title match = 2 pts, description match = 1 pt.
 * An empty token list returns Infinity so all rooms pass (score = ∞ → keep).
 */
function scoreRoom(room: Room, tokens: string[]): number {
  if (tokens.length === 0) return Infinity;

  const loc   = (room.location    ?? "").toLowerCase();
  const title = (room.title       ?? "").toLowerCase();
  const desc  = (room.description ?? "").toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (loc.includes(token))   score += 3;
    if (title.includes(token)) score += 2;
    if (desc.includes(token))  score += 1;
  }
  return score;
}

// ─── Haversine distance (km) between two lat/lng pairs ────────────────────────
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format distance for display: "0.3 km" or "4.7 km" */
function fmtKm(km: number): string {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`;
}

/** Geocode a free-text query via OpenStreetMap Nominatim (free, no key needed). */
async function geocodeQuery(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "ZillaApp/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// Geo-search thresholds
const GEO_PRIMARY_KM   = 5;   // ≤5 km  → tier 1
const GEO_SECONDARY_KM = 25;  // 5–25 km → tier 2  |  >25 km discarded

// ─── Matching algorithm (roommates tab — unchanged) ───────────────────────────
function calculateMatch(seeker: SeekerProfile, prefs: Preferences): number {
  let score = 40;
  if (seeker.vibe === prefs.sleepSchedule) score += 35;
  const userMin = parseInt(prefs.budgetMin) || 0;
  const userMax = parseInt(prefs.budgetMax) || 999999;
  if (userMin <= seeker.budget_max && userMax >= seeker.budget_min) score += 25;
  return score;
}

// ─── Roommates coming-soon section ───────────────────────────────────────────
const roommateAvatars = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBdeLKQmqkDnXZiYFUiWhO92w-BSZ-2BFfoqIizt1NA0DzmZgiEXGv0WNHcQOXgEScX0rWtPHKfj2CwKK-MvmCf6nnOPLbO0Dx_kCx0wQPkKUlAkMQAx-cun6bMj0Asx4n5RsZnq1q0It7TubIpag3vt6xzUMjbYvecqNeM_mGaRC9YbFZ3wKCXnJA2XHkb6WJP20-au_raSVqWmzBHl43G060mZsIt1ff54jB_LF6Fok82ukXrAf-Gve_8dGSD7-g0WMVQ8CRmGxA",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCCgnHWSl8oYI0sf0qoTfaKQlcxFZisVrzg8q3KrsbkY23nEpVX3eE6K5FMfEQv-r5YZzx6wUVulxwEGTVZXaLSSI5ZCfmONrk96gQ841J32USGAacfEi1I8Tw_oK8jyPjkTVSIjoeCn1PYnlx49bJaUj_eK4CaTVboFXtwwqPw3UYaoj4sjrKxHPYOC_bCf8vGQWpKcvRjWCmX3DKjHKbWbuAFMhu9bT7Tq4gctks9zM7gnmZgmqxiWZByu4oHE9LqEeRUxN0Z5Vo",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAoo-V3nvhWHSu4DV_zB0MaT4aty5nWI41K2wrfLE87HL8mobJebOFrq6vXXDCkED8Dr6DIT5cc_AS4qsDDn9VWwr-fc5aj0-JGgImovoZMykOGqcPI--mXg9yeiC0lIchj8aQ-H3-vJDBLKDxH2E9DjfmzXRuLnE4b0GSC_s8XFS6N_10uRbz5XIhO1likb2etn5Xr6Gy3slEdVJbw_PMADkyZEqJlV3MXhzqu0Q1LBf7LG0HyvLl49cFlCA5UZKx9xN3XenNTnto",
];

function RoommatesComingSoon() {
  const [interest, setInterest] = useState<"yes" | "maybe" | "no" | null>(null);
  const [challenge, setChallenge] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const handleSubmit = async () => {
    if (!interest) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let seekerProfileId: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from("seeker_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        seekerProfileId = profile?.id ?? null;
      }
      const feedbackText = [
        `Interest: ${interest}`,
        challenge.trim() ? `Challenge: ${challenge.trim()}` : null,
      ].filter(Boolean).join(" | ");
      const { error } = await supabase.from("feature_feedback").insert({
        user_id: seekerProfileId,
        feature_name: "roommate_matching",
        feedback_text: feedbackText,
      });
      if (error) { setSubmitError("Could not save your feedback. Please try again."); return; }
      setSubmitted(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (err) {
      console.error("[ZILLA] Unexpected feedback error:", err);
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex flex-col items-center text-center px-4 py-8 max-w-lg mx-auto">
      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-40 h-40 rounded-full bg-primary/8 blur-3xl" />
        </div>
        <div className="relative w-32 h-32 rounded-[2rem] bg-gradient-to-br from-primary-fixed to-secondary-fixed flex items-center justify-center shadow-ambient mx-auto">
          <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="28" r="9" fill="#4648d4" opacity="0.85"/>
            <path d="M8 56c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#4648d4" strokeWidth="3" strokeLinecap="round" opacity="0.85"/>
            <circle cx="56" cy="28" r="9" fill="#575992" opacity="0.75"/>
            <path d="M40 56c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#575992" strokeWidth="3" strokeLinecap="round" opacity="0.75"/>
            <path d="M40 14 L41.5 18 L46 18 L42.5 21 L44 25 L40 22.5 L36 25 L37.5 21 L34 18 L38.5 18 Z" fill="#904900" opacity="0.9"/>
            <circle cx="34" cy="40" r="2" fill="#4648d4" opacity="0.5"/>
            <circle cx="40" cy="40" r="2.5" fill="#4648d4" opacity="0.7"/>
            <circle cx="46" cy="40" r="2" fill="#4648d4" opacity="0.5"/>
          </svg>
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 bg-tertiary/10 text-tertiary px-4 py-1.5 rounded-full text-xs font-semibold font-label mb-4 border border-tertiary/20">
        <span className="material-symbols-outlined text-[14px]">schedule</span>
        Coming Soon
      </div>
      <h2 className="font-headline text-2xl font-bold text-on-surface tracking-tight mb-3">
        Roommate Matching is<br />on its way ✨
      </h2>
      <p className="font-body text-sm text-on-surface-variant max-w-xs leading-relaxed mb-10">
        We&apos;re building smart compatibility matching so you can find people who actually vibe with your lifestyle, budget, and schedule.
      </p>

      {!submitted ? (
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-ambient border border-outline-variant/10 p-6 text-left space-y-5">
          <div>
            <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold mb-1">Quick Feedback</p>
            <p className="font-body text-sm font-semibold text-on-surface">Would a roommate matching feature be useful to you?</p>
          </div>
          <div className="flex gap-2">
            {(["yes", "maybe", "no"] as const).map((opt) => {
              const labels = { yes: "Yes, definitely!", maybe: "Maybe", no: "Not really" };
              const icons = { yes: "thumb_up", maybe: "thumbs_up_down", no: "thumb_down" };
              const active = interest === opt;
              return (
                <button key={opt} id={`interest-${opt}`} onClick={() => setInterest(opt)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold font-label transition-all duration-200 cursor-pointer ${
                    active ? "border-primary bg-primary/8 text-primary shadow-[0_0_0_2px_rgba(70,72,212,0.15)]"
                           : "border-outline-variant/20 bg-surface-container text-on-surface-variant hover:border-outline/40 hover:bg-surface-container-low"
                  }`}>
                  <span className={`material-symbols-outlined text-[20px] ${active ? "filled text-primary" : ""}`}>{icons[opt]}</span>
                  {labels[opt]}
                </button>
              );
            })}
          </div>
          <div>
            <label htmlFor="roommate-challenge" className="block font-label text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-2">
              What&apos;s your biggest challenge in finding a roommate?
              <span className="ml-1 text-outline font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea id="roommate-challenge" rows={3} value={challenge} onChange={(e) => setChallenge(e.target.value)}
              placeholder="e.g. hard to find someone with the same sleep schedule..."
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-body text-on-surface placeholder:text-on-surface-variant/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
            />
          </div>
          {submitError && (
            <p className="text-error text-xs font-label flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span>{submitError}
            </p>
          )}
          <button id="submit-roommate-feedback" onClick={handleSubmit} disabled={!interest || submitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 shadow-md disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer">
            {submitting ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Submitting…</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">send</span>Share My Feedback</>
            )}
          </button>
          <p className="text-center text-[11px] text-on-surface-variant/50 font-body">Your response helps us prioritise what to build next.</p>
        </div>
      ) : (
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-ambient border border-outline-variant/10 p-8 flex flex-col items-center animate-[slideUp_0.35s_ease-out]">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px] text-green-600 filled">check_circle</span>
          </div>
          <h3 className="font-headline font-bold text-lg text-on-surface mb-2">Thank you! 🙌</h3>
          <p className="font-body text-sm text-on-surface-variant text-center max-w-xs">
            Your feedback has been recorded. We&apos;ll notify you as soon as roommate matching goes live.
          </p>
        </div>
      )}

      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] bg-on-surface text-surface px-5 py-3 rounded-xl shadow-lg font-body text-sm font-medium flex items-center gap-2 animate-[slideDown_0.3s_ease-out]">
          <span className="material-symbols-outlined text-[18px] text-green-400 filled">check_circle</span>
          Feedback saved — thanks for shaping ZILLA!
        </div>
      )}
    </section>
  );
}

// ─── Image Carousel (used inside Room Detail Modal) ───────────────────────────
function ImageCarousel({ room }: { room: Room }) {
  const images: string[] =
    room.image_urls && room.image_urls.length > 0
      ? room.image_urls
      : room.image_url
      ? [room.image_url]
      : [];

  const [activeIdx, setActiveIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollToSlide = (idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: track.offsetWidth * idx, behavior: "smooth" });
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || images.length === 0) return;
    setActiveIdx(Math.round(track.scrollLeft / track.offsetWidth));
  };

  const prev = () => { const n = Math.max(0, activeIdx - 1); setActiveIdx(n); scrollToSlide(n); };
  const next = () => { const n = Math.min(images.length - 1, activeIdx + 1); setActiveIdx(n); scrollToSlide(n); };

  if (images.length <= 1) {
    return (
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-t-3xl">
        {images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[0]} alt={room.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-6xl text-outline/30">image</span>
          </div>
        )}
        <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
          <span className="font-headline font-bold text-xl text-primary">₹{room.price?.toLocaleString("en-IN")}</span>
          <span className="text-xs text-on-surface-variant font-body">/mo</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-t-3xl select-none">
      <div ref={trackRef} onScroll={handleScroll}
        className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {images.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${room.title} — photo ${i + 1}`} className="w-full h-full object-cover" draggable={false} />
          </div>
        ))}
      </div>

      {activeIdx > 0 && (
        <button onClick={prev} aria-label="Previous photo"
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors">
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
      )}
      {activeIdx < images.length - 1 && (
        <button onClick={next} aria-label="Next photo"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors">
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      )}

      <div className="absolute top-3 right-3 z-10 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
        {activeIdx + 1} / {images.length}
      </div>
      <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
        {images.map((_, i) => (
          <span key={i} className={`block rounded-full transition-all duration-300 ${i === activeIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`} />
        ))}
      </div>
      <div className="absolute bottom-4 left-4 z-10 bg-surface-container-lowest/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
        <span className="font-headline font-bold text-xl text-primary">₹{room.price?.toLocaleString("en-IN")}</span>
        <span className="text-xs text-on-surface-variant font-body">/mo</span>
      </div>
    </div>
  );
}

// ─── Rules renderer ───────────────────────────────────────────────────────────
const RULES_META: { key: string; label: string; icon: string }[] = [
  { key: "food",             label: "Food",             icon: "restaurant" },
  { key: "smoking",          label: "Smoking",          icon: "smoking_rooms" },
  { key: "drinking",         label: "Drinking",         icon: "local_bar" },
  { key: "preferred_tenant", label: "Preferred Tenant", icon: "person" },
  { key: "curfew",           label: "Curfew",           icon: "schedule" },
];

function RulesSection({ rules }: { rules: Record<string, unknown> }) {
  const entries = RULES_META.filter((m) => rules[m.key] != null);
  const customDetails = typeof rules.custom_details === "string" ? rules.custom_details : null;
  if (entries.length === 0 && !customDetails) return null;
  return (
    <div className="mb-6">
      <h3 className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant mb-3">
        House Rules
      </h3>
      {entries.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {entries.map(({ key, label, icon }) => (
            <div key={key} className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2.5">
              <span className="material-symbols-outlined text-[16px] text-outline flex-shrink-0">{icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-wider">{label}</p>
                <p className="text-xs font-semibold text-on-surface truncate">{String(rules[key])}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* PG / Hostel custom food menu & routines */}
      {customDetails && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/30 rounded-xl px-4 py-3">
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-label uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">restaurant</span>
            Food Menu &amp; Daily Routines
          </p>
          <p className="text-xs text-on-surface font-body leading-relaxed whitespace-pre-line">{customDetails}</p>
        </div>
      )}
    </div>
  );
}

// ─── Amenities renderer ───────────────────────────────────────────────────────
const AMENITY_ICONS: Record<string, string> = {
  WiFi: "wifi",
  AC: "ac_unit",
  Geyser: "hot_tub",
  Parking: "local_parking",
  "Power Backup": "battery_charging_full",
  "RO Water": "water_drop",
  // PG / Hostel specifics
  "Food / Mess Included": "restaurant",
  "Laundry Service": "local_laundry_service",
  "Daily Housekeeping": "cleaning_services",
  "Strict Security / Warden": "security",
};

function AmenitiesSection({ amenities }: { amenities: string[] }) {
  if (amenities.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant mb-3">
        Amenities
      </h3>
      <div className="flex flex-wrap gap-2">
        {amenities.map((a) => (
          <span key={a} className="flex items-center gap-1.5 bg-primary/8 text-primary text-xs font-body font-semibold px-3 py-1.5 rounded-full">
            <span className="material-symbols-outlined text-[14px]">{AMENITY_ICONS[a] ?? "check_circle"}</span>
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SeekerDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"rooms" | "roommates">("rooms");
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [depositInfoOpen, setDepositInfoOpen] = useState(false);

  // ── Search & filter state ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // ── Geo-search state ────────────────────────────────────────────────────────
  /** Geocoded coordinate for the current searchQuery (null = not geocoded yet) */
  const [searchCoord, setSearchCoord] = useState<{ lat: number; lng: number } | null>(null);
  /** "geo" = using haversine tiers | "text" = falling back to token scoring */
  const [geoMode, setGeoMode] = useState<"geo" | "text">("text");
  /** Whether we're currently calling Nominatim */
  const [isGeocoding, setIsGeocoding] = useState(false);
  /** Progressive-disclosure: reveals secondaryMatches */
  const [showNearby, setShowNearby] = useState(false);

  // ── Saved rooms ─────────────────────────────────────────────────────────────
  const [savedRoomIds, setSavedRoomIds] = useState<Set<string>>(new Set());
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  /**
   * Tracks whether the saved-rooms fetch is in progress.
   * Starts as `true` so the UI never flashes the empty-state before the
   * first fetch completes. Flipped to `false` in the `finally` block.
   */
  const [loadingSavedRooms, setLoadingSavedRooms] = useState(true);

  const fetchSavedRooms = useCallback(async () => {
    // ── FIX: use getSession() instead of getUser() ─────────────────────────
    // `getUser()` makes a network request to re-validate the token, which
    // acquires a storage lock. When Next.js mounts the component multiple
    // times (StrictMode double-invoke, concurrent renders, etc.) two calls
    // race for the same lock and one throws:
    //   "Lock 'lock:sb-...-auth-token' was released because another request stole it"
    //
    // `getSession()` reads the cached session from localStorage — no network
    // round-trip, no lock acquisition — so concurrent calls are safe.
    setLoadingSavedRooms(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // No active session → user is not logged in; bail out cleanly.
      if (!session?.user) {
        console.warn("[fetchSavedRooms] No active session — skipping fetch.");
        return;
      }

      const userId = session.user.id;
      setAuthUserId(userId);

      // Fetch this seeker's saved room IDs from the database.
      const { data: saved, error } = await supabase
        .from("saved_rooms")
        .select("room_id")
        .eq("seeker_id", userId);

      if (error) {
        // Log the error but do NOT re-throw — we still want `finally` to
        // clear the loading state so the UI renders correctly.
        console.error("[fetchSavedRooms] DB error:", error);
        return;
      }

      // Populate the saved-room ID set (empty array → empty Set is correct).
      setSavedRoomIds(new Set((saved ?? []).map((r) => r.room_id as string)));
    } catch (err) {
      // Unexpected errors (network outage, etc.) should not leave the UI
      // stuck in a loading state.
      console.error("[fetchSavedRooms] Unexpected error:", err);
    } finally {
      // Always clear the loading flag — whether we succeeded, errored, or
      // bailed out early. This ensures the UI exits the loading state and
      // correctly shows either the fetched rooms or the empty state.
      setLoadingSavedRooms(false);
    }
  }, []);

  /**
   * Fetch the seeker's saved landmark coordinates from their profile.
   * If valid coords exist AND the search bar is currently empty, seed the
   * geo-engine so distance badges + tiers appear immediately on load.
   * The debounced geocoding effect naturally overrides this when the user
   * types a new location (it resets searchCoord first, then re-sets from Nominatim).
   */
  const fetchProfileCoord = useCallback(async () => {
    try {
      // Same fix as fetchSavedRooms — use getSession() to avoid the lock.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: profile, error } = await supabase
        .from("seeker_profiles")
        .select("target_latitude, target_longitude")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) { console.warn("[fetchProfileCoord]", error.message); return; }

      const lat = profile?.target_latitude  as number | null | undefined;
      const lng = profile?.target_longitude as number | null | undefined;

      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        // Only apply when the search bar is still empty (don't clobber an active search)
        setSearchCoord((prev) => {
          if (prev !== null) return prev; // already set by a concurrent geocode — leave it
          return { lat, lng };
        });
        setGeoMode("geo");
        console.log(`[ZILLA] Default geo-coord from profile: (${lat}, ${lng})`);
      }
    } catch (err) {
      console.warn("[fetchProfileCoord] Unexpected error:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSave = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    // Use getSession() for the same lock-avoidance reason as fetchSavedRooms.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { console.warn("[toggleSave] No authenticated user — aborting."); return; }
    if (!authUserId) setAuthUserId(user.id);
    const uid = user.id;
    const isSaved = savedRoomIds.has(roomId);

    setSavedRoomIds((prev) => { const next = new Set(prev); isSaved ? next.delete(roomId) : next.add(roomId); return next; });

    if (isSaved) {
      const { error } = await supabase.from("saved_rooms").delete().eq("seeker_id", uid).eq("room_id", roomId);
      if (error) { console.error("[toggleSave] unsave failed:", error); setSavedRoomIds((prev) => new Set([...prev, roomId])); }
    } else {
      const { error } = await supabase.from("saved_rooms").insert([{ room_id: roomId, seeker_id: uid }]);
      if (error) { console.error("[toggleSave] save failed:", error); setSavedRoomIds((prev) => { const next = new Set(prev); next.delete(roomId); return next; }); }
    }
  };

  // ── Booking form state ──────────────────────────────────────────────────────
  const [tenantName, setTenantName]   = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const sessionId = localStorage.getItem("zilla_session_id");
    const role = localStorage.getItem("zilla_user_role");
    if (!sessionId || !role) { router.push("/role"); return; }
    setAuthChecked(true);
  }, [router]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState<Room[]>([]);
  const [seekers, setSeekers] = useState<SeekerProfile[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingSeekers, setLoadingSeekers] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("zillaPreferences");
      if (stored) setPrefs({ ...defaultPrefs, ...JSON.parse(stored) });
    } catch { /* ignore */ }
  }, []);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    const { data, error } = await supabase.from("rooms").select("*").eq("status", "active").order("created_at", { ascending: false });
    if (!error && data) setRooms(data);
    setLoadingRooms(false);
  }, []);

  const fetchSeekers = useCallback(async () => {
    setLoadingSeekers(true);
    const sessionId = localStorage.getItem("zilla_session_id") || "";
    const query = supabase.from("seeker_profiles").select("*").order("created_at", { ascending: false });
    if (sessionId) query.neq("user_id", sessionId);
    const { data, error } = await query;
    if (!error && data) setSeekers(data);
    setLoadingSeekers(false);
  }, []);

  useEffect(() => {
    if (authChecked) { fetchRooms(); fetchSeekers(); fetchSavedRooms(); fetchProfileCoord(); }
  }, [authChecked, fetchRooms, fetchSeekers, fetchSavedRooms, fetchProfileCoord]);

  // ── Debounced geocoding: fire 600 ms after the user stops typing ────────────
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Reset geo state immediately when query changes.
    // NOTE: when query is empty we do NOT reset searchCoord/geoMode —
    // that preserves the profile-seeded default coordinate so the distance
    // engine keeps running even after the user clears the search bar.
    if (searchQuery.trim()) {
      setSearchCoord(null);
      setGeoMode("text");
      setShowNearby(false);
    }

    if (!searchQuery.trim()) return;

    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      setIsGeocoding(true);
      const coord = await geocodeQuery(searchQuery.trim());
      setIsGeocoding(false);
      if (coord) {
        setSearchCoord(coord);
        setGeoMode("geo");
      } else {
        setGeoMode("text"); // graceful fallback
      }
    }, 600);

    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ── Category + geo/text filter pipeline ────────────────────────────────────
  const searchTokens = tokenize(searchQuery);

  /**
   * Two-tier geo result.
   * primaryMatches  : ≤ GEO_PRIMARY_KM (5 km),  sorted closest-first.
   * secondaryMatches: (5, 25] km,               sorted closest-first.
   * Rooms without coordinates are excluded from geo mode but included in text mode.
   */
  const { primaryMatches, secondaryMatches, textMatches, isGeoActive } = (() => {
    // 1. Category filter (applied in both modes)
    const byCategory =
      activeCategory === "all"
        ? rooms
        : rooms.filter((r) => r.property_type === activeCategory);

    // ── GEO MODE ──────────────────────────────────────────────────────────────
    if (geoMode === "geo" && searchCoord) {
      type GeoRoom = { room: Room; distKm: number };
      const primary: GeoRoom[] = [];
      const secondary: GeoRoom[] = [];

      for (const room of byCategory) {
        if (room.latitude == null || room.longitude == null) continue;
        const d = haversineKm(
          searchCoord.lat, searchCoord.lng,
          room.latitude,   room.longitude
        );
        if (d <= GEO_PRIMARY_KM)   primary.push({ room, distKm: d });
        else if (d <= GEO_SECONDARY_KM) secondary.push({ room, distKm: d });
        // > GEO_SECONDARY_KM → strict geofence discard
      }

      primary.sort((a, b) => a.distKm - b.distKm);
      secondary.sort((a, b) => a.distKm - b.distKm);

      return { primaryMatches: primary, secondaryMatches: secondary, textMatches: [], isGeoActive: true };
    }

    // ── TEXT / TOKEN MODE (fallback) ───────────────────────────────────────────
    const scored = byCategory.map((r) => ({ room: r, score: scoreRoom(r, searchTokens) }));
    const filtered = searchTokens.length > 0 ? scored.filter((s) => s.score > 0) : scored;
    filtered.sort((a, b) => b.score - a.score);
    return { primaryMatches: [], secondaryMatches: [], textMatches: filtered.map((s) => s.room), isGeoActive: false };
  })();

  // Auto-expand secondary when primary is empty (so user never sees a blank screen)
  useEffect(() => {
    if (isGeoActive && primaryMatches.length === 0 && secondaryMatches.length > 0) {
      setShowNearby(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryMatches.length, secondaryMatches.length, isGeoActive]);

  // ── Roommates ───────────────────────────────────────────────────────────────
  const userLoc = prefs.preferredArea.toLowerCase().trim();
  const locationFilteredSeekers = userLoc
    ? seekers.filter((s) => s.location.toLowerCase().includes(userLoc))
    : seekers;
  const sortedSeekers = locationFilteredSeekers
    .map((s) => ({ ...s, matchScore: calculateMatch(s, prefs) }))
    .sort((a, b) => b.matchScore - a.matchScore);

  // ── Booking handlers ─────────────────────────────────────────────────────────
  const handleTokenPayment = () => {
    if (!selectedRoom) return;
    if (!tenantName.trim() || !tenantPhone.trim() || !tenantEmail.trim() || !date1 || !date2) {
      alert("Please complete all your details (Name, Phone, Email, and both visit dates) before proceeding.");
      return;
    }
    sessionStorage.setItem("zilla_pending_booking", JSON.stringify({
      tenantName: tenantName.trim(), tenantPhone: tenantPhone.trim(), tenantEmail: tenantEmail.trim(),
      date1, date2, roomId: selectedRoom.id, roomTitle: selectedRoom.title, roomPrice: selectedRoom.price,
      securityDeposit: selectedRoom.deposit ?? selectedRoom.security_deposit ?? selectedRoom.price,
    }));
    router.push("/checkout");
  };

  const handleFreeBooking = async () => {
    if (!selectedRoom) return;
    if (!tenantName.trim() || !tenantPhone.trim() || !tenantEmail.trim() || !date1 || !date2) {
      alert("Please complete all your details (Name, Phone, Email, and both visit dates) before proceeding.");
      return;
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { alert("You must be logged in to make a booking. Please log in and try again."); router.push("/role-selection"); return; }

    let { data: seekerProfile } = await supabase.from("seeker_profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!seekerProfile) {
      const { data: newProfile, error: insertError } = await supabase.from("seeker_profiles").insert({
        user_id: user.id, full_name: tenantName.trim(),
        email: tenantEmail.trim() || user.email || "",
        budget_min: 0, budget_max: 100000, location: "", vibe: "", work_style: "",
      }).select("id").single();
      if (insertError || !newProfile) { alert("Could not set up your booking profile. Please complete onboarding first."); router.push("/role-selection"); return; }
      seekerProfile = newProfile;
    }

    const { createBooking } = await import("@/app/actions/booking");
    const result = await createBooking({
      roomId: selectedRoom.id, seekerId: seekerProfile.id, isPremium: false,
      tenantName: tenantName.trim(), tenantPhone: tenantPhone.trim(), tenantEmail: tenantEmail.trim(), date1, date2,
    });

    if (!result.success) { console.error("[Booking] Free booking failed:", result.error); alert(`Booking failed: ${result.error}`); return; }
    router.push("/booking/" + result.bookingId + "?code=" + result.secureCode);
  };

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const Spinner = () => (
    <div className="flex items-center justify-center py-20">
      <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  const EmptyState = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="material-symbols-outlined text-6xl text-outline/40 mb-4">{icon}</span>
      <h3 className="font-headline font-semibold text-lg text-on-surface mb-2">{title}</h3>
      <p className="text-sm text-on-surface-variant max-w-xs">{desc}</p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-surface text-on-surface font-body min-h-dvh pb-32 md:pb-8">
      <TopAppBar avatarUrl={AVATAR_URL} showSearch showDesktopSearch showPreferences />

      <main className="pt-28 px-4 max-w-7xl mx-auto">
        {/* ── Tab Menu ── */}
        <div className="flex items-center justify-center mb-8">
          <div className="bg-surface-container-low rounded-full p-1 inline-flex shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
            {(["rooms", "roommates"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveSubTab(tab)}
                className={`px-8 py-3 rounded-full text-sm font-semibold font-body transition-colors cursor-pointer ${
                  activeSubTab === tab
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}>
                {tab === "rooms" ? "Explore Rooms" : "Find Roommates"}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════ EXPLORE ROOMS TAB ══════════════ */}
        {activeSubTab === "rooms" && (
          <section>
            {/* ── Tokenized Search Bar ── */}
            <div className="relative mb-4">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">
                search
              </span>
              <input
                id="room-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by location, type, or keyword…"
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl py-3.5 pl-12 pr-12 text-sm text-on-surface placeholder:text-outline font-body shadow-[0_2px_12px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* ── Category Filter Chips (horizontal scrollable) ── */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {CATEGORY_CHIPS.map((chip) => {
                const active = activeCategory === chip.value;
                return (
                  <button
                    key={chip.value}
                    onClick={() => setActiveCategory(chip.value)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-body font-semibold transition-all duration-200 border cursor-pointer ${
                      active
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/20 hover:border-outline/40 hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{chip.icon}</span>
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* ── Geocoding status indicator ── */}
            {isGeocoding && (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant font-body mb-3">
                <svg className="animate-spin h-3.5 w-3.5 text-primary flex-shrink-0" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Finding location on map…
              </div>
            )}

            {/* ── Geo mode active badge ── */}
            {isGeoActive && !isGeocoding && (
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold font-label px-3 py-1.5 rounded-full border border-primary/20">
                  <span className="material-symbols-outlined text-[14px]">my_location</span>
                  Geo-search active · showing closest first
                </span>
                <span className="text-xs text-on-surface-variant font-body">
                  {primaryMatches.length + (showNearby ? secondaryMatches.length : 0)} result{primaryMatches.length + (showNearby ? secondaryMatches.length : 0) !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* ── Results count (text mode) ── */}
            {!isGeoActive && (searchQuery || activeCategory !== "all") && !loadingRooms && (
              <p className="text-xs text-on-surface-variant font-body mb-4">
                {textMatches.length === 0
                  ? "No results found"
                  : `${textMatches.length} ${textMatches.length === 1 ? "result" : "results"}`}
                {searchQuery && <span className="text-outline"> · sorted by relevance</span>}
              </p>
            )}

            {loadingRooms ? (
              <Spinner />
            ) : (
              /* ─────────── GEO mode ─────────── */
              isGeoActive ? (
                primaryMatches.length === 0 && secondaryMatches.length === 0 ? (
                  <EmptyState
                    icon="location_off"
                    title="No rooms found nearby"
                    desc="No listed properties found within 25 km of that location. Try a different area."
                  />
                ) : (
                  <>
                    {/* Primary tier: ≤5 km */}
                    {primaryMatches.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        {primaryMatches.map(({ room, distKm }, index) => (
                          <div key={room.id} className="relative">
                            {/* Distance badge overlay */}
                            <div className="absolute top-6 left-6 z-20 flex items-center gap-1 bg-surface-container-lowest/95 backdrop-blur-sm text-primary text-[11px] font-semibold font-label px-2.5 py-1 rounded-full shadow-sm border border-primary/20 pointer-events-none">
                              <span className="material-symbols-outlined text-[12px]">place</span>
                              {fmtKm(distKm)} away
                            </div>
                            <RoomCard
                              room={room}
                              index={index}
                              isSaved={savedRoomIds.has(room.id)}
                              onToggleSave={toggleSave}
                              onView={(r) => setSelectedRoom(r)}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Secondary tier reveal button */}
                    {secondaryMatches.length > 0 && !showNearby && (
                      <button
                        onClick={() => setShowNearby(true)}
                        className="w-full group relative overflow-hidden flex items-center justify-center gap-3 py-4 px-6 rounded-2xl border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 cursor-pointer mb-6"
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        <span className="material-symbols-outlined text-[20px] text-primary">expand_circle_down</span>
                        <span className="font-body font-semibold text-sm text-on-surface">
                          Show {secondaryMatches.length} nearby propert{secondaryMatches.length === 1 ? "y" : "ies"} up to {GEO_SECONDARY_KM} km away
                        </span>
                        <span className="text-xs text-on-surface-variant font-body">
                          ({fmtKm(secondaryMatches[0].distKm)}–{fmtKm(secondaryMatches[secondaryMatches.length - 1].distKm)})
                        </span>
                      </button>
                    )}

                    {/* Secondary tier: 5–25 km */}
                    {secondaryMatches.length > 0 && showNearby && (
                      <>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1 h-px bg-outline-variant/30" />
                          <span className="text-xs text-on-surface-variant font-label font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">expand_circle_down</span>
                            Nearby · {GEO_PRIMARY_KM}–{GEO_SECONDARY_KM} km
                          </span>
                          <div className="flex-1 h-px bg-outline-variant/30" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                          {secondaryMatches.map(({ room, distKm }, index) => (
                            <div key={room.id} className="relative opacity-90">
                              {/* Distance badge */}
                              <div className="absolute top-6 left-6 z-20 flex items-center gap-1 bg-surface-container-lowest/95 backdrop-blur-sm text-on-surface-variant text-[11px] font-semibold font-label px-2.5 py-1 rounded-full shadow-sm border border-outline-variant/30 pointer-events-none">
                                <span className="material-symbols-outlined text-[12px]">place</span>
                                {fmtKm(distKm)} away
                              </div>
                              <RoomCard
                                room={room}
                                index={index}
                                isSaved={savedRoomIds.has(room.id)}
                                onToggleSave={toggleSave}
                                onView={(r) => setSelectedRoom(r)}
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowNearby(false)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-body text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer mb-4"
                        >
                          <span className="material-symbols-outlined text-[16px]">expand_less</span>
                          Collapse nearby results
                        </button>
                      </>
                    )}
                  </>
                )
              ) : (
                /* ─────────── TEXT mode ─────────── */
                textMatches.length === 0 ? (
                  <EmptyState
                    icon="search_off"
                    title={searchQuery || activeCategory !== "all" ? "No matches found" : "No rooms listed yet"}
                    desc={
                      searchQuery || activeCategory !== "all"
                        ? "Try different keywords or clear the filter."
                        : "Check back soon! Owners are adding new listings."
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {textMatches.map((room, index) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        index={index}
                        isSaved={savedRoomIds.has(room.id)}
                        onToggleSave={toggleSave}
                        onView={(r) => setSelectedRoom(r)}
                      />
                    ))}
                  </div>
                )
              )
            )}
          </section>
        )}

        {/* ══════════════ FIND ROOMMATES ══════════════ */}
        {activeSubTab === "roommates" && <RoommatesComingSoon />}
      </main>

      {/* ══════════════ ROOM DETAIL MODAL ══════════════ */}
      {selectedRoom && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" onClick={() => setSelectedRoom(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

          <div
            className="relative bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl animate-[slideUp_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedRoom(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-surface-container-highest/70 backdrop-blur-sm flex items-center justify-center text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            {/* Photo carousel */}
            <ImageCarousel room={selectedRoom} />

            {/* Content */}
            <div className="p-6 sm:p-8">
              {/* Property + Furnishing badges */}
              {(selectedRoom.property_type || selectedRoom.furnishing) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedRoom.property_type && (
                    <span className="bg-primary/10 text-primary text-xs font-semibold font-label px-3 py-1 rounded-full">
                      {{rental_room:"Rental Room",flat:"Flat",pg:"PG",hostel:"Hostel"}[selectedRoom.property_type] ?? selectedRoom.property_type}
                    </span>
                  )}
                  {selectedRoom.room_type && (
                    <span className="bg-surface-container text-on-surface-variant text-xs font-semibold font-label px-3 py-1 rounded-full">
                      {{single:"Single Room",shared:"Shared Room","1bhk":"1 BHK","2bhk":"2 BHK"}[selectedRoom.room_type] ?? selectedRoom.room_type}
                    </span>
                  )}
                  {selectedRoom.washroom && (
                    <span className="bg-surface-container text-on-surface-variant text-xs font-semibold font-label px-3 py-1 rounded-full">
                      {selectedRoom.washroom} Washroom
                    </span>
                  )}
                </div>
              )}

              <h2 className="text-xl font-headline font-semibold text-on-surface mb-1">{selectedRoom.title}</h2>
              <p className="text-sm text-on-surface-variant flex items-center gap-1 mb-4">
                <span className="material-symbols-outlined text-[16px] text-outline">location_on</span>
                {selectedRoom.location}
              </p>

              {/* Financials */}
              <div className="flex items-center gap-4 bg-surface-container-low rounded-2xl px-5 py-4 mb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-label mb-0.5">Monthly Rent</p>
                  <p className="font-headline font-bold text-2xl text-primary leading-none">
                    ₹{selectedRoom.price?.toLocaleString("en-IN")}
                    <span className="text-xs text-on-surface-variant font-body font-normal">/mo</span>
                  </p>
                </div>
                {(selectedRoom.deposit ?? selectedRoom.security_deposit) && (
                  <>
                    <div className="w-px h-10 bg-outline-variant/30" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-label mb-0.5">Security Deposit</p>
                      <p className="font-headline font-bold text-lg text-on-surface leading-none">
                        ₹{(selectedRoom.deposit ?? selectedRoom.security_deposit)?.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Description */}
              {selectedRoom.description && (
                <div className="mb-5">
                  <h3 className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Description</h3>
                  <p className="text-sm text-on-surface leading-relaxed">{selectedRoom.description}</p>
                </div>
              )}

              {/* Amenities */}
              {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                <AmenitiesSection amenities={selectedRoom.amenities} />
              )}

              {/* House Rules */}
              {selectedRoom.rules && Object.keys(selectedRoom.rules).length > 0 && (
                <RulesSection rules={selectedRoom.rules as Record<string, unknown>} />
              )}

              {/* Map */}
              {selectedRoom.latitude != null && selectedRoom.longitude != null && (
                <div className="mb-6">
                  <h3 className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant mb-3">Location on Map</h3>
                  <div className="w-full h-48 rounded-xl overflow-hidden ring-1 ring-outline-variant/20">
                    <RoomDetailMap lat={selectedRoom.latitude} lng={selectedRoom.longitude} />
                  </div>
                </div>
              )}

              {/* Status badge */}
              <div className="flex items-center gap-2 mb-5">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />Available Now
                </span>
              </div>

              {/* CTA */}
              <button
                onClick={() => { setDepositInfoOpen(false); setShowBookingModal(true); }}
                className="w-full relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white font-headline font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer group"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                Reserve Free Visit Slot
                <span className="material-symbols-outlined text-[18px] opacity-80">arrow_forward</span>
              </button>
              <p className="text-center text-xs text-on-surface-variant mt-3 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-emerald-500">verified_user</span>
                No commitment · Visit first, decide later
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ BOOKING OPTIONS MODAL ══════════════ */}
      {showBookingModal && selectedRoom && (
        <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center" onClick={() => setShowBookingModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]" />
          <div className="relative bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92dvh] overflow-y-auto shadow-2xl animate-[slideUp_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-surface-container-lowest/95 backdrop-blur-sm px-6 pt-6 pb-4 border-b border-outline/10">
              <button onClick={() => setShowBookingModal(false)} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-surface-container-highest transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
              <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">Schedule Your Visit</p>
              <h2 className="text-xl font-headline font-bold text-on-surface leading-snug pr-10">How would you like to book?</h2>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Step 1: Details */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</span>
                  <h3 className="font-headline font-semibold text-[15px] text-on-surface">Your Details</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Full Name</label>
                    <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="e.g. Rahul Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Phone</label>
                      <input type="tel" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Email</label>
                      <input type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} placeholder="you@email.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Priority Visit Date 1</label>
                    <input type="datetime-local" value={date1} onChange={(e) => setDate1(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Priority Visit Date 2</label>
                    <input type="datetime-local" value={date2} onChange={(e) => setDate2(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition" />
                    <p className="mt-1.5 text-[11px] text-on-surface-variant/70 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">info</span>Select a backup date in case the owner is busy.
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider → Step 2 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-outline/15" />
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</span>
                  <span className="text-xs font-semibold text-on-surface-variant">Choose how to book</span>
                </div>
                <div className="flex-1 h-px bg-outline/15" />
              </div>

              {/* Option A: Token / Deposit */}
              <button onClick={handleTokenPayment}
                className="w-full text-left group relative overflow-hidden rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/40 p-4 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/15 active:scale-[0.99] transition-all duration-200 cursor-pointer">
                <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Recommended</span>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-[24px] text-emerald-600">verified_user</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline font-bold text-[15px] text-on-surface leading-snug pr-16">Lock Room for 5 Days</h3>
                    <p className="text-sm font-semibold text-emerald-900 mt-0.5">
                      Pay ₹{((selectedRoom.deposit ?? selectedRoom.security_deposit ?? selectedRoom.price) * 0.1).toLocaleString("en-IN")} deposit (10%)
                    </p>
                    <p className="text-xs text-emerald-950 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">replay</span>100% Refundable
                      <span className="mx-1 text-emerald-800">·</span>
                      <span className="material-symbols-outlined text-[12px]">block</span>No Brokerage
                    </p>
                    <div role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setDepositInfoOpen(!depositInfoOpen); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setDepositInfoOpen(!depositInfoOpen); }}}
                      className="mt-2 text-xs font-semibold text-emerald-900 hover:text-emerald-950 flex items-center gap-1 cursor-pointer">
                      <span className="material-symbols-outlined text-[13px]">info</span>Know More
                    </div>
                    {depositInfoOpen && (
                      <div className="mt-2 text-xs text-slate-700 leading-relaxed bg-white border border-emerald-200 rounded-xl p-3 animate-[fadeIn_0.15s_ease-out]">
                        This is <strong className="text-slate-900">NOT</strong> a broker fee. Pay 10% of the security deposit to hold this room exclusively for 5 working days. If you finalize, this amount adjusts into your total deposit. If you don&apos;t visit or dislike the room, you get a <strong className="text-emerald-700">100% instant refund</strong>.
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Or divider */}
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-px bg-outline/20" />
                <span className="text-xs text-on-surface-variant font-medium">or</span>
                <div className="flex-1 h-px bg-outline/20" />
              </div>

              {/* Option B: Free Booking */}
              <button onClick={handleFreeBooking}
                className="w-full text-left rounded-2xl border border-outline/30 bg-surface-container-low p-4 hover:bg-surface-container hover:border-outline/50 active:scale-[0.99] transition-all duration-200 cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px] text-on-surface-variant">event_available</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-headline font-semibold text-[15px] text-on-surface">Book for Free</h3>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Zero payment now, but the room remains open to others.
                      <span className="text-orange-500 font-medium"> High chances of getting sold out.</span>
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav activeTab="Match" />
    </div>
  );
}
