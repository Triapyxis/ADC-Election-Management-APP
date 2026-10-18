"use client";
import { useEffect, useRef, useState } from "react";

type Props = { centreId: string; centreName: string; radiusM: number };
type Loc = { lat: number; lon: number; accuracyM: number; time: string };
const getLocation = () => new Promise<Loc>((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error("This device does not provide GPS location."));
  navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy, time: new Date(p.timestamp).toISOString() }), e => reject(new Error(e.code === 1 ? "Allow location access to continue." : "Could not get GPS. Move to an area with a clearer signal and retry.")), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
});
export function LiveCameraCapture({ centreId, centreName, radiusM }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null), streamRef = useRef<MediaStream | null>(null), recorderRef = useRef<MediaRecorder | null>(null), chunksRef = useRef<Blob[]>([]), startedRef = useRef<number>(0);
  const [kind, setKind] = useState("ec8a"), [incidentCategory, setIncidentCategory] = useState("violence_or_threat"), [severity, setSeverity] = useState("medium"), [description, setDescription] = useState("");
  const [cameraReady, setCameraReady] = useState(false), [recording, setRecording] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("Camera access is required. Gallery and file uploads are not supported.");
  useEffect(() => { let alive = true; (async () => { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: kind === "incident_video", video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } }); if (!alive) { stream.getTracks().forEach(t => t.stop()); return; } streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); } setCameraReady(true); setMessage("Live camera ready. Stay at the assigned centre and capture the original evidence."); } catch { setMessage("Camera permission or camera hardware is unavailable. Enable camera access and retry."); } })(); return () => { alive = false; streamRef.current?.getTracks().forEach(t => t.stop()); }; }, [kind]);
  async function makeSession(evidenceType: string, location: Loc) {
    const r = await fetch("/api/collation/capture-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ centreId, evidenceType, location }) });
    const b = await r.json(); if (!r.ok) throw new Error(b.error || "Capture session rejected."); return b as { sessionId: string; token: string };
  }
  async function upload(blob: Blob, mime: string, capturedAt: string, session: { sessionId: string; token: string }, evidenceType: string, trail: Loc[] = [], recordingEndedAt?: string) {
    const location = await getLocation();
    const data = new FormData(); data.append("sessionId", session.sessionId); data.append("token", session.token); data.append("file", blob, `camera-capture.${mime.includes("jpeg") ? "jpg" : mime.includes("png") ? "png" : mime.includes("mp4") ? "mp4" : mime.includes("webp") ? "webp" : "webm"}`);
    data.append("lat", String(location.lat)); data.append("lon", String(location.lon)); data.append("accuracyM", String(location.accuracyM)); data.append("locationTime", location.time); data.append("capturedAt", capturedAt);
    data.append("locationTrail", JSON.stringify(trail.length ? [...trail, location] : [location])); data.append("deviceMetadata", JSON.stringify({ userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language })); if (evidenceType === "incident_video") data.append("recordingEndedAt", recordingEndedAt ?? new Date().toISOString()); data.append("incidentCategory", incidentCategory); data.append("severity", severity); data.append("description", description);
    const r = await fetch("/api/collation/evidence", { method: "POST", body: data }); const b = await r.json(); if (!r.ok) throw new Error(b.error || "Evidence submission failed.");
    setMessage(`Submitted successfully. Evidence ID: ${b.evidence.id}. Status: ${b.evidence.verification_status}. Original evidence is preserved for review.`); setDescription("");
  }
  async function capturePhoto() {
    if (!videoRef.current || !cameraReady || busy) return;
    setBusy(true); setMessage("Checking location and starting secure capture…");
    try {
      const location = await getLocation(); if (location.accuracyM > 50) throw new Error(`GPS accuracy is ${Math.round(location.accuracyM)} m. Required: 50 m or better.`);
      const session = await makeSession(kind, location); const v = videoRef.current, canvas = document.createElement("canvas");
      canvas.width = v.videoWidth; canvas.height = v.videoHeight; if (!canvas.width || !canvas.height) throw new Error("Camera is not ready. Try again.");
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Camera capture failed."); const capturedAt = new Date().toISOString(); ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not encode camera capture.")), "image/jpeg", 0.94));
      await upload(blob, "image/jpeg", capturedAt, session, kind);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Capture failed."); } finally { setBusy(false); }
  }
  async function startVideo() {
    if (!cameraReady || !streamRef.current || busy || recording) return;
    try {
      const location = await getLocation(); if (location.accuracyM > 50) throw new Error(`GPS accuracy is ${Math.round(location.accuracyM)} m. Required: 50 m or better.`);
      const session = await makeSession("incident_video", location); const trail: Loc[] = [location]; let lastTrailAt = Date.now(); const watchId = navigator.geolocation.watchPosition(p => { if (Date.now() - lastTrailAt >= 5000) { trail.push({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy, time: new Date(p.timestamp).toISOString() }); lastTrailAt = Date.now(); } }, () => { /* final server-side location check remains mandatory */ }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }); const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(t => MediaRecorder.isTypeSupported(t));
      if (!mime) throw new Error("This browser cannot record a supported video format. Use a current Safari or Chrome browser.");
      chunksRef.current = []; const rec = new MediaRecorder(streamRef.current, { mimeType: mime }); recorderRef.current = rec; startedRef.current = Date.now();
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => { navigator.geolocation.clearWatch(watchId); setRecording(false); setBusy(true); try { const blob = new Blob(chunksRef.current, { type: rec.mimeType }); if (Date.now() - startedRef.current < 1000) throw new Error("Record for at least one second."); await upload(blob, rec.mimeType.split(";")[0] || rec.mimeType, new Date(startedRef.current).toISOString(), session, "incident_video", trail, new Date().toISOString()); } catch (e) { setMessage(e instanceof Error ? e.message : "Video submission failed."); } finally { setBusy(false); } };
      rec.start(1000); setRecording(true); setMessage("Recording live from this camera. Keep recording focused on the incident. Stop when complete; maximum 90 seconds.");
      window.setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 90000);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not start recording."); }
  }
  return <section className="space-y-4 rounded border border-rule bg-paper-raised p-4">
    <div><h2 className="text-lg font-semibold">Live camera evidence</h2><p className="text-sm text-ink-soft">Assigned centre: {centreName} · Geofence radius: {radiusM} m</p></div>
    <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded bg-black object-cover" aria-label="Live camera preview" />
    <p className="text-sm text-ink-soft">{message}</p>
    <label className="block text-sm font-medium">Evidence type<select className="mt-1 w-full rounded border border-rule bg-white p-3" value={kind} onChange={e => setKind(e.target.value)} disabled={busy || recording}><option value="ec8a">EC8A paper result form (photo)</option><option value="incident_photo">Incident report (photo)</option><option value="incident_video">Incident report (video)</option></select></label>
    {kind !== "ec8a" && <div className="space-y-3"><label className="block text-sm font-medium">Incident category<select className="mt-1 w-full rounded border border-rule bg-white p-3" value={incidentCategory} onChange={e => setIncidentCategory(e.target.value)}><option value="violence_or_threat">Violence or threat</option><option value="result_interference">Result interference</option><option value="intimidation">Intimidation</option><option value="process_irregularity">Process irregularity</option><option value="access_or_materials">Access or election materials</option><option value="other">Other</option></select></label><label className="block text-sm font-medium">Severity<select className="mt-1 w-full rounded border border-rule bg-white p-3" value={severity} onChange={e => setSeverity(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="block text-sm font-medium">Description<textarea className="mt-1 w-full rounded border border-rule bg-white p-3" rows={3} maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what happened, without speculation." /></label></div>}
    {kind === "incident_video" ? <div className="flex gap-2">{!recording ? <button type="button" onClick={startVideo} disabled={!cameraReady || busy} className="rounded bg-green px-4 py-3 font-semibold text-white disabled:opacity-50">Record live video</button> : <button type="button" onClick={() => recorderRef.current?.stop()} className="rounded bg-status-disputed px-4 py-3 font-semibold text-white">Stop and submit video</button>}</div> : <button type="button" onClick={capturePhoto} disabled={!cameraReady || busy || recording} className="w-full rounded bg-green px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Processing securely…" : "Capture and submit from camera"}</button>}
    <p className="text-xs text-ink-soft">No gallery or file import is available. GPS and election access are checked again by the server at submission. Every accepted item remains pending independent verification.</p>
  </section>;
}
