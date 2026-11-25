"use client";

import Link from "next/link";
import Image from "next/image";

export interface Booking {
  id: string;
  propertyName: string;
  propertyImage: string;
  location?: string;
  visitDate: string;
  visitTime: string;
  status: "Confirmed" | "Pending" | "Cancelled" | "Locked";
  eta?: string; // e.g. "1 Hour"
}

function BookingStatusBadge({ status, eta }: { status: string; eta?: string }) {
  let bg = "bg-surface-container-high/90 text-on-surface";
  let icon = "info";
  let displayStatus = status;

  if (status === "Confirmed") {
    bg = "bg-green-600/90 dark:bg-green-500/90 text-white backdrop-blur-sm shadow-sm";
    icon = "check_circle";
    if (eta) {
      displayStatus = `Confirmed - ETA: ${eta}`;
      icon = "directions_car"; // Show car for ETA
    }
  } else if (status === "Pending") {
    bg = "bg-orange-500/90 text-white backdrop-blur-sm shadow-sm";
    icon = "hourglass_top";
    displayStatus = "Pending Owner Approval";
  } else if (status === "Cancelled") {
    bg = "bg-red-500/90 text-white backdrop-blur-sm shadow-sm";
    icon = "cancel";
  } else if (status === "Locked") {
    bg = "bg-indigo-600/90 text-white backdrop-blur-sm shadow-sm";
    icon = "lock";
    displayStatus = "Locked & Secured";
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label font-bold ${bg}`}>
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {displayStatus}
    </div>
  );
}

export default function MyBookingsList({ bookings }: { bookings: Booking[] }) {
  if (!bookings || bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-surface-container-low rounded-3xl border border-outline-variant/30 shadow-sm mt-8">
        <span className="material-symbols-outlined text-[48px] text-outline mb-4">event_busy</span>
        <h3 className="text-xl font-headline font-bold text-on-surface mb-2">No Bookings Found</h3>
        <p className="text-on-surface-variant font-body mb-6 max-w-sm">You haven&apos;t scheduled any property visits yet.</p>
        <Link href="/dashboard/seeker" className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-headline font-semibold hover:bg-primary/90 transition-colors">
          Explore Rooms
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {bookings.map((booking) => (
        <Link href={`/booking/${booking.id}`} key={booking.id} className="group relative block rounded-3xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/50 transition-all duration-300 shadow-ambient hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:-translate-y-1">
          {/* Image Header */}
          <div className="relative h-48 w-full bg-surface-container-highest">
            <Image 
              src={booking.propertyImage} 
              alt={booking.propertyName} 
              fill 
              unoptimized
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {/* Status Badge Overlaid */}
            <div className="absolute top-4 left-4">
              <BookingStatusBadge status={booking.status} eta={booking.eta} />
            </div>
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90" />
            
            {/* Property Title */}
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-2xl font-headline font-bold text-white drop-shadow-md truncate">
                {booking.propertyName}
              </h3>
              {booking.location && (
                <p className="flex items-center gap-1 text-white/90 text-sm font-body truncate mt-1">
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  {booking.location}
                </p>
              )}
            </div>
          </div>

          {/* Card Body */}
          <div className="p-5">
            <div className="flex items-center gap-3 text-on-surface mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-indigo-400">
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
              </div>
              <div>
                <p className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Visit Date</p>
                <p className="font-body font-semibold">{booking.visitDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-on-surface">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 dark:bg-tertiary/20 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
              </div>
              <div>
                <p className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Time</p>
                <p className="font-body font-semibold">{booking.visitTime}</p>
              </div>
            </div>
            
            {/* Action Bar (Conceptual) */}
            <div className="mt-5 pt-4 border-t border-outline-variant/30 flex items-center justify-between">
              <span className="text-sm font-body font-medium text-primary dark:text-indigo-400 group-hover:underline">
                View Details
              </span>
              <span className="material-symbols-outlined text-primary dark:text-indigo-400 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                arrow_forward
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
