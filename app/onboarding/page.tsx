"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [preferredArea, setPreferredArea] = useState("");
  const [sleepSchedule, setSleepSchedule] = useState("Night Owl");
  const [workStyle, setWorkStyle] = useState("Remote");
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sleepOptions = ["Early Bird", "Night Owl", "Flexible"];
  const workOptions = ["9 to 5", "Remote", "Night Shift", "Student"];

  const isFormValid =
    budgetMin.trim() !== "" &&
    budgetMax.trim() !== "" &&
    preferredArea.trim() !== "";

  const handleSubmit = async () => {
    if (!isFormValid) {
      setShowErrors(true);
      return;
    }

    setIsSaving(true);

    try {
      // MVP Session Hack: generate or reuse a unique session ID
      let sessionId = localStorage.getItem("zilla_session_id");
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("zilla_session_id", sessionId);
      }

      // Get user name from auth step
      let userName = "Anonymous";
      try {
        const user = JSON.parse(localStorage.getItem("zillaUser") || "{}");
        userName = user.fullName || "Anonymous";
      } catch { /* ignore */ }

      // INSERT into seeker_profiles — ONLY valid columns:
      // user_id, full_name, budget_min, budget_max, location, vibe, work_style
      const payload = {
        user_id: sessionId,
        full_name: userName,
        budget_min: parseInt(budgetMin),
        budget_max: parseInt(budgetMax),
        location: preferredArea.trim(),
        vibe: sleepSchedule,
        work_style: workStyle,
      };

      console.log("[ZILLA] Inserting seeker profile:", payload);

      const { data, error } = await supabase
        .from("seeker_profiles")
        .insert(payload)
        .select();

      if (error) {
        console.error("[ZILLA] Insert failed:", JSON.stringify(error));
      } else {
        console.log("[ZILLA] Profile saved successfully:", data);
      }

      // Persist to localStorage for immediate dashboard use
      const preferences = {
        budgetMin,
        budgetMax,
        preferredArea,
        sleepSchedule,
        workStyle,
        smokingAllowed,
      };
      localStorage.setItem("zillaPreferences", JSON.stringify(preferences));

      router.push("/dashboard/seeker");
    } catch (err) {
      console.error("[ZILLA] Unexpected error:", err);
      // Navigate anyway so user isn't stuck
      router.push("/dashboard/seeker");
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

          {/* Location Section */}
          <section className="space-y-4">
            <label className="block font-label text-[0.75rem] uppercase tracking-wider text-on-surface font-semibold mb-2">
              Preferred Area
              <span className="text-error ml-1">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                search
              </span>
              <input
                className={`w-full bg-surface-container-low border-0 outline-none rounded-[0.75rem] py-4 pl-12 pr-4 text-on-surface font-body font-medium focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-outline ${
                  showErrors && !preferredArea.trim() ? inputErrorRing : ""
                }`}
                placeholder="Search neighborhoods or cities..."
                type="text"
                value={preferredArea}
                onChange={(e) => {
                  setPreferredArea(e.target.value);
                  if (showErrors) setShowErrors(false);
                }}
              />
              {showErrors && !preferredArea.trim() && (
                <p className="text-error text-xs font-label mt-1.5 ml-1">
                  Please enter a preferred area
                </p>
              )}
            </div>
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

      {/* Error Toast */}
      {showErrors && !isFormValid && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-error text-on-error px-6 py-3 rounded-xl shadow-lg font-body text-sm font-medium flex items-center gap-2 animate-[slideDown_0.3s_ease-out]">
          <span className="material-symbols-outlined text-[18px]">error</span>
          Please fill in all required fields
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
