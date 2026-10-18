# Election evidence camera-only update

This update applies the live-camera-only evidence rule to both polling-unit agents and collation-centre agents.

## Polling-unit agents
- Result-sheet attachments now use an in-app live camera preview and capture button; no file picker, gallery import, PDF, or pre-existing image selection is offered.
- The server issues a short-lived, one-use capture session bound to the signed-in agent, active polling-unit assignment, and result submission.
- The server checks verified polling-unit coordinates, fresh GPS, accuracy of 50 metres or better, and the existing 200-metre geofence policy at session creation and again at registration.
- Only JPEG captures up to 10 MB are accepted for new evidence. Stored bytes are hashed with SHA-256 and the document record is marked `in_app_live_camera`.
- Legacy evidence records are preserved. New uploads through the old arbitrary-file API contract are rejected because that contract has been removed.

## Migration and deployment
1. Back up the Supabase database and retain the previous ZIP/repository commit.
2. Apply `supabase/migrations/0026_polling_agent_live_camera_evidence.sql` after migrations 0001–0025.
3. Install dependencies and run `npm run typecheck`, `npm test`, and `npm run build`.
4. Test on a mobile device at a polling unit whose coordinates are verified. Confirm camera permission, GPS accuracy, inside/outside geofence rejection, upload registration, and reviewer access.
5. Deploy through the existing GitHub/Vercel workflow only after tests pass.

## Security limitation
A web app cannot cryptographically prove that every browser camera stream is genuine on a compromised device. This change blocks normal gallery/file-picker use and closes the old arbitrary-file upload API path, while adding server-side session, assignment, GPS, and evidence-hash checks. Keep evidence pending independent review; a hash proves that stored bytes have not changed since hashing, not that the scene itself is authentic.


## Evidence metadata (migration 0028)

Migration `0028_camera_evidence_metadata.sql` adds structured metadata for polling-unit result sheets, polling-unit incidents, and collation-centre evidence: client-reported capture time (clearly distinguished from authoritative server receipt time), initial and final GPS coordinates and accuracy, GPS timestamps, server-computed geofence distance/outcome, SHA-256, MIME type and byte size, authenticated agent/session/submission or election/contest context, capture method, device/browser diagnostics, video recording start/end/duration, and a GPS sample trail for video. Result-sheet registrations also write a server-side audit record; incidents continue using the incident audit table. Metadata supplied by the client is supporting evidence only and is not treated as proof of authenticity.
