# Testing checklist (run in this order, on STAGING)

**Before section 4, run `supabase/tests/rls_smoke.sql` on staging (SQL editor). It checks 26 access rules with impersonated users inside a transaction that rolls back. Every line should say PASS.**

## 0. Install and compile
`npm install` then `npm run typecheck` then `npm run dev`. Send me every error verbatim.

## 1. Importer (no database)
`POLLING_UNITS_CSV=./data/Nigeria_polling_units.csv npm test` should pass 59 tests.
`npm run import:preview -- --file ...` should report 176,846 units, 774 LGAs, 8,809 wards, 0 errors.

## 2. Database
Apply `supabase/migrations/0001..0010` in order. Any SQL error: send it with the file name.
`npm run import:apply -- --file ...`, then run the import a SECOND time: counts must not change.
Check: `select count(*) from polling_units;` = 176846; leading zeros intact (`select official_code from polling_units limit 3;`).

## 3. Public pages (dev seed first: `supabase/dev/seed.dev.sql`)
- `/` shows the fictional TEST election, 3 candidates, map with 6 coloured states, others grey.
- `/states/lagos` shows bars + doughnut; `/states/ogun` shows "Awaiting results".
- Ticker scrolls; stop the dev server and confirm it shows "Reconnecting" then recovers.
- Check at 360 px, 768 px, 1280 px widths. Check keyboard tab order and reduced-motion setting.

## 4. Access rules (most important)
Create users, then run `supabase/dev/grant-roles.example.sql` (edit emails).
- Anonymous: cannot read `polling_units`, `result_submissions`, `geofence_checks`. Try via the REST API with the anon key.
- Agent with NO assignment: `/agent` says "No active assignment"; `POST /api/submissions` returns 403.
- Supervisor assigns the agent via `/admin/assignments`; an assignment outside the supervisor's state must be refused.
- Agent submits: server sets `geofence_status`; try inserting directly with `geofence_status='within_radius'` through the REST API: must fail.
- Verifier cannot decide a submission made by the same user. Rejection without a reason must fail.
- Nobody can set status `declared` through any route.

## 5. Geofence (needs verified coordinates)
Pick one unit; set `latitude`, `longitude`, `geocode_status='verified'` by SQL. From a phone at / away from that spot confirm within / outside radius. Without verified coordinates the result must say the check is not possible.

## 6. Report back
List what failed with exact messages. Anything not tested stays "pending".

## 7. Added after migration 0017 (agent isolation: test this early)
- Sign in as a field agent with a state-scoped role. Through the REST API with that user's token, `select` from `result_submissions`, `geofence_checks`, `assignments`, `submission_documents`: you must see ONLY your own rows, never other agents' rows in the same state. (This was a real bug in 0003, fixed in 0017.)
- A supervisor can revoke an assignment (`/admin/assignments`) but cannot change its agent, polling unit or times (column grant): try via the REST API.
- `/admin/agents` lists only agents assigned inside the supervisor's own area.

## 8. Login and user management
- Supabase: Authentication > Providers/Settings: sign-ups OFF. Try signing up through the REST API: it must fail.
- Signed out: open `/admin/users`, `/agent`, `/verify`, `/account`: each must redirect to `/login`. Public pages (`/`, `/contests`) must still open without login.
- As super admin: create a user (leave password empty): the temporary password is shown once. Sign in as that user in a private window: you must be sent to "Choose a new password" and be unable to open anything else until it is changed.
- Give that user `verifier` for one state: `/account` lists only "Verify results". Opening `/admin/users` shows "Not available".
- Remove their role: `/account` says they have no role. Disable the account: they cannot sign in.
- Super admin cannot remove their own super-admin role or disable their own account.

## 9. Station keys, the feed, and the laptop app
- Admin > Situation-room stations: create "Studio A"; the key is shown once. Reload: it cannot be shown again. Only a hash is in `station_keys`.
- `curl https://<site>/api/feed` with no key: 401. With a wrong key: 401 (same message). With the key: JSON containing election, president, seats, states, projection. Confirm it contains NO agent names, coordinates or submissions.
- Revoke the key: the same curl now returns 401, and the laptop console shows "Station key rejected".
- Release a projection in Admin: it appears in the feed `projection` field. Withdraw it: it disappears. It never appears on the public pages.
- Public tracker pages (`/`, `/contests`) contain no projection and no link to any situation-room tool.
- On a laptop: install with the Situation-Room-Setup .exe (see `situation-room/README.md`), then enter the central address and station key in the Settings window. Check the status badge, Preview/Program, Cut/Transition, lower third, ticker, announcement, and that OBS Browser source `http://127.0.0.1:4010/output.html` shows the Program picture. Unplug the network: the picture stays, the console says "Data delayed".

## 10. Feed cache and freeze (added later)
- Central: with 3+ laptops connected, the Vercel function log should show far fewer database queries than laptops x polls. `curl -i` the feed with a key twice within 3 s: the second response has a small `X-Feed-Age`. `syncedAt` does not change within the window.
- Revoke a key: the very next request returns 401 (key checks are not cached).
- Laptop: press F (or the Freeze data button). Verify a result in Admin: Preview changes within ~5 s, Program and the OBS output do NOT, and the red banner shows. Resume: Program catches up. Quit and reopen while frozen: still frozen.

## 11. OBS on another computer (network sharing)
- Laptop A runs Situation Room; computer B runs OBS; same network. On A: Settings > turn on sharing, allow Private networks in the Windows prompt.
- On B open the Program address from A's Outputs panel in a normal browser first: the picture appears and follows Preview/Program/Cut/Transition on A. Then add it to OBS as a Browser source (1920 x 1080) and confirm the overlay address keeps a transparent background.
- On B change a character of the secret: blank page (404). Open `http://<A-address>:4011/` with no secret: 404. Try the console address `http://<A-address>:4010/`: must not load.
- On A press "Make new address": B's source goes blank; paste the new address and it returns.
- Freeze on A: B's picture stops moving.
