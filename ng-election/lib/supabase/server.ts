import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
/** Anon client: relies on RLS and public views only. Never use the service role in pages. */
export const db = () => {
  const { url, anonKey } = publicEnv();
  return createClient(url, anonKey, { auth: { persistSession: false } });
};
