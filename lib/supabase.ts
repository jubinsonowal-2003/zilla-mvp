import { createClient } from "@supabase/supabase-js";

// Trim both values: Vercel can inject a trailing newline into env vars,
// which causes them to become invalid HTTP header values in the Edge runtime.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

