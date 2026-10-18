# Collation Centre Agent App — implementation notes

This is an additive update to the existing Next.js/Supabase election platform. It does not deploy itself and does not alter the live Supabase database until the migration is applied.

## Included

- Separate mobile route: `/collation-agent`.
- Admin setup: `/admin/collation-centres` to create a centre and assign an existing registered account.
- Admin/verifier review queue: `/admin/collation-evidence`.
- Live in-app camera capture for EC8A paper-form images and incident photos/videos. No gallery/file picker is exposed for these evidence types.
- Server-side checks of centre assignment, election-type access window, GPS accuracy (50 m maximum), configured centre radius, and fresh GPS both at session start and submission.
- Video location samples are checked server-side when supplied; video duration is limited to 90 seconds in the UI and the server file limit is 25 MB.
- Private `collation-evidence` Supabase Storage bucket, SHA-256 hash, original media preservation, review state, and audit events.
- Versioned additive migration: `supabase/migrations/0025_collation_evidence_app.sql`.

## Deployment steps

1. Back up the current repository and database before applying migrations.
2. Review `supabase/migrations/0025_collation_evidence_app.sql` in the Supabase SQL/migration workflow. Apply it after migration `0024_election_agent_access_controls.sql` has been applied. Do not run it against an unreviewed production database.
3. Confirm the private `collation-evidence` storage bucket exists. The migration creates/configures it as private.
4. Deploy the source through the existing GitHub/Vercel workflow. No new environment variables are required; the existing `SUPABASE_SERVICE_ROLE_KEY` must remain server-only and configured in Vercel.
5. In the admin app, open **Collation centres and agents**. Create a centre, enter its actual GPS coordinates, assign an existing registered account, and only tick coordinate verification after independently checking the location. The assigned account receives the `collation_agent` role.
6. In **Election-Day Agent Access**, open the matching election and contest type. A missing, locked, or out-of-window access-control row keeps evidence capture closed.
7. Test with a dedicated test account and test centre first. Verify in-geofence capture, out-of-geofence rejection, poor-accuracy rejection, expired-session rejection, private signed evidence access, review workflow, and the audit trail.

## Important security limitation

Browser live-camera capture is a meaningful control, but it cannot cryptographically prove that a physical scene was genuine. Compromised devices, simulated camera input, or spoofed GPS may evade browser-only signals. SHA-256 proves the stored bytes have not changed since hashing; it does not prove that the scene itself was authentic. Keep all evidence in `pending_verification` until an authorized reviewer compares it with independent sources.

## Scope notes

- EC8A captures are stored as original camera images; multiple pages can be submitted as separate evidence records. OCR/transcription is not implemented in this patch.
- The review UI currently covers the latest 100 records; use database pagination for larger election operations.
- Admin centre creation assigns an existing Supabase Auth user by email. It does not create a new account or send an invitation.
- Run the project's normal typecheck/build in an environment with the declared npm dependencies installed before production deployment.
