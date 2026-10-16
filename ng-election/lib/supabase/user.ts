import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv, serviceRoleKey } from "@/lib/env";

/** Acts as the signed-in user, so Row Level Security applies. */
export async function userClient() {
  const jar = await cookies(); const { url, anonKey } = publicEnv();
  return createServerClient(url, anonKey, { cookies: { getAll: () => jar.getAll(), setAll: (all) => { try { all.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* read-only context */ } } } });
}
/** Server-only, bypasses RLS. Use ONLY for trusted writes after the user is authenticated. */
export const serviceClient = () => createClient(publicEnv().url, serviceRoleKey(), { auth: { persistSession: false } });
