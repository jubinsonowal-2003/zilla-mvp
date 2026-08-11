"use client";

import Image from "next/image";

export interface Room {
  id: string;
  title: string;
  price: number;
  location: string;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  status?: string;
  security_deposit?: number;
}

interface RoomCardProps {
  room: Room;
  index?: number;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent, roomId: string) => void;
  onView: (room: Room) => void;
}

export default function RoomCard({
  room,
  index = 0,
  isSaved = false,
  onToggleSave,
  onView,
}: RoomCardProps) {
  return (
    <div
      className="bg-surface-container-lowest rounded-2xl overflow-hidden flex flex-col shadow-[0_10px_30px_rgba(70,72,212,0.03)] hover:shadow-ambient hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
      onClick={() => onView(room)}
    >
      {/* ── Image Area ── */}
      <div className="relative h-52 w-full overflow-hidden p-2">
        {room.image_url ? (
          <Image
            alt={room.title}
            src={room.image_url}
            fill
            className="object-cover rounded-xl group-hover:scale-105 transition-transform duration-700 ease-out"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={index === 0}
          />
        ) : (
          <div className="w-full h-full rounded-xl bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-outline/40">
              image
            </span>
          </div>
        )}

        {/* Available badge */}
        <div className="absolute top-4 right-4 bg-surface-container-lowest/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary flex items-center gap-1 shadow-sm z-10">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Available
        </div>

        {/* Bookmark button */}
        {onToggleSave && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(e, room.id);
            }}
            aria-label={isSaved ? "Remove from saved" : "Save listing"}
            className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm flex items-center justify-center shadow-sm transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-[18px] transition-colors duration-200 ${
                isSaved ? "text-primary" : "text-outline"
              }`}
              style={
                isSaved
                  ? { fontVariationSettings: "'FILL' 1" }
                  : { fontVariationSettings: "'FILL' 0" }
              }
            >
              bookmark
            </span>
          </button>
        )}
      </div>

      {/* ── Card Body ── */}
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-lg font-headline font-semibold text-on-surface mb-1 line-clamp-1">
          {room.title}
        </h3>
        <p className="text-sm text-on-surface-variant flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-[16px] text-outline">
            location_on
          </span>
          {room.location}
        </p>

        {room.description && (
          <p className="text-xs text-on-surface-variant line-clamp-2 mb-4">
            {room.description}
          </p>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-surface-container/50">
          <div className="font-headline font-bold text-lg text-primary">
            ₹{room.price?.toLocaleString("en-IN")}
            <span className="text-xs text-on-surface-variant font-body font-normal">
              /mo
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(room);
            }}
            className="bg-gradient-to-br from-primary to-primary-container text-white px-4 py-2 rounded-[0.75rem] text-xs font-semibold font-body hover:scale-105 transition-transform duration-200 cursor-pointer flex items-center gap-1"
          >
            View
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
