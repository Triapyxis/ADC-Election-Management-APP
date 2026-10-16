# Nigeria Election Monitor

Fresh Next.js (App Router, strict TS, Tailwind) build. Does not modify any existing app or database.

## Status
| Item | State |
|---|---|
| Polling-unit CSV parser/validator/importer | Implemented, unit-tested, run in preview against the real file |
| `--apply` database upsert | Implemented, **not yet run** (no Supabase connection available) |
| Migration 0001 (geography, polling units, import history, RLS) | Written, **not applied**, not yet executed against Postgres |
| Next.js scaffold + design tokens + placeholder home | Written, **not installed or built** (no network in authoring sandbox) |
| Everything else (auth, results, map, geocoding, geofence, realtime) | Pending |

## Run
    cp .env.example .env.local   # fill values; never commit
    npm install && npm run typecheck && npm run dev
    POLLING_UNITS_CSV=./data/Nigeria_polling_units.csv npm test
    npm run import:preview -- --file ./data/Nigeria_polling_units.csv   # no DB writes
    # review reports/import-report.json, apply 0001 to a STAGING project, then:
    npm run import:apply -- --file ./data/Nigeria_polling_units.csv

Import safety: upserts keyed on `official_code`; never deletes; never writes coordinates or
geocode status, so re-runs cannot overwrite verified locations.

## Update: roles + geofence
- `lib/geofence.ts`: server-side Haversine, 200 m radius, 50 m accuracy, staleness (120 s, configurable). 9 tests passing.
- `0003`: roles, assignments, location evidence, overrides, RLS, audit triggers. **Not applied; RLS is untested against a real database.**
- Known gap: role changes (`user_roles`) are not yet audited; no server routes call `evaluateGeofence` yet.

## Update: geocoding core
`scripts/lib/geocode.mjs` (+ migration `0004`): provider-agnostic, cached, rate-limited, resumable runner; never auto-verifies; never overwrites verified. **No provider chosen, no real geocoding performed, no cost incurred.** The `$5/1000, 10 rps` estimate above is an illustrative input, not a real quote.

## Update: ticker + live status
`lib/ticker.ts` (merge, backoff, link state; 7 tests), `components/Ticker.tsx`, `app/api/ticker`. Updates use **10 s polling with backoff**, not Supabase Realtime (anon cannot subscribe to submissions by design). The seamless loop and no-restart behaviour are **untested in a browser**.

## Update: state page + charts
`/states/[slug]`, `components/Charts.tsx` (dependency-free SVG bars + doughnut, accessible labels), `lib/chart-math.ts` (4 tests), migration `0005` (state progress view, **not applied**). Not browser-tested; LGA/ward/PU drilldown not built.

## Update: submissions + verification
`lib/submission.ts` (validation, 6 tests), `POST /api/submissions`, `PATCH /api/submissions/[id]/decision`, migration `0006` (hardens 0003, atomic `submit_result`). **Routes and RLS untested against a database.** No agent/verifier UI, no correction (re-submission) flow, no document upload, no offline queue yet.

## Update: sign-in, agent form, offline queue
`/login`, `middleware.ts`, `/agent`, `components/SubmitForm.tsx`, `lib/offline-queue.ts` (5 tests), migration `0007` (role-change audit; agents read only actively assigned units, incl. coordinates). **UI never run in a browser; no verifier screen, no sign-out, no role-based redirect, no continuous 15-minute location rechecks yet.**

## Update: verifier queue + assignments
`/verify`, `/admin/assignments` (State→LGA→Ward→Unit selectors via `/api/geo`), `POST /api/assignments`, `lib/assignment.ts` (3 tests, 14-day max is a policy default), migration `0008` (`find_agent_by_email`, not applied). UI never browser-tested; the queue shows submissions in scope, but nothing yet lists agents, revokes assignments, or shows submission stats per agent.

## Update: geofence dashboard
`/admin/geofence`, `lib/dashboard.ts` (7 tests), migration `0009` (`geofence_coverage()`, not applied). Coverage table, recent checks with outcome filter, risk prompts, overrides. **Not browser-tested. No map view, no override form (table only), no per-agent last-check/submission stats, no offline-validation queue view; the "on duty" count is an estimate from checks in the last 20 min, and periodic 15-minute rechecks are not implemented, so it will read low.**

