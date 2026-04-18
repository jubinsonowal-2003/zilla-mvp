"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const isFormValid =
    fullName.trim() !== "" && email.trim() !== "" && password.trim() !== "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      setShowErrors(true);
      return;
    }

    // Simulate successful signup — persist user name for downstream pages
    localStorage.setItem(
      "zillaUser",
      JSON.stringify({ fullName, email })
    );

    router.push("/role");
  };

  const inputErrorRing = "ring-2 ring-error/60";

  return (
    <div className="bg-surface font-body text-on-surface min-h-dvh flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Orbs */}
      <div className="fixed top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-tertiary/5 blur-[120px] pointer-events-none" />

      {/* Auth Card */}
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-ambient p-8 sm:p-10 relative overflow-hidden z-10">
        {/* Gradient orb behind content */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-10 relative z-10">
          <h1 className="font-headline text-4xl font-bold tracking-tight text-primary mb-3">
            ZILLA
          </h1>
          <p className="font-body text-base text-on-surface-variant">
            Your editorial real estate experience starts here.
          </p>
        </div>

        {/* Form */}
        <form className="space-y-5 relative z-10" onSubmit={handleSubmit}>
          {/* Full Name */}
          <div>
            <label
              className="block text-sm font-label font-medium text-on-surface mb-1"
              htmlFor="fullName"
            >
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">
                  person
                </span>
              </div>
              <input
                className={`block w-full pl-10 pr-3 py-3 bg-surface-container-low border-0 outline-none rounded-[0.75rem] text-on-surface placeholder:text-outline-variant font-body text-base transition-all focus:ring-[2px] focus:ring-primary/40 ${
                  showErrors && !fullName.trim() ? inputErrorRing : ""
                }`}
                id="fullName"
                placeholder="Jane Doe"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (showErrors) setShowErrors(false);
                }}
              />
            </div>
            {showErrors && !fullName.trim() && (
              <p className="text-error text-xs font-label mt-1.5 ml-1">
                Please enter your name
              </p>
            )}
          </div>

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
                <span className="material-symbols-outlined text-[20px]">
                  mail
                </span>
              </div>
              <input
                className={`block w-full pl-10 pr-3 py-3 bg-surface-container-low border-0 outline-none rounded-[0.75rem] text-on-surface placeholder:text-outline-variant font-body text-base transition-all focus:ring-[2px] focus:ring-primary/40 ${
                  showErrors && !email.trim() ? inputErrorRing : ""
                }`}
                id="email"
                placeholder="jane@example.com"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (showErrors) setShowErrors(false);
                }}
              />
            </div>
            {showErrors && !email.trim() && (
              <p className="text-error text-xs font-label mt-1.5 ml-1">
                Please enter your email
              </p>
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
                <span className="material-symbols-outlined text-[20px]">
                  lock
                </span>
              </div>
              <input
                className={`block w-full pl-10 pr-3 py-3 bg-surface-container-low border-0 outline-none rounded-[0.75rem] text-on-surface placeholder:text-outline-variant font-body text-base transition-all focus:ring-[2px] focus:ring-primary/40 ${
                  showErrors && !password.trim() ? inputErrorRing : ""
                }`}
                id="password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (showErrors) setShowErrors(false);
                }}
              />
            </div>
            {showErrors && !password.trim() && (
              <p className="text-error text-xs font-label mt-1.5 ml-1">
                Please enter a password
              </p>
            )}
          </div>

          {/* CTA Button */}
          <button
            className="w-full mt-6 py-4 px-6 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-semibold text-lg hover:scale-[1.02] transition-transform duration-200 shadow-md cursor-pointer"
            type="submit"
          >
            Get Started
          </button>
        </form>

        {/* Divider */}
        <div className="mt-8 mb-6 relative z-10 flex items-center justify-center">
          <div className="flex-grow h-px bg-surface-container-high" />
          <span className="px-4 text-xs font-label font-medium text-outline">
            OR
          </span>
          <div className="flex-grow h-px bg-surface-container-high" />
        </div>

        {/* Google Auth */}
        <button
          onClick={() => {
            localStorage.setItem(
              "zillaUser",
              JSON.stringify({ fullName: "User", email: "user@gmail.com" })
            );
            router.push("/role");
          }}
          className="w-full relative z-10 py-3 px-4 rounded-[0.75rem] bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-body font-medium hover:bg-surface-container-low transition-colors duration-200 flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.8 15.71 17.58V20.34H19.28C21.36 18.42 22.56 15.6 22.56 12.25Z"
              fill="#4285F4"
            />
            <path
              d="M12 23C14.97 23 17.46 22.02 19.28 20.34L15.71 17.58C14.73 18.24 13.48 18.63 12 18.63C9.14 18.63 6.71 16.71 5.84 14.13H2.15V16.98C3.96 20.58 7.7 23 12 23Z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.13C5.62 13.47 5.49 12.75 5.49 12C5.49 11.25 5.62 10.53 5.84 9.87V7.02H2.15C1.41 8.5 1 10.19 1 12C1 13.81 1.41 15.5 2.15 16.98L5.84 14.13Z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38C13.62 5.38 15.07 5.93 16.22 7.02L19.36 3.88C17.46 2.11 14.97 1 12 1C7.7 1 3.96 3.42 2.15 7.02L5.84 9.87C6.71 7.29 9.14 5.38 12 5.38Z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Footer */}
        <div className="mt-6 text-center relative z-10">
          <p className="text-sm font-body text-on-surface-variant">
            Already have an account?{" "}
            <button className="text-primary font-semibold hover:text-primary-container transition-colors cursor-pointer">
              Log In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
