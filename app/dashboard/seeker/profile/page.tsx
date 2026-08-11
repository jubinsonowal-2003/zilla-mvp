"use client";

import { useEffect, useState } from "react";
import TopAppBar from "../../../components/TopAppBar";
import BottomNav from "../../../components/BottomNav";
import { supabase } from "@/lib/supabase";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCWBNlcG9YcIUJqpqMBSxtbZUYqdg0VgM-QcbmI8Vdk5aSiXa7ZUnC_tQ_wVzyydo_HPBEUT-fgARlpVkCrsk_htxt39xXAYiFu3glIFSfs5h2ESQWuwTw6bpfE6MQddAuw5gCkyMN6gSl76uAGZFD_fGVYhwVqSbzpcZU-cksc0Sn_xBKIV_mPyBUEcGrxXWznDvHdtH0ZQMevd6cTA_JrfOtQz07qJF5edYlbe3o3EsVofIofZpQXpIdthVdr7OwH99zVazJ02wQ";

interface ProfileData {
  fullName: string;
  email: string;
  phone: string | null;
}

export default function SeekerProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        // 1. Get the authenticated session to retrieve email + user id.
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const email = user.email ?? "";

        // 2. Query seeker_profiles for full_name and phone using the user's id.
        const { data: seekerProfile } = await supabase
          .from("seeker_profiles")
          .select("full_name, phone")
          .eq("user_id", user.id)
          .maybeSingle();

        setProfile({
          fullName:
            seekerProfile?.full_name ||
            user.user_metadata?.full_name ||
            "",
          email,
          phone:
            seekerProfile?.phone ||
            user.user_metadata?.phone ||
            user.phone ||
            null,
        });
      } catch (err) {
        console.error("[SeekerProfile] Failed to fetch profile data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("zilla_session_id");
    localStorage.removeItem("zilla_user_role");
    localStorage.removeItem("zillaPreferences");
    window.location.href = "/role";
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-dvh pb-32 md:pb-8">
      <TopAppBar avatarUrl={AVATAR_URL} label="My Profile" />

      <main className="pt-28 px-4 max-w-lg mx-auto">
        {/* Avatar & Role Badge */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-ambient mb-4">
            <span className="material-symbols-outlined text-4xl text-white">person</span>
          </div>
          <span className="bg-primary-fixed text-on-primary-fixed px-4 py-1.5 rounded-full text-xs font-semibold font-label uppercase tracking-wider">
            Seeker
          </span>
        </div>

        {/* Info Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-ambient mb-6">
          <h2 className="text-lg font-headline font-semibold text-on-surface mb-4">
            Account Details
          </h2>
          <div className="space-y-4">
            {/* Full Name */}
            <div className="flex items-center justify-between text-sm font-body">
              <span className="text-on-surface-variant">Full Name</span>
              {loading ? (
                <span className="h-4 w-28 bg-surface-container animate-pulse rounded-md" />
              ) : (
                <span className="font-medium text-on-surface">
                  {profile?.fullName || "—"}
                </span>
              )}
            </div>
            <div className="h-px bg-outline-variant/20" />
            {/* Email Address */}
            <div className="flex items-center justify-between text-sm font-body">
              <span className="text-on-surface-variant">Email Address</span>
              {loading ? (
                <span className="h-4 w-36 bg-surface-container animate-pulse rounded-md" />
              ) : (
                <span className="font-medium text-on-surface">
                  {profile?.email || "—"}
                </span>
              )}
            </div>
            <div className="h-px bg-outline-variant/20" />
            {/* Phone Number */}
            <div className="flex items-center justify-between text-sm font-body">
              <span className="text-on-surface-variant">Phone Number</span>
              {loading ? (
                <span className="h-4 w-24 bg-surface-container animate-pulse rounded-md" />
              ) : profile?.phone ? (
                <span className="font-medium text-on-surface">{profile.phone}</span>
              ) : (
                <span className="text-on-surface-variant/50 italic text-xs">Not added</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button className="w-full bg-surface-container-lowest border border-outline-variant/15 text-on-surface py-3.5 rounded-xl text-sm font-semibold font-body hover:bg-surface-container-low transition-colors cursor-pointer flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit Preferences
          </button>
          <button
            onClick={handleLogout}
            className="w-full bg-error-container/20 text-error py-3.5 rounded-xl text-sm font-semibold font-body hover:bg-error-container/30 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign Out
          </button>
        </div>
      </main>

      <BottomNav activeTab="Profile" />
    </div>
  );
}
