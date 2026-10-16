"use server";
import { redirect } from "next/navigation";
import { userClient } from "@/lib/supabase/user";

export async function signIn(_prev: { error?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "").trim(), password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const { error } = await (await userClient()).auth.signInWithPassword({ email, password });
  if (error) return { error: "Email or password is incorrect." };   // same message for every failure: no account probing
  const next = String(form.get("next") ?? "/account"); redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
}
