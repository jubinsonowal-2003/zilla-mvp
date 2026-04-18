"use client";

import { useRouter } from "next/navigation";
import TopAppBar from "../components/TopAppBar";
import BottomNav from "../components/BottomNav";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBRg-XF7oYruItq5eBgoS_siIQpBjQDyGiD8j-ZZFPOrDASWUHl47QvbsqKOC0-Q7W_fSWLwgrFKGbgUuHM6WNnOhflmspvjpLs_NbvYET4DUfcAOoKfsLSazKOktWjsDpo1Jqh7X-N2oIwia8kUvjUHcvuVFY6nWNKpQ3UJUJXcg3xK8u-hyc4divvyun6SZVTDKtOPD93DjUClv1S4H27eWomJ4LECzrGIpYqasYvZWOo-yx_JX2AzCGeR-6ZDOXBpkNsyHUnCgE";

export default function RoleSelectionPage() {
  const router = useRouter();

  const handleRoleSelect = (role: "owner" | "seeker") => {
    // Persist role to localStorage
    localStorage.setItem("zilla_user_role", role);

    // Generate session ID if missing
    if (!localStorage.getItem("zilla_session_id")) {
      localStorage.setItem("zilla_session_id", crypto.randomUUID());
    }

    if (role === "owner") {
      router.push("/dashboard/owner");
    } else {
      router.push("/onboarding");
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-dvh flex flex-col relative overflow-x-hidden">
      {/* Top App Bar */}
      <TopAppBar avatarUrl={AVATAR_URL} showSearch />

      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col items-center justify-center pt-24 pb-32 px-6 relative z-10 w-full max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="w-full text-center mb-20 mt-16 md:mt-24">
          <h1 className="font-headline text-5xl md:text-[3.5rem] font-bold text-on-surface mb-6 tracking-tight leading-tight max-w-4xl mx-auto">
            Find your perfect space. Match with your perfect people.
          </h1>
          <p className="font-body text-xl md:text-2xl text-on-surface-variant max-w-2xl mx-auto font-medium">
            ZILLA
          </p>
        </section>

        {/* Role Selection Cards */}
        <section className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Owner Card */}
          <button
            onClick={() => handleRoleSelect("owner")}
            className="group relative block bg-surface-container-lowest rounded-[1.5rem] p-10 text-center transition-all duration-300 hover:scale-[1.02] hover:-translate-y-2 shadow-ambient hover:shadow-ambient-hover cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-[1.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mb-8 group-hover:bg-primary-container transition-colors duration-300">
                <span className="material-symbols-outlined text-[3rem] text-primary group-hover:text-on-primary-container transition-colors duration-300">
                  home
                </span>
              </div>
              <h2 className="font-headline text-[1.75rem] font-semibold text-on-surface mb-4">
                I am an Owner
              </h2>
              <p className="font-body text-base text-on-surface-variant max-w-[250px]">
                List properties and find verified tenants.
              </p>
            </div>
          </button>

          {/* Seeker Card */}
          <button
            onClick={() => handleRoleSelect("seeker")}
            className="group relative block bg-surface-container-lowest rounded-[1.5rem] p-10 text-center transition-all duration-300 hover:scale-[1.02] hover:-translate-y-2 shadow-ambient hover:shadow-ambient-hover cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-[1.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mb-8 group-hover:bg-primary-container transition-colors duration-300">
                <span className="material-symbols-outlined text-[3rem] text-primary group-hover:text-on-primary-container transition-colors duration-300">
                  group
                </span>
              </div>
              <h2 className="font-headline text-[1.75rem] font-semibold text-on-surface mb-4">
                I am a Seeker
              </h2>
              <p className="font-body text-base text-on-surface-variant max-w-[250px]">
                Discover rooms and match with like-minded roommates.
              </p>
            </div>
          </button>
        </section>
      </main>

      {/* Bottom Nav Bar */}
      <BottomNav activeTab="Explore" />

      {/* Background Decorative Orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px] -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-tertiary/5 blur-[120px] -z-10 pointer-events-none" />
    </div>
  );
}
