
"use client";

import { useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

type Loc = {
  lat: number;
  lon: number;
  accuracyM: number;
  time: string;
};

function position(): Promise<Loc> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("This device does not provide GPS."));
    }

    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracyM: p.coords.accuracy,
          time: new Date(p.timestamp).toISOString(),
        }),
      (e) =>
        reject(
          new Error(
            e.code === 1
              ? "Allow location access to submit an incident."
              : "Could not get a fresh GPS reading. Retry in a clearer area."
          )
        ),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  });
}

export function PollingIncidentCapture({
  assignmentId,
  electionId,
  contestTypes,
  pollingUnitName,
}: {
  assignmentId: string;
  electionId: string;
  contestTypes: string[];
  pollingUnitName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const trailRef = useRef<Loc[]>([]);
  const startedRef = useRef(0);
  const watchRef = useRef<number | null>(null);

  const [kind, setKind] = useState<"incident_photo" | "incident_video">(
    "incident_photo"
  );
  const [contestType, setContestType] = useState(
    contestTypes[0] ?? "presidential"
  );
  const [category, setCategory] = useState("process_irregularity");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState(
    "Incidents must be captured live here. Gallery and file uploads are disabled."
  );

  useEffect(() => {
    let alive = true;

    setReady(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error();
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: kind === "incident_video",
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setReady(true);
        setMessage(
          "Live camera ready. Capture the original incident evidence at the assigned polling unit."
        );
      } catch {
        setMessage(
          "Camera permission or camera hardware is unavailable. Allow camera access and retry."
        );
      }
    })();

    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());

      if (watchRef.current !== null) {
        navigator.geolocation?.clearWatch(watchRef.current);
      }
    };
  }, [kind]);

  async function openSession(
    type: "incident_photo" | "incident_video",
    first: Loc
  ) {
    if (first.accuracyM > 50) {
      throw new Error(
        `GPS accuracy is ${Math.round(first.accuracyM)} m; 50 m or better is required.`
      );
    }

    const r = await fetch("/api/incidents/capture-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId,
        electionId,
        contestType,
        evidenceType: type,
        location: first,
      }),
    });

    const b = await r.json();

    if (!r.ok) {
      throw new Error(b.error || "Incident capture session rejected.");
    }

    return {
      sessionId: b.sessionId as string,
      token: b.token as string,
    };
  }

  async function submit(
    blob: Blob,
    mime: string,
    capturedAt: string,
    session: { sessionId: string; token: string },
    trail: Loc[] = [],
    recordingEndedAt?: string
  ) {
    const finalLoc = await position();

    if (finalLoc.accuracyM > 50) {
      throw new Error(
        `Final GPS accuracy is ${Math.round(finalLoc.accuracyM)} m; 50 m or better is required.`
      );
    }

    const prep = await fetch("/api/incidents/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        token: session.token,
        contentType: mime,
        size: blob.size,
      }),
    });

    const pj = await prep.json();

    if (!prep.ok) {
      throw new Error(
        pj.error || "Could not prepare private evidence upload."
      );
    }

    const upload = await browserClient()
      .storage.from(pj.bucket)
      .uploadToSignedUrl(
        pj.path,
        pj.uploadToken,
        blob,
        {
          contentType: mime,
          upsert: false,
        }
      );

    if (upload.error) {
      throw new Error(
        "Private evidence upload failed. Check your connection and capture again."
      );
    }

    const r = await fetch("/api/incidents/evidence", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        token: session.token,
        path: pj.path,
        location: finalLoc,
        capturedAt,
        recordingEndedAt:
          kind === "incident_video"
            ? (recordingEndedAt ?? new Date().toISOString())
            : null,
        locationTrail: trail.length
          ? [...trail, finalLoc]
          : [finalLoc],
        deviceMetadata: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        },
        incidentCategory: category,
        severity,
        description,
      }),
    });

    const b = await r.json();

    if (!r.ok) {
      throw new Error(b.error || "Incident submission failed.");
    }

    setMessage(
      `Incident submitted. Reference: ${b.incident.id}. Status: ${b.incident.verification_status}. Evidence is preserved for independent review.`
    );

    setDescription("");
  }

  async function capturePhoto() {
    const video = videoRef.current;

    if (!video || !ready || busy) return;

    setBusy(true);

    try {
      setMessage(
        "Checking location and opening secure capture session…"
      );

      const first = await position();
      const session = await openSession("incident_photo", first);

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (!canvas.width || !canvas.height) {
        throw new Error("Camera is not ready. Try again.");
      }

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not capture camera image.");
      }

      const capturedAt = new Date().toISOString();

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (x) =>
            x
              ? resolve(x)
              : reject(new Error("Could not encode the photo.")),
          "image/jpeg",
          0.94
        )
      );

      if (!blob.size || blob.size > 10 * 1024 * 1024) {
        throw new Error("Photo is empty or exceeds 10 MB.");
      }

      await submit(blob, "image/jpeg", capturedAt, session, [first]);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Incident photo failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function startVideo() {
    if (!ready || busy || recording || !streamRef.current) return;

    setBusy(true);

    try {
      const first = await position();
      const session = await openSession("incident_video", first);

      if (typeof MediaRecorder === "undefined") {
        throw new Error(
          "Live video recording is not supported by this browser. Submit an incident photo instead."
        );
      }

      const mime = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t));

      if (!mime) {
        throw new Error(
          "This browser cannot record a supported video format."
        );
      }

      const rec = new MediaRecorder(streamRef.current, {
        mimeType: mime,
      });

      recorderRef.current = rec;
      chunksRef.current = [];
      trailRef.current = [first];
      startedRef.current = Date.now();

      // Corrected GPS tracking callback.
      const watchId = navigator.geolocation.watchPosition(
        (p) => {
          const lastLocation =
            trailRef.current[trailRef.current.length - 1];

          const lastRecordedAt = lastLocation
            ? Date.parse(lastLocation.time)
            : 0;

          if (
            Date.now() - startedRef.current < 90000 &&
            Date.now() - lastRecordedAt >= 5000
          ) {
            trailRef.current.push({
              lat: p.coords.latitude,
              lon: p.coords.longitude,
              accuracyM: p.coords.accuracy,
              time: new Date(p.timestamp).toISOString(),
            });
          }
        },
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );

      watchRef.current = watchId;

      rec.ondataavailable = (e) => {
        if (e.data.size) {
          chunksRef.current.push(e.data);
        }
      };

      rec.onstop = async () => {
        navigator.geolocation.clearWatch(watchId);
        watchRef.current = null;

        setRecording(false);
        setBusy(true);

        try {
          const blob = new Blob(chunksRef.current, {
            type: rec.mimeType,
          });

          if (Date.now() - startedRef.current < 1000) {
            throw new Error("Record for at least one second.");
          }

          if (blob.size > 25 * 1024 * 1024) {
            throw new Error("Video exceeds 25 MB. Record a shorter clip.");
          }

          await submit(
            blob,
            rec.mimeType.split(";")[0] || rec.mimeType,
            new Date(startedRef.current).toISOString(),
            session,
            trailRef.current,
            new Date().toISOString()
          );
        } catch (e) {
          setMessage(
            e instanceof Error
              ? e.message
              : "Video submission failed."
          );
        } finally {
          setBusy(false);
        }
      };

      rec.start(1000);
      setRecording(true);

      setMessage(
        "Recording live camera video. It will stop automatically after 90 seconds."
      );

      window.setTimeout(() => {
        if (rec.state === "recording") {
          rec.stop();
        }
      }, 90000);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not start live recording."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-rule p-4">
      <header>
        <h2 className="text-lg font-semibold">Report an incident</h2>
        <p className="text-sm text-ink-soft">
          {pollingUnitName}. Live camera only; no gallery, imported files,
          or pre-recorded media.
        </p>
      </header>

      <label className="block text-sm font-medium">
        Election type
        <select
          className="mt-1 w-full rounded border border-rule bg-white p-3"
          value={contestType}
          onChange={(e) => setContestType(e.target.value)}
          disabled={busy || recording}
        >
          {contestTypes.map((t) => (
            <option key={t} value={t}>
              {t
                .replaceAll("_", " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Evidence type
        <select
          className="mt-1 w-full rounded border border-rule bg-white p-3"
          value={kind}
          onChange={(e) =>
            setKind(e.target.value as "incident_photo" | "incident_video")
          }
          disabled={busy || recording}
        >
          <option value="incident_photo">Incident photo</option>
          <option value="incident_video">
            Live incident video (up to 90 seconds)
          </option>
        </select>
      </label>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="aspect-video w-full rounded bg-black object-cover"
        aria-label="Live incident camera preview"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Category
          <select
            className="mt-1 w-full rounded border border-rule bg-white p-3"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy || recording}
          >
            <option value="violence_or_threat">Violence or threat</option>
            <option value="result_interference">Result interference</option>
            <option value="intimidation">Intimidation</option>
            <option value="process_irregularity">Process irregularity</option>
            <option value="access_or_materials">
              Access or election materials
            </option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="block text-sm font-medium">
          Severity
          <select
            className="mt-1 w-full rounded border border-rule bg-white p-3"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            disabled={busy || recording}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium">
        What happened?
        <textarea
          className="mt-1 w-full rounded border border-rule bg-white p-3"
          rows={3}
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what happened factually."
          disabled={busy || recording}
        />
      </label>

      {kind === "incident_photo" ? (
        <button
          type="button"
          onClick={capturePhoto}
          disabled={!ready || busy || !description.trim()}
          className="w-full rounded bg-green px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy
            ? "Checking GPS and submitting…"
            : "Capture incident photo and submit"}
        </button>
      ) : (
        <div className="flex gap-2">
          {!recording ? (
            <button
              type="button"
              onClick={startVideo}
              disabled={!ready || busy || !description.trim()}
              className="flex-1 rounded bg-green px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              Record live incident video
            </button>
          ) : (
            <button
              type="button"
              onClick={() => recorderRef.current?.stop()}
              className="flex-1 rounded bg-status-disputed px-4 py-3 font-semibold text-white"
            >
              Stop and submit video
            </button>
          )}
        </div>
      )}

      <p role="status" className="text-sm text-ink-soft">
        {message}
      </p>
    </section>
  );
}
