"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  // Composite location: city dropdown + locality text search
  const [selectedCity, setSelectedCity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sleepSchedule, setSleepSchedule] = useState("Night Owl");
  const [workStyle, setWorkStyle] = useState("Remote");
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  /** Optional specific landmark (college/office) — geocoded to lat/lng on save */
  const [landmark, setLandmark] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const MVP_CITIES = ["Guwahati", "Nirjuli", "Itanagar", "Jorhat", "Nagaon"];
  const sleepOptions = ["Early Bird", "Night Owl", "Flexible"];
  const workOptions = ["9 to 5", "Remote", "Night Shift", "Student"];

  // Combine city + locality into a single location string for DB/localStorage
  const preferredArea = selectedCity
    ? searchQuery.trim()
      ? `${selectedCity}, ${searchQuery.trim()}`
      : selectedCity
    : searchQuery.trim();

  const isFormValid =
    budgetMin.trim() !== "" &&
    budgetMax.trim() !== "" &&
    selectedCity !== "";  // city is required; locality is optional

  const handleSubmit = async () => {
    if (!isFormValid) {
      setShowErrors(true);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // ── Resolve the canonical auth user ID ──────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();

      const userId = user?.id ?? (localStorage.getItem("zilla_session_id") || crypto.randomUUID());
      if (!user?.id) {
        localStorage.setItem("zilla_session_id", userId);
      }

      // Derive best display name from auth metadata or localStorage
      let userName = "Anonymous";
      try {
        const stored = JSON.parse(localStorage.getItem("zillaUser") || "{}");
        userName =
          stored.fullName ||
          user?.user_metadata?.full_name ||
          user?.email?.split("@")[0] ||
          "Anonymous";
      } catch { /* ignore */ }

      // ── Geocode the landmark (if provided) ─────────────────────────────
      let targetLatitude: number | null = null;
      let targetLongitude: number | null = null;

      if (landmark.trim()) {
        try {
          const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(landmark.trim())}&limit=1`;
          const geoRes = await fetch(geoUrl, {
            headers: { "Accept-Language": "en", "User-Agent": "ZillaApp/1.0" },
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.length > 0) {
              targetLatitude  = parseFloat(geoData[0].lat);
              targetLongitude = parseFloat(geoData[0].lon);
              console.log(`[ZILLA] Landmark geocoded: ${landmark.trim()} → (${targetLatitude}, ${targetLongitude})`);
            } else {
              console.warn(`[ZILLA] Nominatim returned no results for landmark: "${landmark.trim()}"`);
            }
          }
        } catch (geoErr) {
          console.warn("[ZILLA] Landmark geocoding failed (network?). Saving as null.", geoErr);
        }
      }

      const payload = {
        user_id: userId,
        full_name: userName,
        email: user?.email ?? "",
        budget_min: parseInt(budgetMin),
        budget_max: parseInt(budgetMax),
        location: preferredArea.trim(),
        vibe: sleepSchedule,
        work_style: workStyle,
        target_latitude:  targetLatitude,
        target_longitude: targetLongitude,
      };

      console.log("[ZILLA] Saving seeker profile:", payload);

      // ── Step 1: Try upsert with explicit conflict target ─────────────────
      const { error: upsertError } = await supabase
        .from("seeker_profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select();

      if (upsertError) {
        // ── Step 2: Upsert failed — fall back to query → update / insert ───
        console.warn("[ZILLA] Upsert failed, trying manual update/insert fallback:", upsertError.message);

        const { data: existing } = await supabase
          .from("seeker_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing?.id) {
          // Row already exists — update it in place
          const { error: updateError } = await supabase
            .from("seeker_profiles")
            .update(payload)
            .eq("user_id", userId);

          if (updateError) {
            console.error("[ZILLA] Fallback update failed:", updateError.message);
            setSaveError("Could not save your preferences. Please try again.");
            setIsSaving(false);
            return;
          }
          console.log("[ZILLA] Profile updated via fallback update.");
        } else {
          // No existing row — insert a fresh one
          const { error: insertError } = await supabase
            .from("seeker_profiles")
            .insert(payload);

          if (insertError) {
            console.error("[ZILLA] Fallback insert failed:", insertError.message);
            setSaveError("Could not save your preferences. Please try again.");
            setIsSaving(false);
            return;
          }
          console.log("[ZILLA] Profile created via fallback insert.");
        }
      } else {
        console.log("[ZILLA] Profile upserted successfully.");
      }

      // ── Persist to localStorage for immediate dashboard use ───────────────
      localStorage.setItem(
        "zillaPreferences",
        JSON.stringify({ budgetMin, budgetMax, preferredArea, sleepSchedule, workStyle, smokingAllowed, selectedCity, searchQuery, landmark })
      );

      router.push("/dashboard/seeker");
    } catch (err) {
      console.error("[ZILLA] Unexpected error during onboarding save:", err);
      setSaveError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };


  const inputErrorRing = "ring-2 ring-error/60";

  return (
    <div className="bg-surface text-on-surface font-body min-h-dvh flex flex-col relative pb-32">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-6 h-16 w-full fixed top-0 z-50 glass-panel shadow-ambient">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-primary hover:scale-105 transition-transform duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold tracking-tighter text-primary font-headline">
            ZILLA
          </h1>
        </div>
      </header>

      <main className="flex-1 mt-16 px-6 pt-10 pb-12 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-12">
          <h2 className="font-headline text-[1.75rem] font-semibold text-on-surface tracking-tight mb-3">
            Your Lifestyle
          </h2>
          <p className="font-body text-base text-on-surface-variant">
            Quick vibe check to find your perfect roommates.
          </p>
        </div>

        {/* Form Content */}
        <div className="space-y-12">
          {/* Budget Section */}
          <section className="space-y-4">
            <label className="block font-label text-[0.75rem] uppercase tracking-wider text-on-surface font-semibold mb-2">
              Monthly Budget
              <span className="text-error ml-1">*</span>
            </label>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-body font-medium">
                  ₹
                </span>
                <input
                  className={`w-full bg-surface-container-low border-0 outline-none rounded-[0.75rem] py-4 pl-10 pr-4 text-on-surface font-body font-medium focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-outline ${
                    showErrors && !budgetMin.trim() ? inputErrorRing : ""
                  }`}
                  placeholder="Min"
                  type="number"
                  value={budgetMin}
                  onChange={(e) => {
                    setBudgetMin(e.target.value);
                    if (showErrors) setShowErrors(false);
                  }}
                />
                {showErrors && !budgetMin.trim() && (
                  <p className="text-error text-xs font-label mt-1.5 ml-1">
                    Required
                  </p>
                )}
              </div>
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-body font-medium">
                  ₹
                </span>
                <input
                  className={`w-full bg-surface-container-low border-0 outline-none rounded-[0.75rem] py-4 pl-10 pr-4 text-on-surface font-body font-medium focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-outline ${
                    showErrors && !budgetMax.trim() ? inputErrorRing : ""
                  }`}
                  placeholder="Max"
                  type="number"
                  value={budgetMax}
                  onChange={(e) => {
                    setBudgetMax(e.target.value);
                    if (showErrors) setShowErrors(false);
                  }}
                />
                {showErrors && !budgetMax.trim() && (
                  <p className="text-error text-xs font-label mt-1.5 ml-1">
                    Required
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Location Section — composite city + locality bar */}
          <section className="space-y-4">
            <label className="block font-label text-[0.75rem] uppercase tracking-wider text-on-surface font-semibold mb-2">
              Preferred Area
              <span className="text-error ml-1">*</span>
            </label>

            {/* ── Unified pill container ── */}
            <div
              className={`flex items-stretch bg-surface-container-low rounded-[0.75rem] overflow-hidden transition-shadow focus-within:ring-2 focus-within:ring-primary/40 focus-within:bg-surface-container-lowest ${
                showErrors && selectedCity === "" ? inputErrorRing : ""
              }`}
            >
              {/* City dropdown — left segment */}
              <div className="relative flex items-center shrink-0">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
                  location_city
                </span>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    if (showErrors) setShowErrors(false);
                  }}
                  className="appearance-none bg-transparent pl-10 pr-8 py-4 text-sm font-body font-medium text-on-surface focus:outline-none cursor-pointer min-w-[9rem]"
                >
                  <option value="" disabled>City</option>
                  {MVP_CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                {/* Custom chevron for the select */}
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">
                  expand_more
                </span>
              </div>

              {/* Divider */}
              <div className="w-px self-stretch bg-outline-variant/30 my-3" />

              {/* Locality / Landmark input — right segment */}
              <div className="relative flex-1 flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search universities, offices, or localities..."
                  className="w-full bg-transparent pl-10 pr-4 py-4 text-sm font-body font-medium text-on-surface placeholder:text-outline focus:outline-none"
                />
              </div>
            </div>

            {showErrors && selectedCity === "" && (
              <p className="text-error text-xs font-label mt-1.5 ml-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">error</span>
                Please select a city
              </p>
            )}

            {/* ── Specific Landmark (optional) — geocoded to target_lat/lng ── */}
            <div className="relative mt-4">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
                location_on
              </span>
              <input
                id="landmark"
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g., NERIST, IIT Guwahati, Cybex Park…"
                className="w-full bg-surface-container-low border-0 outline-none rounded-[0.75rem] py-4 pl-12 pr-4 text-sm font-body font-medium text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
              />
            </div>
            <p className="text-xs text-on-surface-variant font-body flex items-center gap-1.5 mt-2 ml-1">
              <span className="material-symbols-outlined text-[13px] text-primary">my_location</span>
              <span>
                <span className="font-semibold text-on-surface">Specific Landmark</span>
                {" "}(College, Office, etc.) — Optional. Used to find rooms closest to you.
              </span>
            </p>
          </section>

          {/* Sleep Schedule */}
          <section className="space-y-4">
            <label className="block font-label text-[0.75rem] uppercase tracking-wider text-on-surface font-semibold mb-2">
              Sleep Schedule
            </label>
            <div className="flex flex-wrap gap-3">
              {sleepOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setSleepSchedule(option)}
                  className={`rounded-full px-6 py-3 font-body font-medium text-sm transition-colors cursor-pointer ${
                    sleepSchedule === option
                      ? "bg-primary text-on-primary shadow-[0_8px_16px_rgba(70,72,212,0.2)]"
                      : "bg-surface-container-lowest shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/15 text-on-surface hover:bg-surface-container"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          {/* Work Style */}
          <section className="space-y-4">
            <label className="block font-label text-[0.75rem] uppercase tracking-wider text-on-surface font-semibold mb-2">
              Work Style
            </label>
            <div className="grid grid-cols-2 gap-3">
              {workOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setWorkStyle(option)}
                  className={`rounded-full px-4 py-4 font-body font-medium text-sm text-center transition-colors cursor-pointer ${
                    workStyle === option
                      ? "bg-primary text-on-primary shadow-[0_8px_16px_rgba(70,72,212,0.2)]"
                      : "bg-surface-container-lowest shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/15 text-on-surface hover:bg-surface-container"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          {/* Smoking Toggle */}
          <section className="flex items-center justify-between p-6 bg-surface-container-lowest rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.02)] border border-outline-variant/15">
            <div>
              <h3 className="font-body font-medium text-[1.125rem] text-on-surface">
                Smoking Policy
              </h3>
              <p className="font-body text-sm text-on-surface-variant mt-1">
                Do you smoke or allow smoking?
              </p>
            </div>
            <button
              onClick={() => setSmokingAllowed(!smokingAllowed)}
              className={`w-12 h-6 rounded-full relative flex items-center shrink-0 transition-colors duration-300 focus:outline-none cursor-pointer ${
                smokingAllowed ? "bg-primary" : "bg-surface-container-high"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full absolute transition-transform duration-300 ${
                  smokingAllowed
                    ? "translate-x-[26px] bg-on-primary"
                    : "translate-x-0.5 bg-on-surface-variant"
                }`}
              />
            </button>
          </section>
        </div>
      </main>

      {/* Validation error toast — shown when required fields are empty */}
      {showErrors && !isFormValid && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-error text-on-error px-6 py-3 rounded-xl shadow-lg font-body text-sm font-medium flex items-center gap-2 animate-[slideDown_0.3s_ease-out]">
          <span className="material-symbols-outlined text-[18px]">error</span>
          Please fill in all required fields
        </div>
      )}

      {/* Save error toast — shown when the DB write fails */}
      {saveError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-error text-on-error px-6 py-3 rounded-xl shadow-lg font-body text-sm font-medium flex items-center gap-2 animate-[slideDown_0.3s_ease-out]">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {saveError}
        </div>
      )}

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-surface via-surface/90 to-transparent z-40 flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={isSaving || (showErrors && !isFormValid)}
          className={`w-full max-w-2xl font-headline font-semibold text-lg py-5 rounded-xl shadow-[0_20px_40px_rgba(70,72,212,0.15)] transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-2 ${
            showErrors && !isFormValid
              ? "bg-surface-container-high text-outline scale-100"
              : "bg-gradient-to-br from-primary to-primary-container text-on-primary hover:scale-[1.02]"
          }`}
        >
          {isSaving ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : (
            "Save & See Matches"
          )}
        </button>
      </div>
    </div>
  );
}
