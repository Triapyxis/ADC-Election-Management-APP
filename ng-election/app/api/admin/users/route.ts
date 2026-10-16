import { NextResponse } from "next/server";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { validateNewUser, validateRoleGrant, genTempPassword } from "@/lib/users";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f-]{36}$/i;

async function superAdmin() {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser(); if (!user) return null;
  const { data } = await sb.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
  return data ? { sb, user } : null;
}

/** Create a login and give it a first role. Super administrators only. The user must change the temporary password at first sign-in. */
export async function POST(req: Request) {
  const a = await superAdmin(); if (!a) return json({ error: "Only a super administrator can create users." }, 403);
  let b: { email?: string; password?: string; role?: string; stateId?: string | null; lgaId?: string | null }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const issues = validateNewUser(b); if (issues.length) return json({ error: "Validation failed.", issues }, 422);
  const generated = !b.password; const password = b.password || genTempPassword(); const svc = serviceClient();
  const { data, error } = await svc.auth.admin.createUser({ email: b.email!.trim(), password, email_confirm: true, user_metadata: { must_change_password: true } });
  if (error || !data.user) return json({ error: error?.message?.includes("already") ? "A user with that email already exists." : "Could not create the user." }, error?.message?.includes("already") ? 409 : 500);
  const { error: re } = await a.sb.from("user_roles").insert({ user_id: data.user.id, role: b.role, state_id: b.stateId || null, lga_id: b.lgaId || null, granted_by: a.user.id });
  if (re) { await svc.auth.admin.deleteUser(data.user.id); return json({ error: "Could not assign the role, so the user was not created." }, 500); }   // no orphan accounts
  return json({ id: data.user.id, tempPassword: generated ? password : undefined }, 201);
}

/** grant / revoke / disable / enable / reset_password. Super administrators cannot lock themselves out. */
export async function PATCH(req: Request) {
  const a = await superAdmin(); if (!a) return json({ error: "Only a super administrator can manage users." }, 403);
  let b: { userId?: string; action?: string; role?: string; stateId?: string | null; lgaId?: string | null }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!b.userId || !UUID.test(b.userId)) return json({ error: "userId required." }, 422);
  const self = b.userId === a.user.id, svc = serviceClient();
  switch (b.action) {
    case "grant": {
      const issues = validateRoleGrant(b); if (issues.length) return json({ error: "Validation failed.", issues }, 422);
      const { error } = await a.sb.from("user_roles").upsert({ user_id: b.userId, role: b.role, state_id: b.stateId || null, lga_id: b.lgaId || null, granted_by: a.user.id }, { onConflict: "user_id,role" });
      return error ? json({ error: "Could not grant the role." }, 500) : json({ ok: true });
    }
    case "revoke": {
      if (self && b.role === "super_admin") return json({ error: "You cannot remove your own super administrator role." }, 409);
      const { error } = await a.sb.from("user_roles").delete().eq("user_id", b.userId).eq("role", b.role ?? "");
      return error ? json({ error: "Could not remove the role." }, 500) : json({ ok: true });
    }
    case "disable": case "enable": {
      if (self) return json({ error: "You cannot disable your own account." }, 409);
      const { error } = await svc.auth.admin.updateUserById(b.userId, { ban_duration: b.action === "disable" ? "876000h" : "none" });
      return error ? json({ error: "Could not change the account status." }, 500) : json({ ok: true });
    }
    case "reset_password": {
      const pw = genTempPassword(); const { error } = await svc.auth.admin.updateUserById(b.userId, { password: pw, user_metadata: { must_change_password: true } });
      return error ? json({ error: "Could not reset the password." }, 500) : json({ ok: true, tempPassword: pw });
    }
    default: return json({ error: "Unknown action." }, 422);
  }
}
