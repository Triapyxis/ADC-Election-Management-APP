import { createBrowserClient } from "@supabase/ssr";
/** Anon, public. Used ONLY to receive the data-free "changed" broadcast. */
export const browserClient = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
