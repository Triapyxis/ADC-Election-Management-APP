const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing environment variable: ${k}`);
  return v;
};
export const publicEnv = () => ({
  url: need("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: need("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
});
/** Server-only. Never import from a Client Component. */
export const serviceRoleKey = () => need("SUPABASE_SERVICE_ROLE_KEY");
