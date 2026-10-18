import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/user";
import { parseBearer, hashKey } from "@/lib/stations";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const text = (v: unknown, max = 180) => typeof v === "string" ? v.trim().slice(0, max) : "";
const safeUrl = (v: unknown) => {
  if (typeof v !== "string") return "";
  try { const u = new URL(v); return ["https:", "http:"].includes(u.protocol) ? u.toString() : ""; } catch { return ""; }
};
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : "";
const asRows = (payload: any): any[] => Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.videos) ? payload.videos : Array.isArray(payload?.media) ? payload.media : [];

/**
 * Read-only media adapter. Configure SITUATION_ROOM_MEDIA_SOURCE_URL to point to the existing
 * media platform's API; its credentials remain server-side. The desktop station key never
 * reaches the upstream provider. The upstream response may be an array or {items|videos|media}.
 */
export async function GET(req: Request) {
  const key = parseBearer(req.headers.get("authorization"));
  if (!key) return json({ error: "Station key required." }, 401);
  const svc = serviceClient();
  const { data: station, error } = await svc.from("station_keys").select("id,revoked_at").eq("key_hash", hashKey(key)).maybeSingle();
  if (error || !station || station.revoked_at) return json({ error: "Station key not valid." }, 401);
  void svc.from("station_keys").update({ last_seen_at: new Date().toISOString() }).eq("id", station.id);

  const source = process.env.SITUATION_ROOM_MEDIA_SOURCE_URL?.trim();
  if (!source) return json({ error: "The media source is not configured yet. Set SITUATION_ROOM_MEDIA_SOURCE_URL in the web app deployment settings." }, 503);
  let url: URL;
  try { url = new URL(source); if (url.protocol !== "https:") throw new Error("https required"); }
  catch { return json({ error: "The configured media source URL is invalid; use an HTTPS API URL." }, 500); }

  try {
    const token = process.env.SITUATION_ROOM_MEDIA_SOURCE_TOKEN?.trim();
    const response = await fetch(url, { headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(12_000), cache: "no-store", redirect: "error" });
    if (!response.ok) return json({ error: `The configured media provider returned ${response.status}.` }, 502);
    const payload = await response.json();
    const rows = asRows(payload).slice(0, 250);
    const items = rows.map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
      const variants = (Array.isArray(item.variants) ? item.variants : Array.isArray(item.playbackVariants) ? item.playbackVariants : Array.isArray(metadata.variants) ? metadata.variants : []).slice(0, 20).map((v: any) => ({
        height: Number(v?.height ?? v?.resolutionHeight ?? v?.resolution_height) || null,
        url: safeUrl(v?.url ?? v?.playbackUrl ?? v?.playback_url),
      })).filter((v: any) => v.url);
      const playbackUrl = safeUrl(item.playbackUrl1080p ?? item.playback_url_1080p ?? item.url1080p ?? item.url_1080p ?? item.hls1080pUrl ?? item.hls_1080p_url ?? item.url ?? item.signedUrl ?? item.signed_url ?? item.playbackUrl ?? item.playback_url ?? item.publicUrl ?? item.public_url);
      const variantUrl = variants.filter((v: any) => v.height && v.height <= 1080).sort((a: any, b: any) => b.height - a.height)[0]?.url;
      const finalUrl = variantUrl || playbackUrl;
      if (!finalUrl) return null;
      const recordingAt = date(item.recordingAt ?? item.recording_at ?? item.recordedAt ?? item.recorded_at ?? item.recordingTimestamp ?? item.recording_timestamp ?? item.originalRecordedAt ?? item.original_recorded_at ?? metadata.recordingAt ?? metadata.recording_at ?? metadata.recordedAt ?? metadata.recorded_at ?? metadata.captureTime);
      const verification = text(item.timestampVerificationStatus ?? item.timestamp_verification_status ?? metadata.timestampVerificationStatus ?? metadata.timestamp_verification_status, 30).toLowerCase();
      const verified = (item.timestampVerified === true || item.timestamp_verified === true || metadata.timestampVerified === true || metadata.timestamp_verified === true) && Boolean(item.timestampVerificationSource ?? item.timestamp_verification_source ?? metadata.timestampVerificationSource ?? metadata.timestamp_verification_source);
      const timestampStatus = verification === "conflict" ? "conflict" : recordingAt && verification === "verified" && verified ? "verified" : recordingAt ? "unverified" : "unavailable";
      return {
        id: text(item.id ?? item.path ?? item.key, 160) || `media-${index + 1}`,
        title: text(item.title ?? item.name ?? item.filename, 180) || `Video ${index + 1}`,
        url: finalUrl,
        thumbnail: safeUrl(item.thumbnail ?? item.thumbnailUrl ?? item.thumbnail_url),
        mimeType: text(item.mimeType ?? item.mime_type ?? item.contentType ?? item.content_type, 80),
        recordingAt,
        uploadedAt: date(item.uploadedAt ?? item.uploaded_at ?? item.storageUploadedAt ?? item.storage_uploaded_at),
        timestampStatus,
        timestampVerificationStatus: timestampStatus,
        timestampVerified: timestampStatus === "verified",
        timestampVerificationSource: timestampStatus === "verified" ? text(item.timestampVerificationSource ?? item.timestamp_verification_source ?? metadata.timestampVerificationSource ?? metadata.timestamp_verification_source, 180) : "",
        location: text(item.location ?? metadata.location, 180),
        duration: Number.isFinite(Number(item.duration)) ? Math.max(0, Number(item.duration)) : null,
        variants,
        metadata: { location: text(item.location ?? metadata.location, 180), recordingAt, timestampStatus },
      };
    }).filter(Boolean);
    return json({ items, fetchedAt: new Date().toISOString(), source: "configured-media-provider" });
  } catch {
    return json({ error: "Could not reach the configured media provider or its response was invalid." }, 502);
  }
}
