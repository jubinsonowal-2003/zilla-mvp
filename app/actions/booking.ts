"use server";

import { createClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingResult {
  success: true;
  bookingId: string;
  secureCode: string;
}

export interface BookingError {
  success: false;
  error: string;
}

export type CreateBookingResponse = BookingResult | BookingError;

// ─── Supabase server client ────────────────────────────────────────────────────
// We use the service-role key (server-only) so the insertion bypasses RLS.
// Falls back to the anon key if the service key is not configured yet.

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase environment variables are not configured. " +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      // Disable auto session persistence — this is a server-only client
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ─── Helper: generate a random 4-digit string ─────────────────────────────────

function generateSecureCode(): string {
  // Math.random produces [0, 1). Multiply by 9000 and add 1000 to get [1000, 9999].
  const code = Math.floor(1000 + Math.random() * 9000);
  return String(code);
}

// ─── Main Server Action ───────────────────────────────────────────────────────

/**
 * createBooking — inserts a new booking row into the `bookings` table.
 *
 * @param data.roomId      - UUID of the room being booked.
 * @param data.seekerId    - The authenticated user's ID (stored in localStorage
 *                           as `zilla_session_id`).
 * @param data.isPremium   - `true` = paid token booking; `false` = free visit.
 * @param data.tenantName  - Full name of the seeker.
 * @param data.tenantPhone - Contact phone number of the seeker.
 * @param data.tenantEmail - Contact email address of the seeker.
 * @param data.date1       - ISO string for the first priority visit date.
 * @param data.date2       - ISO string for the second (backup) priority visit date.
 *
 * @returns `{ success: true, bookingId, secureCode }` on success,
 *          or `{ success: false, error }` on any failure.
 */
export async function createBooking(data: {
  roomId: string;
  seekerId: string;
  isPremium: boolean;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  date1: string;
  date2: string;
}): Promise<CreateBookingResponse> {
  const { roomId, seekerId, isPremium, tenantName, tenantPhone, tenantEmail, date1, date2 } = data;
  // ── 1. Validate inputs ──────────────────────────────────────────────────────
  if (!roomId?.trim()) {
    return { success: false, error: "Invalid room ID." };
  }

  if (!seekerId?.trim()) {
    return {
      success: false,
      error: "You must be logged in to book a visit. Please sign in.",
    };
  }

  // ── 2. Generate 4-digit secure code ────────────────────────────────────────
  const secureCode = generateSecureCode();

  // ── 3. Calculate visit_time = now + 24 hours ────────────────────────────────
  const visitTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // ── 4. Insert booking row into Supabase ─────────────────────────────────────
  const supabase = getServerClient();

  // DEBUG: log exact payload before hitting Supabase
  console.log("[createBooking] Attempting insert with payload:", {
    room_id: roomId,
    seeker_id: seekerId,
    status: "pending",
    secure_code: secureCode,
    visit_time: visitTime,
    is_premium: isPremium,
    tenant_name: tenantName,
    tenant_phone: tenantPhone,
    tenant_email: tenantEmail,
    priority_date_1: date1,
    priority_date_2: date2,
  });

  const { data: insertData, error } = await supabase
    .from("bookings")
    .insert({
      room_id: roomId,
      seeker_id: seekerId,
      status: "pending",
      secure_code: secureCode,
      visit_time: visitTime,
      is_premium: isPremium,
      tenant_name: tenantName,
      tenant_phone: tenantPhone,
      tenant_email: tenantEmail,
      priority_date_1: date1,
      priority_date_2: date2,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createBooking] Supabase insert FAILED:");
    console.error("  → code   :", error.code);
    console.error("  → message:", error.message);
    console.error("  → details:", error.details);
    console.error("  → hint   :", error.hint);
    console.error("  → full   :", JSON.stringify(error, null, 2));
    return {
      success: false,
      error: error.message ?? "Something went wrong while creating your booking. Please try again.",
    };
  }

  if (!insertData?.id) {
    return {
      success: false,
      error: "Booking was created but no ID was returned. Please contact support.",
    };
  }

  console.log(
    `[createBooking] Booking created => id=${insertData.id} | room=${roomId} | seeker=${seekerId} | premium=${isPremium} | code=${secureCode} | tenant=${tenantName}`
  );

  // ── 5. Return success payload ────────────────────────────────────────────────
  return {
    success: true,
    bookingId: insertData.id as string,
    secureCode,
  };
}
