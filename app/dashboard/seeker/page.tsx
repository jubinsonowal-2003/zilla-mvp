"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  security_deposit?: number;
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

/* ─── Roommates Coming Soon Component ─── */
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
      // Resolve the current user's seeker_profiles.id (soft FK)
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
      ]
        .filter(Boolean)
        .join(" | ");

      const { error } = await supabase.from("feature_feedback").insert({
        user_id: seekerProfileId,          // null is fine — column is nullable
        feature_name: "roommate_matching",
        feedback_text: feedbackText,
      });

      if (error) {
        console.error("[ZILLA] Feedback insert failed:", error.message);
        setSubmitError("Could not save your feedback. Please try again.");
        return;
      }

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

      {/* ── Illustration ── */}
      <div className="relative mb-8">
        {/* Glowing orb behind icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-40 h-40 rounded-full bg-primary/8 blur-3xl" />
        </div>
        <div className="relative w-32 h-32 rounded-[2rem] bg-gradient-to-br from-primary-fixed to-secondary-fixed flex items-center justify-center shadow-ambient mx-auto">
          {/* People + sparkle SVG illustration */}
          <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Person left */}
            <circle cx="24" cy="28" r="9" fill="#4648d4" opacity="0.85"/>
            <path d="M8 56c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#4648d4" strokeWidth="3" strokeLinecap="round" opacity="0.85"/>
            {/* Person right */}
            <circle cx="56" cy="28" r="9" fill="#575992" opacity="0.75"/>
            <path d="M40 56c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#575992" strokeWidth="3" strokeLinecap="round" opacity="0.75"/>
            {/* Sparkle centre */}
            <path d="M40 14 L41.5 18 L46 18 L42.5 21 L44 25 L40 22.5 L36 25 L37.5 21 L34 18 L38.5 18 Z" fill="#904900" opacity="0.9"/>
            {/* Connector dots */}
            <circle cx="34" cy="40" r="2" fill="#4648d4" opacity="0.5"/>
            <circle cx="40" cy="40" r="2.5" fill="#4648d4" opacity="0.7"/>
            <circle cx="46" cy="40" r="2" fill="#4648d4" opacity="0.5"/>
          </svg>
        </div>
      </div>

      {/* ── Badge ── */}
      <div className="inline-flex items-center gap-1.5 bg-tertiary/10 text-tertiary px-4 py-1.5 rounded-full text-xs font-semibold font-label mb-4 border border-tertiary/20">
        <span className="material-symbols-outlined text-[14px]">schedule</span>
        Coming Soon
      </div>

      {/* ── Headline ── */}
      <h2 className="font-headline text-2xl font-bold text-on-surface tracking-tight mb-3">
        Roommate Matching is<br />on its way ✨
      </h2>
      <p className="font-body text-sm text-on-surface-variant max-w-xs leading-relaxed mb-10">
        We&apos;re building smart compatibility matching so you can find people who actually vibe with your lifestyle, budget, and schedule.
      </p>

      {/* ── Survey Card ── */}
      {!submitted ? (
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-ambient border border-outline-variant/10 p-6 text-left space-y-5">
          <div>
            <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold mb-1">Quick Feedback</p>
            <p className="font-body text-sm font-semibold text-on-surface">
              Would a roommate matching feature be useful to you?
            </p>
          </div>

          {/* ── Interest poll ── */}
          <div className="flex gap-2">
            {(["yes", "maybe", "no"] as const).map((opt) => {
              const labels = { yes: "Yes, definitely!", maybe: "Maybe", no: "Not really" };
              const icons = { yes: "thumb_up", maybe: "thumbs_up_down", no: "thumb_down" };
              const active = interest === opt;
              return (
                <button
                  key={opt}
                  id={`interest-${opt}`}
                  onClick={() => setInterest(opt)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold font-label transition-all duration-200 cursor-pointer ${
                    active
                      ? "border-primary bg-primary/8 text-primary shadow-[0_0_0_2px_rgba(70,72,212,0.15)]"
                      : "border-outline-variant/20 bg-surface-container text-on-surface-variant hover:border-outline/40 hover:bg-surface-container-low"
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${active ? "filled text-primary" : ""}`}>
                    {icons[opt]}
                  </span>
                  {labels[opt]}
                </button>
              );
            })}
          </div>

          {/* ── Challenge text ── */}
          <div>
            <label
              htmlFor="roommate-challenge"
              className="block font-label text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-2"
            >
              What&apos;s your biggest challenge in finding a roommate?
              <span className="ml-1 text-outline font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="roommate-challenge"
              rows={3}
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              placeholder="e.g. hard to find someone with the same sleep schedule..."
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-body text-on-surface placeholder:text-on-surface-variant/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
            />
          </div>

          {/* ── Error ── */}
          {submitError && (
            <p className="text-error text-xs font-label flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {submitError}
            </p>
          )}

          {/* ── Submit ── */}
          <button
            id="submit-roommate-feedback"
            onClick={handleSubmit}
            disabled={!interest || submitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 shadow-md disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">send</span>
                Share My Feedback
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-on-surface-variant/50 font-body">
            Your response helps us prioritise what to build next.
          </p>
        </div>
      ) : (
        /* ── Success state ── */
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

      {/* ── Toast ── */}
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-on-surface text-surface px-5 py-3 rounded-xl shadow-lg font-body text-sm font-medium flex items-center gap-2 animate-[slideDown_0.3s_ease-out]">
          <span className="material-symbols-outlined text-[18px] text-green-400 filled">check_circle</span>
          Feedback saved — thanks for shaping ZILLA!
        </div>
      )}
    </section>
  );
}

export default function SeekerDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"rooms" | "roommates">("rooms");
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [depositInfoOpen, setDepositInfoOpen] = useState(false);

  // ── Form states for booking modal ──────────────────────────────────────────
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");

  // Route guard: redirect if no session or role
  useEffect(() => {
    const sessionId = localStorage.getItem("zilla_session_id");
    const role = localStorage.getItem("zilla_user_role");
    if (!sessionId || !role) {
      router.push("/role");
      return;
    }
    setAuthChecked(true);
  }, [router]);

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
    if (authChecked) {
      fetchRooms();
      fetchSeekers();
    }
  }, [authChecked, fetchRooms, fetchSeekers]);

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

  /* ─── Booking handlers ─── */
  const handleTokenPayment = () => {
    if (!selectedRoom) return;

    // ── Validate form fields ─────────────────────────────────────────────────
    if (!tenantName.trim() || !tenantPhone.trim() || !tenantEmail.trim() || !date1 || !date2) {
      alert("Please complete all your details (Name, Phone, Email, and both visit dates) before proceeding.");
      return;
    }

    // Stash booking data for the checkout page to consume
    sessionStorage.setItem(
      "zilla_pending_booking",
      JSON.stringify({
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim(),
        tenantEmail: tenantEmail.trim(),
        date1,
        date2,
        roomId: selectedRoom.id,
        roomTitle: selectedRoom.title,
        roomPrice: selectedRoom.price,
        securityDeposit: selectedRoom.security_deposit ?? selectedRoom.price,
      })
    );

    router.push("/checkout");
  };

  const handleFreeBooking = async () => {
    if (!selectedRoom) return;

    // ── Validate form fields ─────────────────────────────────────────────────
    if (!tenantName.trim() || !tenantPhone.trim() || !tenantEmail.trim() || !date1 || !date2) {
      alert("Please complete all your details (Name, Phone, Email, and both visit dates) before proceeding.");
      return;
    }

    // ── Resolve (or auto-create) the seeker_profiles row ────────────────────
    // bookings.seeker_id is a FK → seeker_profiles.id, NOT auth.users.id.
    // We use getUser() to get the canonical auth identity, then upsert a
    // minimal profile row so the FK is always satisfied.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      alert("You must be logged in to make a booking. Please log in and try again.");
      router.push("/role-selection");
      return;
    }

    // Try to find an existing profile first
    let { data: seekerProfile } = await supabase
      .from("seeker_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Auto-heal: no profile yet → insert a minimal placeholder row
    if (!seekerProfile) {
      console.log("[Booking] No seeker_profiles row found — auto-creating a placeholder.");
      const { data: newProfile, error: insertError } = await supabase
        .from("seeker_profiles")
        .insert({
          user_id: user.id,
          full_name: tenantName.trim(),
          // Use the email the user typed in the form; fall back to the auth session email
          email: tenantEmail.trim() || user.email || "",
          budget_min: 0,
          budget_max: 100000,
          location: "",
          vibe: "",
          work_style: "",
        })
        .select("id")
        .single();

      if (insertError || !newProfile) {
        console.error("[Booking] Failed to auto-create seeker profile:", insertError);
        alert("Could not set up your booking profile. Please complete onboarding first.");
        router.push("/role-selection");
        return;
      }
      seekerProfile = newProfile;
    }

    const seekerId = seekerProfile.id;

    console.log("[Booking] handleFreeBooking called");
    console.log("  → roomId  :", selectedRoom.id);
    console.log("  → seekerId:", seekerId);

    const { createBooking } = await import("@/app/actions/booking");
    const result = await createBooking({
      roomId: selectedRoom.id,
      seekerId,
      isPremium: false,
      tenantName: tenantName.trim(),
      tenantPhone: tenantPhone.trim(),
      tenantEmail: tenantEmail.trim(),
      date1,
      date2,
    });

    if (!result.success) {
      console.error("[Booking] Free booking failed:", result.error);
      alert(`Booking failed: ${result.error}`);
      return;
    }

    router.push('/booking/' + result.bookingId + '?code=' + result.secureCode);
  };


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
      <TopAppBar avatarUrl={AVATAR_URL} showSearch showDesktopSearch showPreferences />

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
                        <button
                          onClick={() => setSelectedRoom(room)}
                          className="bg-gradient-to-br from-primary to-primary-container text-white px-4 py-2 rounded-[0.75rem] text-xs font-semibold font-body hover:scale-105 transition-transform duration-200 cursor-pointer flex items-center gap-1"
                        >
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

        {/* ═══════════ FIND ROOMMATES — COMING SOON ═══════════ */}
        {activeSubTab === "roommates" && (
          <RoommatesComingSoon />
        )}
      </main>

      {/* ═══════════ ROOM DETAIL MODAL ═══════════ */}
      {selectedRoom && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
          onClick={() => setSelectedRoom(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

          {/* Modal Panel */}
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

            {/* Room Image */}
            <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-t-3xl sm:rounded-t-3xl">
              {selectedRoom.image_url ? (
                <Image
                  alt={selectedRoom.title}
                  src={selectedRoom.image_url}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 500px"
                />
              ) : (
                <div className="w-full h-full bg-surface-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-6xl text-outline/30">image</span>
                </div>
              )}
              {/* Price badge on image */}
              <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
                <span className="font-headline font-bold text-xl text-primary">
                  ₹{selectedRoom.price?.toLocaleString("en-IN")}
                </span>
                <span className="text-xs text-on-surface-variant font-body">/mo</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8">
              <h2 className="text-xl font-headline font-semibold text-on-surface mb-1">
                {selectedRoom.title}
              </h2>
              <p className="text-sm text-on-surface-variant flex items-center gap-1 mb-5">
                <span className="material-symbols-outlined text-[16px] text-outline">location_on</span>
                {selectedRoom.location}
              </p>

              {selectedRoom.description && (
                <div className="mb-6">
                  <h3 className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                    Description
                  </h3>
                  <p className="text-sm text-on-surface leading-relaxed">
                    {selectedRoom.description}
                  </p>
                </div>
              )}

              {/* Status + Available badge */}
              <div className="flex items-center gap-2 mb-6">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Available Now
                </span>
              </div>

              {/* CTA: Reserve Free Visit Slot */}
              <button
                onClick={() => { setDepositInfoOpen(false); setShowBookingModal(true); }}
                className="w-full relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white font-headline font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer group"
              >
                {/* shimmer effect */}
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

      {/* ═══════════ BOOKING OPTIONS MODAL ═══════════ */}
      {showBookingModal && selectedRoom && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
          onClick={() => setShowBookingModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]" />

          {/* Modal Panel */}
          <div
            className="relative bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92dvh] overflow-y-auto shadow-2xl animate-[slideUp_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-surface-container-lowest/95 backdrop-blur-sm px-6 pt-6 pb-4 border-b border-outline/10">
              <button
                onClick={() => setShowBookingModal(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-surface-container-highest transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
              <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">Schedule Your Visit</p>
              <h2 className="text-xl font-headline font-bold text-on-surface leading-snug pr-10">
                How would you like to book?
              </h2>
            </div>

            <div className="px-5 py-5 space-y-5">

              {/* ── Step 1: Your Details ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</span>
                  <h3 className="font-headline font-semibold text-[15px] text-on-surface">Your Details</h3>
                </div>

                <div className="space-y-3">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                    />
                  </div>

                  {/* Phone + Email row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Phone</label>
                      <input
                        type="tel"
                        value={tenantPhone}
                        onChange={(e) => setTenantPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Email</label>
                      <input
                        type="email"
                        value={tenantEmail}
                        onChange={(e) => setTenantEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                      />
                    </div>
                  </div>

                  {/* Priority Date 1 */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Priority Visit Date 1</label>
                    <input
                      type="datetime-local"
                      value={date1}
                      onChange={(e) => setDate1(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                    />
                  </div>

                  {/* Priority Date 2 */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Priority Visit Date 2</label>
                    <input
                      type="datetime-local"
                      value={date2}
                      onChange={(e) => setDate2(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                    />
                    <p className="mt-1.5 text-[11px] text-on-surface-variant/70 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">info</span>
                      Select a backup date in case the owner is busy.
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider between steps */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-outline/15" />
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</span>
                  <span className="text-xs font-semibold text-on-surface-variant">Choose how to book</span>
                </div>
                <div className="flex-1 h-px bg-outline/15" />
              </div>

              {/* ── Option A: Token / Deposit ── */}
              <button
                onClick={handleTokenPayment}
                className="w-full text-left group relative overflow-hidden rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/40 p-4 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/15 active:scale-[0.99] transition-all duration-200 cursor-pointer"
              >
                {/* Recommended badge */}
                <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Recommended</span>

                <div className="flex items-start gap-3">
                  {/* Shield icon */}
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-[24px] text-emerald-600">verified_user</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline font-bold text-[15px] text-on-surface leading-snug pr-16">
                      Lock Room for 5 Days
                    </h3>
                    <p className="text-sm font-semibold text-emerald-900 mt-0.5">
                      Pay ₹{((selectedRoom.security_deposit ?? selectedRoom.price) * 0.1).toLocaleString("en-IN")} deposit (10%)
                    </p>
                    <p className="text-xs text-emerald-950 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">replay</span>
                      100% Refundable
                      <span className="mx-1 text-emerald-800">·</span>
                      <span className="material-symbols-outlined text-[12px]">block</span>
                      No Brokerage
                    </p>

                    {/* Know More */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setDepositInfoOpen(!depositInfoOpen); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setDepositInfoOpen(!depositInfoOpen); } }}
                      className="mt-2 text-xs font-semibold text-emerald-900 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">info</span>
                      Know More
                    </div>

                    {depositInfoOpen && (
                      <div className="mt-2 text-xs text-slate-700 leading-relaxed bg-white border border-emerald-200 rounded-xl p-3 animate-[fadeIn_0.15s_ease-out]">
                        This is <strong className="text-slate-900">NOT</strong> a broker fee. Pay 10% of the security deposit to hold this room exclusively for you for 5 working days. If you finalize the room, this amount is adjusted into your total security deposit. If you don&apos;t visit or dislike the room, you get a <strong className="text-emerald-700">100% instant refund</strong>.
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-px bg-outline/20" />
                <span className="text-xs text-on-surface-variant font-medium">or</span>
                <div className="flex-1 h-px bg-outline/20" />
              </div>

              {/* ── Option B: Free Booking ── */}
              <button
                onClick={handleFreeBooking}
                className="w-full text-left rounded-2xl border border-outline/30 bg-surface-container-low p-4 hover:bg-surface-container hover:border-outline/50 active:scale-[0.99] transition-all duration-200 cursor-pointer"
              >
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
