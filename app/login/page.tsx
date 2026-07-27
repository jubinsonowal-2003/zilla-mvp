"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Separate flag so the password-length error appears inline under the field
  const [passwordTooShort, setPasswordTooShort] = useState(false);

  const isFormValid = email.trim() !== "" && password.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      setShowErrors(true);
      return;
    }

    // ── Client-side password length check (Supabase minimum is 6 chars) ───
    if (password.length < 6) {
      setPasswordTooShort(true);
      return;
    }
    setPasswordTooShort(false);

    setIsLoading(true);
    setAuthError(null);

    try {
      // ── Try real Supabase auth ────────────────────────────────────────
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError || !authData?.user || !authData.session) {
        setAuthError(
          signInError?.message === "Invalid login credentials"
            ? "Incorrect email or password. Please try again."
            : signInError?.message ?? "Login failed. Please try again."
        );
        setIsLoading(false);
        return;
      }

      // ── Persist lightweight session hints to localStorage ─────────────
      localStorage.setItem("zilla_session_id", authData.user.id);
      localStorage.setItem(
        "zillaUser",
        JSON.stringify({ email: authData.user.email })
      );

      // ── Delegate redirect logic to the Server Action ──────────────────
      //   Pass the JWT so the server verifies the user and fetches their
      //   role from `profiles` without trusting any client-side state.
      const { redirectTo, error: actionError } = await loginAction(
        authData.session.access_token
      );

      if (actionError) {
        console.error("[Login] loginAction error:", actionError);
      }

      // Sync the role hint to localStorage from the resolved destination.
      const inferredRole = redirectTo.includes("/dashboard/owner")
        ? "owner"
        : "seeker";
      localStorage.setItem("zilla_user_role", inferredRole);

      router.push(redirectTo);
    } catch (err) {
      console.error("[ZILLA] Unexpected login error:", err);
      setAuthError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setAuthError(null);

    // ── Try Supabase OAuth (redirects away; kept as no-op in MVP) ──────────
    // For the MVP demo, fall back to the session-ID approach.
    localStorage.setItem("zillaUser", JSON.stringify({ fullName: "User", email: "user@gmail.com" }));
    localStorage.setItem("zilla_user_role", "seeker");

    let sessionId = localStorage.getItem("zilla_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("zilla_session_id", sessionId);
    }

    // Default MVP Google route — real OAuth would use loginAction post-redirect.
    router.push("/onboarding");
    setIsLoading(false);
  };

  const inputErrorRing = "ring-2 ring-error/60";

  return (
    <div className="bg-surface font-body text-on-surface min-h-dvh flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Orbs */}
      <div className="fixed top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-tertiary/5 blur-[120px] pointer-events-none" />

      {/* Auth Card */}
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-ambient p-8 sm:p-10 relative overflow-hidden z-10">
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-10 relative z-10">
          <h1 className="font-headline text-4xl font-bold tracking-tight text-primary mb-3">
            ZILLA
          </h1>
          <p className="font-body text-base text-on-surface-variant">
            Welcome back. Pick up where you left off.
          </p>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="mb-5 relative z-10 flex items-center gap-2.5 rounded-xl bg-error/10 border border-error/25 px-4 py-3 text-sm font-body text-error">
            <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
            {authError}
          </div>
        )}

        {/* Form */}
        <form className="space-y-5 relative z-10" onSubmit={handleSubmit}>
          {/* Email */}
          <div>
            <label
              className="block text-sm font-label font-medium text-on-surface mb-1"
              htmlFor="email"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">mail</span>
              </div>
              <input
                className={`block w-full pl-10 pr-3 py-3 bg-surface-container-low border-0 outline-none rounded-[0.75rem] text-on-surface placeholder:text-outline-variant font-body text-base transition-all focus:ring-[2px] focus:ring-primary/40 ${
                  (showErrors && !email.trim()) || authError ? inputErrorRing : ""
                }`}
                id="email"
                placeholder="jane@example.com"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (showErrors) setShowErrors(false);
                  if (authError) setAuthError(null);
                }}
              />
            </div>
            {showErrors && !email.trim() && (
              <p className="text-error text-xs font-label mt-1.5 ml-1">Please enter your email</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-sm font-label font-medium text-on-surface mb-1"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <input
                className={`block w-full pl-10 pr-3 py-3 bg-surface-container-low border-0 outline-none rounded-[0.75rem] text-on-surface placeholder:text-outline-variant font-body text-base transition-all focus:ring-[2px] focus:ring-primary/40 ${
                  (showErrors && !password.trim()) || authError || passwordTooShort ? inputErrorRing : ""
                }`}
                id="password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (showErrors) setShowErrors(false);
                  if (authError) setAuthError(null);
                  if (passwordTooShort) setPasswordTooShort(false);
                }}
              />
            </div>
            {showErrors && !password.trim() && (
              <p className="text-error text-xs font-label mt-1.5 ml-1">Please enter your password</p>
            )}
            {passwordTooShort && (
              <p className="text-error text-xs font-label mt-1.5 ml-1">
                Password must be at least 6 characters long
              </p>
            )}
          </div>

          {/* CTA Button */}
          <button
            className="w-full mt-6 py-4 px-6 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-semibold text-lg hover:scale-[1.02] transition-transform duration-200 shadow-md cursor-pointer disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in...
              </>
            ) : (
              "Log In"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-8 mb-6 relative z-10 flex items-center justify-center">
          <div className="flex-grow h-px bg-surface-container-high" />
          <span className="px-4 text-xs font-label font-medium text-outline">OR</span>
          <div className="flex-grow h-px bg-surface-container-high" />
        </div>

        {/* Google Auth */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full relative z-10 py-3 px-4 rounded-[0.75rem] bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-body font-medium hover:bg-surface-container-low transition-colors duration-200 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-70"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.8 15.71 17.58V20.34H19.28C21.36 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4" />
            <path d="M12 23C14.97 23 17.46 22.02 19.28 20.34L15.71 17.58C14.73 18.24 13.48 18.63 12 18.63C9.14 18.63 6.71 16.71 5.84 14.13H2.15V16.98C3.96 20.58 7.7 23 12 23Z" fill="#34A853" />
            <path d="M5.84 14.13C5.62 13.47 5.49 12.75 5.49 12C5.49 11.25 5.62 10.53 5.84 9.87V7.02H2.15C1.41 8.5 1 10.19 1 12C1 13.81 1.41 15.5 2.15 16.98L5.84 14.13Z" fill="#FBBC05" />
            <path d="M12 5.38C13.62 5.38 15.07 5.93 16.22 7.02L19.36 3.88C17.46 2.11 14.97 1 12 1C7.7 1 3.96 3.42 2.15 7.02L5.84 9.87C6.71 7.29 9.14 5.38 12 5.38Z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* Footer */}
        <div className="mt-6 text-center relative z-10">
          <p className="text-sm font-body text-on-surface-variant">
            New to ZILLA?{" "}
            <Link href="/" className="text-primary font-semibold hover:text-primary-container transition-colors">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}