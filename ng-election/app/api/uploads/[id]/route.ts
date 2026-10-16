import { NextResponse } from "next/server";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { BUCKET } from "@/lib/upload";
/** View a result sheet. Access is decided by RLS on submission_documents (uploader or staff in scope); the link is short-lived. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data: d } = await sb.from("submission_documents").select("storage_path").eq("id", id).maybeSingle();
  if (!d) return NextResponse.json({ error: "Not found." }, { status: 404 });          // no access looks the same as missing
  const { data } = await serviceClient().storage.from(BUCKET).createSignedUrl(d.storage_path, 60);
  return data ? NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Not available." }, { status: 500 });
}
