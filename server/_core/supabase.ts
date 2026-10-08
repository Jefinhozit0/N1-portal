import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SECRET_KEY ?? "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("[Supabase] SUPABASE_URL or SUPABASE_SECRET_KEY is not set.");
}

/**
 * Server-side Supabase client using the secret key.
 * This client bypasses Row Level Security and should ONLY be used server-side.
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
