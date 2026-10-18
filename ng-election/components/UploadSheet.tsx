"use client";
import { useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { BUCKET, MAX_BYTES } from "@/lib/upload";

function position() {
  return new Promise<{ lat: number; lon: number; accuracyM: number; time: string }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This device does not provide GPS location."));
    navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy, time: new Date(p.timestamp).toISOString() }), e => reject(new Error(e.code === 1 ? "Allow location access to continue." : "Could not get GPS. Move to an area with a clearer signal and retry.")), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}
export function UploadSheet({ submissionId }: { submissionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null), streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState<string | null>("Result evidence must be captured live with this camera. Gallery and file uploads are disabled."), [n, setN] = useState(0);
  useEffect(() => { let alive = true; (async () => { try { if (!navigator.mediaDevices?.getUserMedia) throw new Error(); const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } }); if (!alive) { stream.getTracks().forEach(t => t.stop()); return; } streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); } setReady(true); setMsg("Live camera ready. Confirm you are at the assigned polling unit before capturing the original result sheet."); } catch { setMsg("Camera access is required. Allow camera permission and reload this section; imported files are not accepted."); } })(); return () => { alive = false; streamRef.current?.getTracks().forEach(t => t.stop()); }; }, []);
  async function capture() {
    const video = videoRef.current; if (!video || !ready || busy) return;
    setBusy(true); setMsg("Checking GPS and opening a one-time capture session…");
    try {
      const first = await position(); if (first.accuracyM > 50) throw new Error(`GPS accuracy is ${Math.round(first.accuracyM)} m. Required: 50 metres or better.`);
      const sr = await fetch("/api/uploads/capture-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, location: first }) }); const sj = await sr.json(); if (!sr.ok) throw new Error(sj.error ?? "Capture session rejected.");
      const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight; if (!canvas.width || !canvas.height) throw new Error("Camera is not ready. Try again.");
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Could not capture from the camera."); const capturedAt = new Date().toISOString(); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not encode the camera image.")), "image/jpeg", 0.94)); if (!blob.size || blob.size > MAX_BYTES) throw new Error("Captured image is empty or exceeds the 10 MB limit.");
      const finalLoc = await position(); if (finalLoc.accuracyM > 50) throw new Error(`Final GPS accuracy is ${Math.round(finalLoc.accuracyM)} m. Required: 50 metres or better.`);
      const a = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, sessionId: sj.sessionId, token: sj.token, contentType: "image/jpeg", size: blob.size }) }); const aj = await a.json(); if (!a.ok) throw new Error(aj.error ?? "Could not prepare secure upload.");
      const up = await browserClient().storage.from(BUCKET).uploadToSignedUrl(aj.path, aj.uploadToken, blob, { contentType: "image/jpeg", upsert: false }); if (up.error) throw new Error("Camera image upload failed. Check your connection and try again.");
      const r = await fetch("/api/uploads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, sessionId: sj.sessionId, token: sj.token, path: aj.path, location: finalLoc, capturedAt, deviceMetadata: { userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language } }) }); const rj = await r.json(); if (!r.ok) throw new Error(rj.error ?? "Could not register camera evidence.");
      setN(x => x + 1); setMsg("Live camera result-sheet photo attached. Server geofence passed; the evidence remains subject to independent review.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Camera capture failed. Try again."); } finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-3 rounded border border-rule p-3 text-sm"><div><h3 className="font-semibold">Live camera result-sheet evidence</h3><p className="mt-1 text-ink-soft">Gallery, file picker, PDFs and imported images are not accepted.</p></div><video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded bg-black object-cover" aria-label="Live camera preview"/><button type="button" onClick={capture} disabled={!ready || busy} className="rounded bg-green px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Capturing and uploading…" : "Capture result sheet"}</button>{msg && <p role="status" className="text-ink-soft">{msg}</p>}{n > 0 && <p>{n} camera capture{n === 1 ? "" : "s"} attached.</p>}</div>;
}