## Update: location checks, overrides, corrections, sign-out, broadcast
`POST /api/location-checks` + `LocationMonitor` (open check, then every 15 min **while the page is open and visible**; browsers cannot check in the background), `POST /api/overrides` + `OverrideButton`, migration `0010` + `supersedesId` on `POST /api/submissions` (corrections add a linked row, originals untouched), `/logout`, `/broadcast/national` (read-only, auto-refresh 10 s). Untested in a browser or DB.

## Deploy (Vercel + Supabase)
1. Create a Supabase **staging** project. Apply `supabase/migrations/0001`..`0010` in order (SQL editor or `supabase db push`).
2. Create users; insert rows into `user_roles` (first `super_admin` via SQL editor with the service role).
3. Env vars (Vercel, all environments): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`).
4. `npm run import:preview`, review `reports/import-report.json`, then `npm run import:apply` against staging.
5. Seed elections/parties/candidates/contests (no seed script yet; real data only).
6. Verify RLS with real users before any production use. Only then consider a production project.

## Not built (honest list; LGA/ward/PU pages now exist, migration 0011 untested)
map modes for non-presidential contests, more broadcast views (state, comparison, seats), document/photo upload, geocoding provider adapter + map correction screen, election/candidate admin, e2e + RLS integration tests, load testing, mobile/tablet visual QA.

## Update: all contest types
`/contests`, `/contests/[id]` (any contest type), `/seats/[type]` (seats LED, ties excluded, never "declared"), migration `0012` (scopes expected units to senatorial/federal constituency/state; adds `public_contest_leaders`). Assembly constituencies are not in the CSV, so assembly contests scope to the state until that data exists. **Contest/candidate setup still has no admin UI (SQL only); the home map is still presidential-only.**

## Update: setup + declarations
`/admin/setup` (create election/party/contest/candidate), `/admin/declarations` (declare with mandatory source reference; revoke with reason, never delete), `/api/admin/setup`, `/api/declarations`, `lib/setup.ts` (5 tests), migration `0013` (declarations table; winner must belong to the contest; one active declaration per contest; admin-only write RLS; audit triggers; public view). The contest page now separates "Officially declared" from verified figures. **State/district area ids on contests must be pasted as UUIDs (no picker); seats page does not yet count declared seats; untested against a database.**

## Update: map modes + more broadcast views
Home map switcher (`/?mode=reporting|senate|house|governorship`), `lib/map-modes.ts` (5 tests), migration `0014` (derives state for district/constituency contests), `/broadcast/seats/[type]`, `/broadcast/ticker`. Verified/pending/disputed and geofence-readiness map modes are **not built**. Untested in a browser/DB.

## Update: geocoding adapter + location review
`scripts/providers/nominatim.mjs` (trial samples only, max 500/run per OSM policy; confidence is OUR heuristic from `place_rank`), `scripts/geocode-run.mjs` (**dry run by default**; `--confirm` to call the provider and write; never touches verified), `/admin/locations` + `POST /api/locations` + migration `0015` (`set_pu_location`: verified needs in-Nigeria coords + note, history in `location_reviews`, state_admin+ only). Form-based, **no embedded map** (needs Leaflet/MapLibre install). **No provider has been chosen or called; a licensed provider is still needed for the national run.** Untested against a DB/browser.

## Update: Realtime push
`lib/notify.ts` (server sends a data-free "changed" broadcast after verification/declaration), `components/LiveRefresh.tsx` (public pages only; refetch on push, coalesced to 1 per 3 s; falls back to 15 s refresh if push is unavailable/drops; 60 s safety refresh when healthy; catches up after reconnect), `lib/realtime.ts` (5 tests). The ticker also refetches immediately on push. **Requires Supabase Realtime "Allow public access" (public channels) ON; if not, pages simply use the polling fallback.** Any anon client could send a fake "changed" ping; the worst effect is an extra refetch since the message carries no data. Not tested against a live Realtime service.

## Update: result-sheet upload
Private bucket `result-sheets` + `submission_documents` (migration `0016`, **writes to the storage schema; run in the SQL editor and check policies in the dashboard**). Flow: `POST /api/uploads` (server picks path, issues one-time signed URL), browser uploads, `PUT /api/uploads` (server reads size/type from STORAGE, rejects and deletes bad files; max 5 files, 10 MB, JPEG/PNG/WebP/PDF), `GET /api/uploads/[id]` (RLS-checked, 60 s signed link). Agents attach after the server has received a submission, so **uploads are not queued offline**. Verifiers see links on `/verify`. No virus scanning or EXIF stripping (photos can contain location metadata). Untested against live Storage.

## Update: SECURITY FIX + agent roster
**Migration `0017` fixes a real flaw in `0003`:** `in_scope()` counted field agents, so an agent would have been able to read other agents' submissions, assignments, location checks and documents across their state. It now excludes field agents. Apply `0017` together with `0003`, and run the agent-isolation test in `docs/TESTING.md` section 7 first. Also adds `/admin/agents` (roster with last check, duty prompt, submission and flag counts), assignment revoke (status-only column grant), `lib/roster.ts` (2 tests). Untested against a DB.

## Update: projections
`lib/projection.ts` (method `proportional_scale` v1, 5 tests), `/admin/projections` control room, `POST/PATCH /api/projections`, migration `0018` (inputs, assumptions, method/version and timestamp recorded; draft by default; an "insufficient data" run cannot be published; never edited), public panel on contest pages labelled "an estimate, not a result" (renders nothing if none published). **The method is deliberately naive (assumes reporting units are representative; no margin of error); it is NOT a statistical forecast.** Presidential and governorship only. No broadcast view for projections. Untested against a DB.

## Update: RLS smoke test
`supabase/tests/rls_smoke.sql`: 26 checks of the access rules using impersonated agent/supervisor/verifier/no-role/anon users, in a transaction that rolls back. **I could not run it here (no Postgres in the authoring sandbox), so the script itself is untested; if it errors on setup rather than on a "FAIL:", fix the script, not the rules.**

## Update: access control + user management
- **Public result tracker (no password):** `/`, `/states`, `/lgas`, `/wards`, `/contests`, `/seats`. Verified results and official declarations ONLY. No projections, no broadcast tools.
- **Password required:** `/agent`, `/verify`, `/admin/*`, `/account/*`, and every write API (each API also checks the user itself).
- **Super administrator** (`/admin/users`): create logins, give/remove roles with a state or LGA scope, reset passwords, disable/enable accounts. Cannot remove their own super-admin role or disable themselves. New users get a temporary password and **must change it at first sign-in**. `/account` shows each person only their own modules.
- **Supabase settings you must change (Dashboard > Authentication):** turn OFF "Allow new users to sign up" (otherwise anyone can create an account, though one with no role can open nothing); set minimum password length to 12 and enable leaked-password protection if your plan offers it; consider MFA for super administrators.
- **First super admin:** create one user in Auth and insert the role with `supabase/dev/grant-roles.example.sql`. After that, use `/admin/users`.
- New code: `lib/users.ts`, `lib/nav.ts` (6 tests). Untested against Supabase Auth.

## The 4-in-1 system (current design)
| App | Where it runs | Who | What |
|---|---|---|---|
| **Public result tracker** | central web app, `/` | everyone, no password | verified results and official declarations only; no projections |
| **Agent app** | central web app, `/agent` | field agents (password) | submit results, location checks, result-sheet photos |
| **Admin** | central web app, `/admin` | super admin, election/state admins, supervisors, verifiers (password) | coordinates everything: users and roles, election setup, verification, assignments, locations, geofence, declarations, projections, **situation-room stations** |
| **Situation Room** | **separate Windows desktop app on each laptop**, installed from `Situation-Room-Setup.exe` (source in `situation-room.zip`) | broadcast operators, on their own laptop | OBS-style preview/program console and OBS/vMix outputs |

**The Situation Room is not part of the central web app.** Each laptop runs its own copy with its own state and receives ONLY display data
from the central system through `GET /api/feed`, which needs a **station key** issued per laptop in **Admin > Situation-room stations**
(migration `0021`; only a hash is stored; the key is shown once; a lost laptop is cut off by revoking its key). The feed contains public
results, seats led, reporting progress and projections an admin has *released*; no agent, location or submission data (`lib/room-data.ts`).
Projections are generated and released in Admin, never shown on the public tracker. The earlier `broadcast_operator` role and `/desk`,
`/room` and `/output` routes were removed; migrations `0019`/`0020` remain valid (the enum value is simply unused).
Untested against a database/browser; the laptop app's server and renderer are tested (see its README).

## Update: feed cache
`/api/feed` shares one short-lived (3 s) result per warm server instance across all laptops (`lib/feed-cache.ts`), so ten laptops cost one set of queries per few seconds. If a load fails it serves the last good result for up to 60 s with `X-Feed-Stale: 1`; otherwise 503. The data's own `syncedAt` is its true read time, so laptops label it correctly. Key checks are NOT cached, so a revoked key stops working on the next request. "Last fetched" is written at most once a minute per key. Vercel may run several instances, each with its own cache; the load is bounded but not a single global query. Not load-tested.
