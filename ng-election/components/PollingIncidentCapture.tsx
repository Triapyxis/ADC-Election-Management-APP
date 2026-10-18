
"use client";

import { useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

type Loc = {
  lat: number;
  lon: number;
  accuracyM: number;
  time: string;
};

type CaptureType = "incident_photo" | "incident_video";

type CaptureSession = {
  sessionId: string;
  token: string;
};

function position(): Promise<Loc> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This device does not provide GPS."));
      return;
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const [kind, setKind] = useState<CaptureType>("incident_photo");
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

  function showMessage(value: string) {
    if (mountedRef.current) setMessage(value);
  }

  function stopWatching() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }

  function clearRecordingTimeout() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    let alive = true;

    setReady(false);
    stopCamera();

    async function initialiseCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is unavailable.");
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
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!alive) return;

        setReady(true);
        setMessage(
          "Live camera ready. Capture the original incident evidence at the assigned polling unit."
        );
      } catch {
        if (alive) {
          setReady(false);
          setMessage(
            "Camera permission or camera hardware is unavailable. Allow camera access and retry."
          );
        }
      }
    }

    void initialiseCamera();

    return () => {
      alive = false;
      mountedRef.current = false;
      stopWatching();
      clearRecordingTimeout();
      stopCamera();
    };
  }, [kind]);

  async function openSession(
    type: CaptureType,
    first: Loc
  ): Promise<CaptureSession> {
    if (first.accuracyM > 50) {
      throw new Error(
        `GPS accuracy is ${Math.round(first.accuracyM)} m; 50 m or better is required.`
      );
    }

    const response = await fetch("/api/incidents/capture-session", {
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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Incident capture session rejected."
      );
    }

    if (
      typeof result.sessionId !== "string" ||
      typeof result.token !== "string"
    ) {
      throw new Error("The server returned an invalid capture session.");
    }

    return {
      sessionId: result.sessionId,
      token: result.token,
    };
  }

  async function submit(
    blob: Blob,
    mime: string,
    capturedAt: string,
    session: CaptureSession,
    trail: Loc[] = [],
    recordingEndedAt?: string
  ) {
    const finalLoc = await position();

    if (finalLoc.accuracyM > 50) {
      throw new Error(
        `Final GPS accuracy is ${Math.round(finalLoc.accuracyM)} m; 50 m or better is required.`
      );
    }

    const prepResponse = await fetch("/api/incidents/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        token: session.token,
        contentType: mime,
        size: blob.size,
      }),
    });

    const prep = await prepResponse.json();

    if (!prepResponse.ok) {
      throw new Error(
        prep.error || "Could not prepare private evidence upload."
      );
    }

    if (
      typeof prep.bucket !== "string" ||
      typeof prep.path !== "string" ||
      typeof prep.uploadToken !== "string"
    ) {
      throw new Error("The server returned invalid upload details.");
    }

    const upload = await browserClient()
      .storage.from(prep.bucket)
      .uploadToSignedUrl(prep.path, prep.uploadToken, blob, {
        contentType: mime,
        upsert: false,
      });

    if (upload.error) {
      throw new Error(
        "Private evidence upload failed. Check your connection and capture again."
      );
    }

    const response = await fetch("/api/incidents/evidence", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        token: session.token,
        path: prep.path,
        location: finalLoc,
        capturedAt,
        recordingEndedAt:
          kind === "incident_video"
            ? recordingEndedAt ?? new Date().toISOString()
            : null,
        locationTrail: trail.length ? [...trail, finalLoc] : [finalLoc],
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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Incident submission failed.");
    }

    showMessage(
      `Incident submitted. Reference: ${result.incident.id}. Status: ${result.incident.verification_status}. Evidence is preserved for independent review.`
    );

    if (mountedRef.current) setDescription("");
  }

  async function capturePhoto() {
    const video = videoRef.current;

    if (!video || !ready || busy || !description.trim()) return;

    setBusy(true);

    try {
      showMessage("Checking location and opening secure capture session…");

      const first = await position();
      const session = await openSession("incident_photo", first);

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (!canvas.width || !canvas.height) {
        throw new Error("Camera is not ready. Try again.");
      }

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not capture camera image.");
      }

      const capturedAt = new Date().toISOString();

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error("Could not encode the photo."));
          },
          "image/jpeg",
          0.94
        );
      });

      if (!blob.size || blob.size > 10 * 1024 * 1024) {
        throw new Error("Photo is empty or exceeds 10 MB.");
      }

      await submit(blob, "image/jpeg", capturedAt, session, [first]);
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Incident photo failed."
      );
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function startVideo() {
    if (
      !ready ||
      busy ||
      recording ||
      !streamRef.current ||
      !description.trim()
    ) {
      return;
    }

    setBusy(true);

    try {
      showMessage("Checking location and opening secure capture session…");

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
      ].find((type) => MediaRecorder.isTypeSupported(type));

      if (!mime) {
        throw new Error(
          "This browser cannot record a supported video format."
        );
      }

      const stream = streamRef.current;
      const recorder = new MediaRecorder(stream, { mimeType: mime });

      recorderRef.current = recorder;
      chunksRef.current = [];
      trailRef.current = [first];
      startedRef.current = Date.now();

      const watchId = navigator.geolocation.watchPosition(
        (p) => {
          const now = Date.now();
          const trail = trailRef.current;
          const lastPoint =
            trail.length > 0 ? trail[trail.length - 1] : undefined;
          const lastTime = lastPoint ? Date.parse(lastPoint.time) : 0;

          if (now - startedRef.current >= 90000) return;
          if (now - lastTime < 5000) return;

          trail.push({
            lat: p.coords.latitude,
            lon: p.coords.longitude,
            accuracyM: p.coords.accuracy,
            time: new Date(p.timestamp).toISOString(),
          });
        },
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );

      watchRef.current = watchId;

      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopWatching();
        clearRecordingTimeout();
        if (mountedRef.current) {
          setRecording(false);
          setBusy(false);
          setMessage("The browser encountered an error while recording.");
        }
      };

      recorder.onstop = async () => {
        stopWatching();
        clearRecordingTimeout();

        if (mountedRef.current) {
          setRecording(false);
          setBusy(true);
        }

        try {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType,
          });

          if (Date.now() - startedRef.current < 1000) {
            throw new Error("Record for at least one second.");
          }

          if (!blob.size) {
            throw new Error("The recording is empty. Please record again.");
          }

          if (blob.size > 25 * 1024 * 1024) {
            throw new Error("Video exceeds 25 MB. Record a shorter clip.");
          }

          const trailSnapshot = [...trailRef.current];

          await submit(
            blob,
            recorder.mimeType.split(";")[0] || recorder.mimeType,
            new Date(startedRef.current).toISOString(),
            session,
            trailSnapshot,
            new Date().toISOString()
          );
        } catch (error) {
          showMessage(
            error instanceof Error
              ? error.message
              : "Video submission failed."
          );
        } finally {
          chunksRef.current = [];
          if (mountedRef.current) setBusy(false);
        }
      };

      recorder.start(1000);

      setRecording(true);
      setMessage(
        "Recording live camera video. It will stop automatically after 90 seconds."
      );

      timeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 90000);
    } catch (error) {
      stopWatching();
      clearRecordingTimeout();

      showMessage(
        error instanceof Error
          ? error.message
          : "Could not start live recording."
      );
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  function stopVideo() {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      clearRecordingTimeout();
      recorder.stop();
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-rule p-4">
      <header>
        <h2 className="text-lg font-semibold">Report an incident</h2>
        <p className="text-sm text-ink-soft">
          {pollingUnitName}. Live camera only; no gallery, imported files, or
          pre-recorded media.
        </p>
      </header>

      <label className="block text-sm font-medium">
        Election type
        <select
          className="mt-1 w-full rounded border border-rule bg-white p-3"
          value={contestType}
          onChange={(event) => setContestType(event.target.value)}
          disabled={busy || recording}
        >
          {contestTypes.map((type) => (
            <option key={type} value={type}>
              {type
                .replaceAll("_", " ")
                .replace(/\b\w/g, (character) => character.toUpperCase())}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Evidence type
        <select
          className="mt-1 w-full rounded border border-rule bg-white p-3"
          value={kind}
          onChange={(event) => setKind(event.target.value as CaptureType)}
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
            onChange={(event) => setCategory(event.target.value)}
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
            onChange={(event) => setSeverity(event.target.value)}
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
          onChange={(event) => setDescription(event.target.value)}
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
          {busy ? "Checking GPS and submitting…" : "Capture incident photo and submit"}
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
              {busy ? "Preparing recording…" : "Record live incident video"}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopVideo}
              className="flex-1 rounded bg-status-disputed px-4 py-3 font-semibold text-white"
            >
              Stop and submit video
            </button>
          )}
        </div>
      )}

      <p role="status" aria-live="polite" className="text-sm text-ink-soft">
        {message}
      </p>
    </section>
  );
}
