"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import TopAppBar from "../../../components/TopAppBar";
import BottomNav from "../../../components/BottomNav";
import RoomCard, { Room } from "../../../components/RoomCard";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCWBNlcG9YcIUJqpqMBSxtbZUYqdg0VgM-QcbmI8Vdk5aSiXa7ZUnC_tQ_wVzyydo_HPBEUT-fgARlpVkCrsk_htxt39xXAYiFu3glIFSfs5h2ESQWuwTw6bpfE6MQddAuw5gCkyMN6gSl76uAGZFD_fGVYhwVqSbzpcZU-cksc0Sn_xBKIV_mPyBUEcGrxXWznDvHdtH0ZQMevd6cTA_JrfOtQz07qJF5edYlbe3o3EsVofIofZpQXpIdthVdr7OwH99zVazJ02wQ";

export default function SavedPage() {
  const router = useRouter();
  const [savedRooms, setSavedRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedRoomIds, setSavedRoomIds] = useState<Set<string>>(new Set());
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  useEffect(() => {
    async function fetchSavedRooms() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("saved_rooms")
        .select(
          `
          id,
          rooms ( * )
        `
        )
        .eq("seeker_id", user.id);

      if (error) {
        console.error("Error fetching saved rooms:", error);
      } else if (data) {
        const extractedRooms = data
          .map((item: any) => item.rooms as Room)
          .filter(Boolean);
        setSavedRooms(extractedRooms);
        setSavedRoomIds(new Set(extractedRooms.map((r) => r.id)));
      }

      setLoading(false);
    }

    fetchSavedRooms();
  }, []);

  /** Toggle bookmark — optimistic UI + Supabase sync */
  const toggleSave = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const isSaved = savedRoomIds.has(roomId);

    // Optimistic update
    setSavedRoomIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(roomId) : next.add(roomId);
      return next;
    });

    if (isSaved) {
      // Remove from saved list visually after unsaving
      const { error } = await supabase
        .from("saved_rooms")
        .delete()
        .eq("seeker_id", user.id)
        .eq("room_id", roomId);

      if (error) {
        console.error("Failed to unsave room:", error);
        setSavedRoomIds((prev) => new Set([...prev, roomId]));
      } else {
        // Remove from the displayed list
        setSavedRooms((prev) => prev.filter((r) => r.id !== roomId));
      }
    } else {
      const { error } = await supabase
        .from("saved_rooms")
        .insert([{ room_id: roomId, seeker_id: user.id }]);

      if (error) {
        console.error("Failed to save room:", error);
        setSavedRoomIds((prev) => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
      }
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-dvh pb-32 md:pb-8">
      <TopAppBar avatarUrl={AVATAR_URL} label="Saved Rooms" />

      <main className="pt-28 px-4 max-w-3xl mx-auto">
        {loading ? (
          /* ── Loading state ── */
          <div className="grid grid-cols-1 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-surface-container-lowest rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="h-52 bg-surface-container m-2 rounded-xl" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-surface-container rounded-lg w-3/4" />
                  <div className="h-4 bg-surface-container rounded-lg w-1/2" />
                  <div className="h-4 bg-surface-container rounded-lg w-full" />
                  <div className="h-4 bg-surface-container rounded-lg w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : savedRooms.length === 0 ? (
          /* ── Empty state ── */
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
              onClick={() => router.push("/dashboard/seeker")}
              className="mt-8 bg-gradient-to-br from-primary to-primary-container text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-transform duration-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                explore
              </span>
              Explore Rooms
            </button>
          </div>
        ) : (
          /* ── Saved rooms grid ── */
          <>
            <p className="text-sm text-on-surface-variant mb-6 font-label">
              {savedRooms.length} room{savedRooms.length !== 1 ? "s" : ""} saved
            </p>
            <div className="grid grid-cols-1 gap-6">
              {savedRooms.map((room, index) => (
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
          </>
        )}
      </main>

      {/* ═══════════ ROOM DETAIL MODAL ═══════════ */}
      {selectedRoom && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
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
              <span className="material-symbols-outlined text-[20px]">
                close
              </span>
            </button>

            {/* Room Image */}
            <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-t-3xl">
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
                  <span className="material-symbols-outlined text-6xl text-outline/30">
                    image
                  </span>
                </div>
              )}
              {/* Price badge on image */}
              <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
                <span className="font-headline font-bold text-xl text-primary">
                  ₹{selectedRoom.price?.toLocaleString("en-IN")}
                </span>
                <span className="text-xs text-on-surface-variant font-body">
                  /mo
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8">
              <h2 className="text-xl font-headline font-semibold text-on-surface mb-1">
                {selectedRoom.title}
              </h2>
              <p className="text-sm text-on-surface-variant flex items-center gap-1 mb-5">
                <span className="material-symbols-outlined text-[16px] text-outline">
                  location_on
                </span>
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

              {/* Status badge */}
              <div className="flex items-center gap-2 mb-6">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Available Now
                </span>
              </div>

              {/* CTA: Go to Explore to Book */}
              <button
                onClick={() => router.push("/dashboard/seeker")}
                className="w-full relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white font-headline font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer group"
              >
                {/* shimmer */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="material-symbols-outlined text-[20px]">
                  calendar_month
                </span>
                Reserve Free Visit Slot
                <span className="material-symbols-outlined text-[18px] opacity-80">
                  arrow_forward
                </span>
              </button>

              <p className="text-center text-xs text-on-surface-variant mt-3 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-emerald-500">
                  verified_user
                </span>
                No commitment · Visit first, decide later
              </p>
            </div>
          </div>
        </div>
      )}

      <BottomNav activeTab="Saved" />
    </div>
  );
}