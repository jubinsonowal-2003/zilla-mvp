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
      if (!ownerUserId) return false; // Strictly require an authenticated owner
      return b.rooms.user_id === ownerUserId;
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
  status: "pending" | "confirmed" | "declined" | "completed" | "visit_scheduled",
  visitDate?: string
) {
  try {
    const supabase = getServerClient();
    // Map application status to database booking_status enum ('pending' | 'completed' | 'expired' | 'visit_scheduled')
    const dbStatus =
      status === "confirmed" || status === "completed"
        ? "completed"
        : status === "declined"
        ? "expired"
        : status === "visit_scheduled"
        ? "visit_scheduled"
        : "pending";

    const payload: any = { status: dbStatus };
    if (status === "visit_scheduled" && visitDate) {
      payload.visit_date = visitDate;
      payload.status = "visit_scheduled";
      payload.visit_time = new Date(visitDate).toISOString();
    }

    const { error } = await supabase
      .from("bookings")
      .update(payload)
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

/**
 * getSeekerBookings — fetches visit requests for seeker dashboard bypassing RLS
 */
export async function getSeekerBookings(seekerProfileId: string) {
  try {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        status,
        visit_time,
        priority_date_1,
        rooms (
          title,
          image_url,
          image_urls,
          location
        )
      `)
      .eq("seeker_id", seekerProfileId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getSeekerBookings] Error fetching bookings:", error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error("[getSeekerBookings] Exception:", err);
    return { success: false, error: err?.message || "Failed to fetch bookings", data: [] };
  }
}

/**
 * getBookingDetails — fetches a single booking by ID bypassing RLS
 */
export async function getBookingDetails(bookingId: string) {
  try {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        status,
        secure_code,
        visit_time,
        priority_date_1,
        priority_date_2,
        rooms (
          title,
          location,
          user_id
        )
      `)
      .eq("id", bookingId)
      .single();

    if (error) {
      console.error("[getBookingDetails] Error:", error);
      return { success: false, error: error.message, data: null };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("[getBookingDetails] Exception:", err);
    return { success: false, error: err?.message || "Failed to fetch booking", data: null };
  }
}

/**
 * trackWhatsAppClick — tracks that a user clicked the WhatsApp button
 */
export async function trackWhatsAppClick(bookingId: string) {
  try {
    const supabase = getServerClient();
    const { error } = await supabase
      .from("bookings")
      .update({ whatsapp_contacted: true } as any)
      .eq("id", bookingId);

    if (error) {
      console.error("[trackWhatsAppClick] Error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("[trackWhatsAppClick] Exception:", err);
    return { success: false, error: err?.message || "Failed to track WhatsApp click" };
  }
}


export async function verifyGoldenKey(code: string, ownerId: string) {
  try {
    const supabase = getServerClient();
    if (!ownerId) return { success: false, error: "Unauthorized" };

    console.log(`[verifyGoldenKey] Attempting verification for code: ${code}, ownerId: ${ownerId}`);

    // Try finding the booking matching the owner and code
    // Removed status filter entirely to prevent enum mismatch crash before we can update it
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, room_id, status, secure_code, rooms!inner(user_id)")
      .eq("rooms.user_id", ownerId)
      .eq("secure_code", parseInt(code, 10)) // Try as number first if it's an int column
      .maybeSingle();

    let finalBooking = bookings;

    // Fallback if the column is actually a string type
    if (!finalBooking) {
      const { data: stringBookings, error: stringError } = await supabase
        .from("bookings")
        .select("id, room_id, status, secure_code, rooms!inner(user_id)")
        .eq("rooms.user_id", ownerId)
        .eq("secure_code", code) // Try as string
        .maybeSingle();
        
      finalBooking = stringBookings;
      if (stringError) console.error("[verifyGoldenKey] String query error:", stringError);
    }

    if (!finalBooking) {
      console.log(`[verifyGoldenKey] No matching booking found. Checked int/string types for code ${code} and owner ${ownerId}`);
      if (error) console.error("[verifyGoldenKey] Int query error:", error);
      return { success: false, error: "Invalid code, please try again." };
    }

    // Update status to locked_awaiting_docs
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "locked_awaiting_docs" } as any)
      .eq("id", finalBooking.id);

    if (updateError) {
      console.error("[verifyGoldenKey] Update Error:", updateError);
      
      // Check for Postgres enum error (22P02: invalid input value for enum)
      if (updateError.code === "22P02" || updateError.message.includes("enum")) {
        return { 
          success: false, 
          error: "Database requires an update to support the new status. Please run the SQL migration provided."
        };
      }
      return { success: false, error: "Failed to lock the room." };
    }

    // Perform the rest of the atomic transaction: Deactivate property & Cancel other requests
    if (finalBooking.room_id) {
      // Deactivate the room so it vanishes from the platform
      await supabase.from("rooms").update({ status: "inactive" }).eq("id", finalBooking.room_id);
      
      // Cancel all other pending/scheduled requests for this room
      await supabase
        .from("bookings")
        .update({ status: "expired" } as any)
        .eq("room_id", finalBooking.room_id)
        .neq("id", finalBooking.id)
        .in("status", ["pending", "visit_scheduled"]);
    }

    console.log(`[verifyGoldenKey] Successfully verified and locked booking ${finalBooking.id}`);
    return { success: true };
  } catch (err: any) {
    console.error("[verifyGoldenKey] Exception:", err);
    return { success: false, error: "Invalid code, please try again." };
  }
}
