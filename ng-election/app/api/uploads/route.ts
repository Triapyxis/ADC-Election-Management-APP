import { NextResponse } from "next/server";
import { userClient, serviceClient } from "@/lib/supabase/user";
import { validateUpload, safeName, isOwnPath, ALLOWED, BUCKET, MAX_BYTES, MAX_DOCS } from "@/lib/upload";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Step 1: ask for a one-time signed upload URL. The server picks the path; the client cannot choose where a file goes. */
export async function POST(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { submissionId?: string; filename?: string; contentType?: string; size?: number }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!UUID.test(b.submissionId ?? "")) return json({ error: "submissionId required." }, 422);
  const issues = validateUpload(b); if (issues.length) return json({ error: "Validation failed.", issues }, 422);
  const { data: sub } = await sb.from("result_submissions").select("id").eq("id", b.submissionId!).eq("submitted_by", user.id).maybeSingle();   // RLS + ownership
  if (!sub) return json({ error: "Not your submission." }, 403);
  const { count } = await sb.from("submission_documents").select("id", { count: "exact", head: true }).eq("submission_id", b.submissionId!);
  if ((count ?? 0) >= MAX_DOCS) return json({ error: `At most ${MAX_DOCS} files per submission.` }, 409);
  const path = `${user.id}/${b.submissionId}/${crypto.randomUUID()}-${safeName(b.filename ?? "", b.contentType!)}`;
  const { data, error } = await serviceClient().storage.from(BUCKET).createSignedUploadUrl(path);
  return error || !data ? json({ error: "Could not prepare the upload." }, 500) : json({ path, token: data.token }, 201);
}

/** Step 2: after the browser uploaded, register the file. Size and type are read from STORAGE, not from the client. */
export async function PUT(req: Request) {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  let b: { submissionId?: string; path?: string }; try { b = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!UUID.test(b.submissionId ?? "") || !b.path || !isOwnPath(b.path, user.id, b.submissionId!)) return json({ error: "Invalid upload path." }, 422);
  const svc = serviceClient(), folder = `${user.id}/${b.submissionId}`, file = b.path.slice(folder.length + 1);
  const { data: listed } = await svc.storage.from(BUCKET).list(folder, { search: file, limit: 5 });
  const obj = listed?.find((o) => o.name === file); const size = Number((obj?.metadata as any)?.size), type = String((obj?.metadata as any)?.mimetype ?? "");
  if (!obj) return json({ error: "File not found. Upload it first." }, 404);
  if (!(type in ALLOWED) || !(size > 0 && size <= MAX_BYTES)) { await svc.storage.from(BUCKET).remove([b.path]); return json({ error: "File rejected (type or size). It has been removed." }, 422); }
  const { error } = await sb.from("submission_documents").insert({ submission_id: b.submissionId, storage_path: b.path, content_type: type, size_bytes: size, uploaded_by: user.id });
  return error ? json({ error: "Could not register the file." }, 403) : json({ ok: true }, 201);
}
