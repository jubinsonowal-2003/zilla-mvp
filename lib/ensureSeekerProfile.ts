/**
 * ensureSeekerProfile
 *
 * Guarantees that a `seeker_profiles` row exists for the currently
 * authenticated user. If one doesn't exist yet it is created with
 * sensible defaults so that downstream FK constraints on `bookings`
 * are always satisfied before the user reaches any booking flow.
 *
 * Returns the profile's UUID (`seeker_profiles.id`) on success,
 * or `null` if the user isn't authenticated or the insert failed.
 */

import { supabase } from "@/lib/supabase";

export async function ensureSeekerProfile(opts?: {
  /** Override the display name stored in the profile. */
  fullName?: string;
}): Promise<string | null> {
  // 1. Get the canonical Supabase auth user — never trust localStorage alone.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn("[ensureSeekerProfile] No authenticated user found.");
    return null;
  }

  // 2. Check if a profile already exists for this user.
  const { data: existing } = await supabase
    .from("seeker_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.id) {
    // Profile already present — nothing to do.
    return existing.id as string;
  }

  // 3. No profile yet — derive the best display name we can.
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("zillaUser") ?? "{}");
    } catch {
      return {};
    }
  })();

  const fullName =
    opts?.fullName ||
    storedUser.fullName ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Anonymous";

  // 4. Insert a minimal placeholder row so the FK is satisfied.
  //    The user can fill in real values later through onboarding/preferences.
  console.log(
    `[ensureSeekerProfile] Creating placeholder profile for user ${user.id}`
  );

  const { data: created, error: insertError } = await supabase
    .from("seeker_profiles")
    .insert({
      user_id: user.id,
      full_name: fullName,
      email: user.email ?? "",
      budget_min: 0,
      budget_max: 100000,
      location: "",
      vibe: "",
      work_style: "",
    })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    console.error(
      "[ensureSeekerProfile] Failed to create profile:",
      insertError
    );
    return null;
  }

  console.log(
    `[ensureSeekerProfile] Profile created => id=${created.id}`
  );
  return created.id as string;
}
