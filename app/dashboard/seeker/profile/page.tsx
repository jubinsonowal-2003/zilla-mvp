"use client";

import { useEffect, useState } from "react";
import TopAppBar from "../../../components/TopAppBar";
import BottomNav from "../../../components/BottomNav";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCWBNlcG9YcIUJqpqMBSxtbZUYqdg0VgM-QcbmI8Vdk5aSiXa7ZUnC_tQ_wVzyydo_HPBEUT-fgARlpVkCrsk_htxt39xXAYiFu3glIFSfs5h2ESQWuwTw6bpfE6MQddAuw5gCkyMN6gSl76uAGZFD_fGVYhwVqSbzpcZU-cksc0Sn_xBKIV_mPyBUEcGrxXWznDvHdtH0ZQMevd6cTA_JrfOtQz07qJF5edYlbe3o3EsVofIofZpQXpIdthVdr7OwH99zVazJ02wQ";

export default function SeekerProfilePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(localStorage.getItem("zilla_session_id"));
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
            <div className="flex items-center justify-between text-sm font-body">
              <span className="text-on-surface-variant">Session ID</span>
              <span className="font-mono text-xs text-on-surface bg-surface-container px-3 py-1.5 rounded-lg truncate max-w-[200px]">
                {sessionId ? sessionId.slice(0, 12) + "…" : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm font-body">
              <span className="text-on-surface-variant">Role</span>
              <span className="font-medium text-on-surface">Room Seeker</span>
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
