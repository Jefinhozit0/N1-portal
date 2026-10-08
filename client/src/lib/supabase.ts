import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.");
}

/**
 * Client-side Supabase client.
 * Uses the anon key and respects Row Level Security policies.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
