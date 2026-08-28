import { createClient } from "@supabase/supabase-js";

// Trim both values: Vercel can inject a trailing newline into env vars,
// which causes them to become invalid HTTP header values in the Edge runtime.
const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()      ?? '';
const supabaseAnonKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

// ── DEBUG: log resolved values at module-init time ──────────────────────────
// Remove once signup is confirmed working.
console.log(
  '[supabase.ts] Resolved env vars →',
  'URL:', supabaseUrl   ? `${supabaseUrl.slice(0, 30)}…` : '⚠️  EMPTY',
  '| ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.slice(0, 20)}…` : '⚠️  EMPTY',
);

// ── Hard guard: fail loudly instead of creating a broken client ─────────────
// If either value is empty the client will silently fail every auth call.
// Throwing here surfaces the misconfiguration immediately in the console.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[supabase.ts] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
    'Check your .env.local file and restart the dev server (npm run dev).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

