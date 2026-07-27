"use client";

import TopAppBar from "../../../components/TopAppBar";
import BottomNav from "../../../components/BottomNav";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCWBNlcG9YcIUJqpqMBSxtbZUYqdg0VgM-QcbmI8Vdk5aSiXa7ZUnC_tQ_wVzyydo_HPBEUT-fgARlpVkCrsk_htxt39xXAYiFu3glIFSfs5h2ESQWuwTw6bpfE6MQddAuw5gCkyMN6gSl76uAGZFD_fGVYhwVqSbzpcZU-cksc0Sn_xBKIV_mPyBUEcGrxXWznDvHdtH0ZQMevd6cTA_JrfOtQz07qJF5edYlbe3o3EsVofIofZpQXpIdthVdr7OwH99zVazJ02wQ";

export default function SavedPage() {
  return (
    <div className="bg-surface text-on-surface font-body min-h-dvh pb-32 md:pb-8">
      <TopAppBar avatarUrl={AVATAR_URL} label="Saved Rooms" />

      <main className="pt-28 px-4 max-w-3xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-primary-container/15 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-5xl text-primary">
              bookmark
            </span>
          </div>
          <h1 className="text-2xl font-headline font-semibold text-on-surface mb-3">
            Saved Rooms
          </h1>
          <p className="text-on-surface-variant font-body text-sm max-w-sm leading-relaxed">
            Rooms you save will appear here. Browse listings and tap the
            bookmark icon to save your favourites.
          </p>
          <button
            onClick={() => (window.location.href = "/dashboard/seeker")}
            className="mt-8 bg-gradient-to-br from-primary to-primary-container text-white px-6 py-3 rounded-xl text-sm font-semibold font-body hover:scale-105 transition-transform duration-200 cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            Explore Rooms
          </button>
        </div>
      </main>

      <BottomNav activeTab="Saved" />
    </div>
  );
}
