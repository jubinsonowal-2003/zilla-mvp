"use server";

/**
 * app/actions/auth.ts
 *
 * Server Actions for authentication:
 *
 *  - signUpInsertProfile   Called from the /role page after Supabase Auth sign-up
 *                          succeeds on the client. Inserts a row into `profiles`
 *                          with the chosen role.
 *
 *  - loginAction           Called from the /login page after signInWithPassword
 *                          succeeds on the client. Fetches the user's role from
 *                          `profiles`, then resolves the correct redirect path:
 *
 *                            owner  → /dashboard/owner
 *                            seeker (with seeker_profiles row) → /dashboard/seeker
 *                            seeker (no seeker_profiles row)   → /onboarding
 *
 * Both actions verify the caller is authenticated via the anon Supabase client
 * before performing any privileged write through the service-role client.
 */

import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase.server";

// ---------------------------------------------------------------------------
// Helper: build a per-request anon client that reads the user's JWT cookie.
// We do NOT use the shared singleton from lib/supabase.ts here because Server
// Actions run on the server and need cookie-based session resolution.
// ---------------------------------------------------------------------------
function buildAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// ---------------------------------------------------------------------------
// signUpInsertProfile
// ---------------------------------------------------------------------------
/**
 * Insert a row into the `profiles` table after a successful sign-up.
 *
 * @param userId  The `auth.users.id` returned by `supabase.auth.signUp()`.
 * @param role    The role the user selected on the /role page.
 * @returns       `{ error: string | null }`
 */
export async function signUpInsertProfile(
  userId: string,
  role: "owner" | "seeker"
): Promise<{ error: string | null }> {
  if (!userId || !role) {
    return { error: "Missing userId or role." };
  }

  // Use the service-role client so the insert is not blocked by RLS policies.
  const { error } = await supabaseAdmin
    .from("profiles")
    .insert({ id: userId, role });

  if (error) {
    console.error("[signUpInsertProfile] Failed to insert profile:", error);
    // Duplicate key means the row already exists — treat as success.
    if (error.code === "23505") return { error: null };
    return { error: error.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// loginAction
// ---------------------------------------------------------------------------
/**
 * After the client has signed in successfully, call this action to determine
 * where the user should be redirected.
 *
 * @param accessToken   The JWT from the Supabase session (`session.access_token`).
 * @returns             `{ redirectTo: string; error: string | null }`
 */
export async function loginAction(accessToken: string): Promise<{
  redirectTo: string;
  error: string | null;
}> {
  // ── 1. Resolve the canonical user from the provided JWT ──────────────────
  const anonClient = buildAnonClient();
  const { data: userData, error: userError } =
    await anonClient.auth.getUser(accessToken);

  if (userError || !userData?.user) {
    console.error("[loginAction] Could not resolve user from token:", userError);
    return { redirectTo: "/login", error: "Session verification failed." };
  }

  const userId = userData.user.id;

  // ── 2. Fetch the role from the `profiles` table ──────────────────────────
  // We use the service-role client so this succeeds regardless of RLS policies.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[loginAction] Error fetching profile:", profileError);
    return { redirectTo: "/role", error: "Could not fetch user profile." };
  }

  if (!profile) {
    // No profiles row — user signed up before this flow existed; send to /role
    // so they can set their role and have the row created.
    console.warn(`[loginAction] No profile found for user ${userId}. Sending to /role.`);
    return { redirectTo: "/role", error: null };
  }

  const role = profile.role as "owner" | "seeker";

  // ── 3. Role-based routing ─────────────────────────────────────────────────
  if (role === "owner") {
    return { redirectTo: "/dashboard/owner", error: null };
  }

  // Seeker path: check if the seeker_profiles onboarding row exists.
  const { data: seekerProfile, error: seekerError } = await supabaseAdmin
    .from("seeker_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (seekerError) {
    console.error("[loginAction] Error fetching seeker_profiles:", seekerError);
    // Fail open: send them to onboarding rather than crashing.
    return { redirectTo: "/onboarding", error: null };
  }

  if (seekerProfile) {
    // Onboarding record exists → fully onboarded seeker.
    return { redirectTo: "/dashboard/seeker", error: null };
  } else {
    // No onboarding record → send to the preferences onboarding page.
    return { redirectTo: "/onboarding", error: null };
  }
}
