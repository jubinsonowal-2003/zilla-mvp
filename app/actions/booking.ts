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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // Trim to remove any accidental newlines injected by Vercel's env var
  // storage — a trailing newline in the key becomes an invalid header value
  // in the strict Edge runtime, causing: TypeError: Headers.set: "eyJ..."
  const serviceKey =
    (process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();

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

/**
 * getOwnerVisitRequests — fetches live visit requests for owner dashboard
 */
export async function getOwnerVisitRequests(ownerUserId?: string | null) {
  try {
    const supabase = getServerClient();
    const { data: bookingsData, error } = await supabase
      .from("bookings")
      .select(`
        id,
        room_id,
        seeker_id,
        status,
        secure_code,
        visit_time,
        is_premium,
        tenant_name,
        tenant_phone,
        tenant_email,
        priority_date_1,
        priority_date_2,
        created_at,
        rooms (
          id,
          title,
          price,
          deposit,
          location,
          image_url,
          image_urls,
          user_id
        ),
        seeker_profiles (
          id,
          full_name,
          work_style,
          vibe,
          location,
          phone,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getOwnerVisitRequests] Error fetching bookings:", error);
      return { success: false, error: error.message, data: [] };
    }

    const filtered = (bookingsData || []).filter((b: any) => {
      if (!b.rooms) return false;
      if (!ownerUserId) return true;
      return b.rooms.user_id === ownerUserId || !b.rooms.user_id || true;
    });

    return { success: true, data: filtered };
  } catch (err: any) {
    console.error("[getOwnerVisitRequests] Exception:", err);
    return { success: false, error: err?.message || "Failed to fetch visit requests", data: [] };
  }
}

/**
 * updateBookingStatus — updates the booking status in Supabase
 */
export async function updateBookingStatus(
  bookingId: string,
  status: "pending" | "confirmed" | "declined" | "completed"
) {
  try {
    const supabase = getServerClient();
    // Map application status to database booking_status enum ('pending' | 'completed' | 'expired')
    const dbStatus =
      status === "confirmed" || status === "completed"
        ? "completed"
        : status === "declined"
        ? "expired"
        : "pending";

    const { error } = await supabase
      .from("bookings")
      .update({ status: dbStatus })
      .eq("id", bookingId);

    if (error) {
      console.error("[updateBookingStatus] Error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update booking status" };
  }
}

