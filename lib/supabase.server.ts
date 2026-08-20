/**
 * supabase.server.ts
 *
 * Server-only Supabase client that uses the Service Role key.
 * This client bypasses Row-Level Security and must ONLY be imported
 * from Server Actions or Route Handlers — never from client components.
 *
 * The Service Role key is stored in SUPABASE_SERVICE_ROLE_KEY which is
 * intentionally NOT prefixed with NEXT_PUBLIC_, so it is never exposed
 * to the browser bundle.
 */

import { createClient } from "@supabase/supabase-js";

// Trim both values: Vercel can inject a trailing newline into env vars,
// which makes them invalid HTTP header values in the strict Edge runtime.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "[supabase.server] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    // The service-role client is stateless — it should never persist sessions.
    persistSession: false,
    autoRefreshToken: false,
  },
});
