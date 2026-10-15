# Clipvero engineering contract

## Personal agent automation scope

The owner prioritizes an end-to-end run on the working Node/SQLite studio before resuming PostgreSQL migration. This scope does not satisfy public SaaS parity gates below. Keep it behind `CLIPVERO_BACKEND=legacy` and reuse real video jobs/credits. MCP uses authenticated Streamable HTTP and a stdio bridge. Agent credentials are hashed, expiring and revocable; only owner sessions issue grants. Bind request UUIDs to canonical payloads, reserve batches atomically and enforce lifetime count/credit caps. Check Host/Origin, bound input and reject multi-output modes that could evade allowances.

OAuth states are hashed, owner/workspace-bound, expiring and single-use. Encrypt provider tokens with AES-GCM and a dedicated HKDF key from stable SESSION_SECRET, binding ciphertext to connection ID. Refresh under fenced per-account leases. Persist per-destination intents before external effects. Fence every publisher mutation with a live claim token and reserve schedule spacing atomically. Unknown writes reconcile without blind replay. Recheck grant, destination and approved revision before submission; serve only that output through expiring signed media links. Instagram may auto-approve under owner policy; TikTok always requires current creator settings and explicit per-video consent. Local cancellation cannot undo an accepted TikTok post. Preserve numeric int64 provider IDs without precision loss. Never log tokens, OAuth codes or signed URLs. Node pilot migrations do not replace Alembic contracts for PostgreSQL.

Private local launches use a saved ngrok hostname and token, never a rotating quick-tunnel address. Require an existing `PILOT_OWNER_EMAIL` before opening the tunnel; restrict old sessions, agent grants and worker claims to its workspace. Allow initial signup only for that email in non-production HTTP loopback development. Disable ngrok inspection and remote management; pass its token through the environment and sanitize its logs. Stop only processes the launcher owns. Serve TikTok prefix proof files from the fixed ignored directory with a strict TXT filename/size allowlist and no symlinks.

## Required service architecture

The continuation supersedes the legacy architecture below. Web stays in the repository root during migration, with pnpm workspace packages for the independent video engine and OpenAPI-generated TypeScript contracts. Python uses a uv workspace: services/api (FastAPI) and services/workers (Celery). Do not introduce Redux, synchronous video processing or frontend-owned billing/authorization. Postgres is the production database, Redis the broker/rate-limit store, private S3/R2 the phase-2 media store. Use Python >=3.12, Pydantic 2, SQLAlchemy 2, Alembic, psycopg, HTTPX, Celery and JSON logs. Versions are resolved and committed in uv.lock and pnpm-lock.yaml; never hand-edit locks.

The old SQLite API/worker remains development-only until phases 1 through 3 pass parity. Explicit deployment mode selects one backend. Never silently fail over, share sessions across stores, or claim automatic data migration. Pass backend selection from the server route to shared browser components and use the matching API helper. Never infer the backend from cached HTML attributes. Keep legacy data for export/recovery. Removal requires a separate migration, verified PostgreSQL equivalents, and a documented rollback.

## Versioned API and ownership

FastAPI owns /api/v1, OpenAPI and request/response schemas. Route groups are auth, workspaces, projects, timelines, videos, characters, voices, templates, assets, generation, jobs, pipelines, reviews, publishing, integrations, analytics, usage, billing and settings; implement each when its gate arrives. Do not create empty success endpoints. Generate TS contracts from the actual OpenAPI document. Errors are {error:{code,message},requestId}; use 401 unauthenticated, 403 forbidden, 404 absent or outside workspace, 409 conflicting revision/identity, 422 invalid input, 429 throttled, 503 missing dependency. Unexpected errors expose no stack/secrets. Log request ID/method/path/status/duration, never cookies, passwords or credential-bearing URLs.

Browser traffic uses same-origin /api/v1 proxy with bounded bodies/timeouts and no arbitrary upstream host; forward only needed headers and Set-Cookie. Server pages forward the cookie to the configured fixed API URL. Mutation Origin must equal configured APP_URL, including login/registration/logout; CORS is not a CSRF defense. Do not trust forwarded IP headers without an explicit trusted ingress contract. Fail rate limiting closed when Redis is unavailable.

Reuse salted scrypt credentials and opaque random session tokens: 32 random bytes, SHA-256 stored hash, HttpOnly/SameSite Lax, Secure on HTTPS, bounded expiry, logout revocation. PostgreSQL session/workspace/member records determine access; never trust requested role or workspace ownership. Owner/admin may manage names; editor/viewer may read. Owner transfer/removal and invitations require explicit later workflows. Workspace reads conceal nonmembership with 404. Registration atomically creates user/workspace/owner membership/credit account/one trial transaction/audit. Never grant on login. Normalize emails consistently, catch unique conflicts, bound password byte lengths, and perform dummy scrypt for unknown users. Auth work runs in threadpool handlers, not the event loop.

## Data, migrations and accounting

UUID identities; explicit UTC creation/update timestamps, foreign keys, unique membership/session/ledger keys and indexed ownership. PostgreSQL JSONB is for validated timelines/config/provider metadata, not binaries. Every schema change has Alembic up/down operations; no runtime create_all in deployed applications. Test a fresh upgrade, downgrade and upgrade. Tests may use isolated SQLite only for portable service behavior; PostgreSQL integration tests must prove actual migration/constraint/transaction behavior. Never reset a user database for tests.

Add remaining master-brief entities at their owning phases: projects/versions/timelines/scenes, assets/licenses; characters/references/voices/brands/templates; jobs/events; pipelines/runs/reviews; accounts/destinations/publishing/schedules; usage/notifications/audit; plans/entitlements/subscriptions and credit accounts/transactions. No speculative empty tables. Transactional money uses row locking, uniqueness and immutable reservation price. Persist idempotency intent plus body hash before effects; same key/different payload conflicts. Provider timeout is unknown, not safe to charge/retry twice. Credits cannot become negative; capture/refund/expiry are mutually exclusive and once-only.

## Workers and runtime

Named Celery queues: ai-generation, transcription, asset-generation, video-rendering, publishing, maintenance. Explicit task routing, JSON serialization only, bounded concurrency, late acknowledgement, prefetch 1, time limits, graceful shutdown and Redis visibility timeout exceeding hard task limit. A broker is not the job ledger: generation jobs/events, retries, progress, cancellation and dead letters must persist in PostgreSQL when phase 3 starts. Classify transient/terminal/unknown failures; use bounded exponential backoff only when idempotency permits. No expensive render inside the API or Celery web process. Separate container resource limits and FFmpeg argument arrays.

Docker Compose provides PostgreSQL, Redis, API, Celery and web; render runtime remains separate during migration. Bind development ports to loopback. Require generated credentials through environment, not committed default passwords. Compose supplies `DATABASE_PASSWORD` separately from the password-free internal `DATABASE_URL`; Settings uses SQLAlchemy URL encoding before opening connections. Host processes may keep a complete credential-bearing `DATABASE_URL`. Health checks distinguish liveness from dependency readiness; migrations run before API start, not during requests. Containers must shut down gracefully and run as unprivileged users where possible. Production deployment is gated on backups/restore, persistent volumes, secret manager, TLS, resource/load validation, logs/retention and monitoring. Development configuration is not a production launch recipe.

## Frontend and verification

React Query is server state; Zustand is timeline/selection/playback/history. React Hook Form + Zod validates forms; server validation remains authoritative. Sonner supplies accessible notifications. Use dnd-kit with keyboard alternatives, Recharts for actual observations, shared Remotion composition for preview/export. Vitest/RTL cover frontend behavior, Playwright actual cross-process flows; pytest covers API/data/worker contracts; Ruff and strict mypy cover Python. Run strict TS, ESLint, Prettier, tests and production build. CI uses isolated Postgres/Redis services and test-only provider transports; live suites opt in with credentials. Never claim a phase gate using fixtures alone.

Canonical commands and actual evidence are recorded in README.md and AGENTS.md as implemented. Official references: https://fastapi.tiangolo.com/ , https://docs.sqlalchemy.org/en/20/ , https://docs.astral.sh/uv/ , https://docs.celeryq.dev/en/stable/ . Follow current primary documentation when evolving dependencies.

## PostgreSQL projects and private-storage boundary

Versioned JSON requests have a 1 MiB UTF-8 limit shared by the proxy, FastAPI and browser save clients. This accommodates the shipped editor's 60-scene and multibyte-script bounds; larger imported cue payloads fail explicitly and retain local edits. Test multibyte content above the former 64 KB bound.

Project UUIDs and creation keys are scoped to the authenticated workspace. A creation key is bound to a canonical payload hash; reuse with a changed payload returns 409, and replay of a deleted project does not recreate it. Lists join timeline data in one query and paginate. Current timeline JSONB and normalized scenes update atomically with an immutable ProjectVersion. Validate duration, object uniqueness, frame-safe captions, known fields and media ownership before accepting edits. Presently all nonnull media references are rejected because the private asset lifecycle is not enabled.

Save uses SELECT FOR UPDATE on the project, compares the expected revision, increments once and builds the response snapshot before committing/releasing the lock. Individual reads join project metadata and timeline in one statement and refresh mapped state, so a response cannot pair an old revision with a newer timeline. A coordinated PostgreSQL test commits a second writer between the first commit and HTTP response; the first response must still acknowledge its own revision/content. Soft deletion hides the project and its history from reads while retaining records for recovery; permanent privacy deletion is a later gate.

S3 signing uses a fixed server-configured HTTPS endpoint in production, SigV4, a five-minute expiry, fixed UUID workspace/object paths and MIME/size validation. R2 supports presigned PUT rather than multipart POST: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ . Upload signatures bind Content-Type and Content-Length and target quarantine; download signatures target finalized media. These are internal integration methods, not public upload authorization. Public media endpoints remain closed until persisted ownership/allocation, concurrent quota reservation, provenance, isolated probing, immutable finalization and retention are complete. A bucket HEAD proves connectivity only, not bucket privacy or working upload semantics. Credentials remain SecretStr/server-only; do not log signed URLs. The connection check is owner/admin-only, same-origin and Redis limited. Provider tests use explicit SDK stubs; they are not live bucket verification.

## Compatibility and verification notes

The lockfiles resolve Node 24/Next 16.4.1/React 19.3.1/TypeScript 6.0.3 and matching Remotion 4.0.535 packages; uv uses Python 3.12.13 for local/CI checks. openapi-typescript 7.13.0 declares a TypeScript 5 peer range. Its generation and generated contracts have been verified with the existing TypeScript 6 compiler, while pnpm still reports the peer warning; do not silently suppress it or claim upstream TypeScript 6 support. Starlette's TestClient emits an HTTPX deprecation warning; production HTTPX adapters are unaffected, but test transport migration must be reviewed with the relevant upstream releases. Runtime pnpm audit reports zero advisories; the previously recorded development-only braces advisory is still a separate dependency gate.

`pnpm format:check` verifies repository formatting. Generated API schemas/types and lockfiles are excluded from manual formatting; regeneration must yield a clean diff in CI. Python tests use fresh dedicated PostgreSQL schemas and transaction rollback; default SQLite tests explicitly BEGIN before savepoints to avoid Python SQLite legacy transaction behavior committing fixtures. Real Redis tests namespace limiter keys and never flush a broker. Broker tests require dedicated test services and delete only their own account/workspace fixtures, while the cleanup task itself is intentionally expiry-based.

## Legacy studio reference

The following describes the currently tested Node/SQLite development implementation and remains relevant only until its replacement is verified. Production requirements above take precedence.

## Stack and repository

Node.js 24, Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn-style Button/Dialog primitives using Radix, TanStack Query for server state, Zustand for per-editor timeline/history, Zod for input/provider schemas, SQLite via `node:sqlite`, FFmpeg/FFprobe for media processing/validation, and Remotion for a shared preview/export composition. Stripe uses its official server SDK; AI uses server-only official REST endpoints. Exact versions are pinned by pnpm-lock.yaml; all Remotion packages must match.

SQLite is a deliberate single-machine development/self-hosting choice, not a distributed database claim. WAL and immediate write transactions support separate website/worker processes on the same local filesystem. Do not place this database on an unreliable network filesystem. Multi-machine deployment needs a reviewed transactional database/queue/object-storage migration.

```text
src/app/                  Next layouts, pages and API boundary
src/components/           Workspace pages, editor, forms, UI primitives
src/lib/model.ts          Zod input/timeline schemas and plan tariffs
src/lib/editor-store.ts   Per-editor timeline undo/redo
src/lib/edit-operations.ts Validated command operations
src/server/               Auth, persistence, projects, media, queue, AI, billing
packages/video-engine/    Shared Remotion composition and renderer entry
src/worker/               Queue/scheduler process, generation and rendering
migrations/               Idempotent bootstrap SQL
scripts/                  Database bootstrap command
tests/                    Domain and browser acceptance tests
data/                     Ignored runtime database/assets
.render/                  Ignored renderer bundle/browser cache
```

## Schema and migration policy

`migrations/001_initial.sql` is the idempotent pre-release bootstrap, loaded by the database module. `schema_migrations` records bootstrap version 1. Before making any destructive or data-transforming schema change, replace the bootstrap-only approach with ordered, transactionally versioned migrations and a tested restore procedure. Never rely on editing CREATE TABLE to alter an existing table.

| Table              | Persistent contract                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| users              | UUID, normalized unique email, name, salt:scrypt hash, creation time                                                                         |
| workspaces         | UUID, owner FK, name, nonnegative integer credits, plan/status, unique Stripe IDs                                                            |
| sessions           | SHA-256 opaque token hash, user FK, expiry                                                                                                   |
| rate_limits        | keyed counter/reset timestamp; persisted across worker restarts                                                                              |
| projects           | owner workspace, title/mode/status, timeline JSON, monotonic revision, rendered revision, output asset, description, reminder instant, dates |
| assets             | workspace, UUID filename, name/kind/MIME/bytes/duration/provenance/date; media bytes stored separately                                       |
| characters/presets | workspace, validated JSON record and creation time                                                                                           |
| pipelines          | workspace, config, interval, lifetime run cap/budget, active/next-run, attempts/committed spend                                              |
| jobs               | workspace/project/pipeline, immutable input JSON/revision/price, state/stage/progress/error, lease, unique workspace idempotency key, dates  |
| render_results     | job/project → output asset and revision; staged until atomic completion                                                                      |
| credit_ledger      | workspace/job, operation, signed amount, detail, globally unique operation key, time                                                         |
| usage_events       | workspace/job, category, measured units, metadata, time                                                                                      |
| webhook_events     | processed Stripe event ID/type/time                                                                                                          |
| system_state       | worker heartbeat and pipeline precondition failure records                                                                                   |

All identifiers are generated UUIDs. Times are UTC epoch milliseconds. Durations are media seconds or explicit frame counts. All SQL values are bound parameters; interpolated table names come only from closed server-owned enums. No request controls a path or SQL identifier.

## HTTP contracts

All API routes live under `/api`, return JSON except media/downloads, and use Node runtime. Authenticated APIs derive workspace from the session, never from submitted tenant IDs. Success statuses: 200 for reads/updates, 201 for creations, 202 for queued work. Errors: `{error:string}` with 400 validation, 401 session, 402 quota/payment, 403 origin, 404 missing/foreign record, 409 conflict, 413 size, 429 throttle, 502 provider, 503 configuration. Browser writes require an Origin matching APP_URL. Queue POSTs require a UUID `Idempotency-Key`; repeat keys return the original job.

| Method/path                    | Request → response                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| POST auth/register             | email, name, password → `{ok:true}`, session cookie                                   |
| POST auth/login                | email, password → `{ok:true}`, session cookie                                         |
| GET auth/session               | → user identity or null                                                               |
| POST auth/logout               | → revoke session, expire cookie                                                       |
| GET state                      | → identity, workspace records, ledger, measured usage, worker/config capability flags |
| POST projects                  | validated CreateInput with manual script/gameplay → Project                           |
| GET projects/:id               | → Project                                                                             |
| PATCH projects/:id             | title, Timeline, expected revision → saved Project with incremented revision          |
| POST projects/:id/render       | idempotency header → queued job ID                                                    |
| POST projects/:id/edit-plan    | command → validated proposed timeline/operations/base revision; no mutation           |
| POST projects/:id/review       | action approve/reject/schedule, optional scheduledAt → Project                        |
| GET/HEAD projects/:id/download | → current MP4 attachment; 409 if stale                                                |
| POST projects/:id/duplicate    | → independent project, shared owned asset references                                  |
| POST generate                  | CreateInput and idempotency key → queued job ID                                       |
| POST jobs/:id/retry            | fresh idempotency key → new job ID/reservation                                        |
| POST assets                    | multipart file/provenance/rightsConfirmed=true → validated asset ID/duration          |
| GET/HEAD assets/:id            | → private media with valid single byte-range support                                  |
| POST characters/presets        | corresponding Zod record → saved record                                               |
| DELETE characters/presets/:id  | → delete reusable record, retain historical media                                     |
| POST pipelines                 | name/config/intervalHours/maxRuns/budget → paused pipeline                            |
| PATCH pipelines/:id            | active/name/maxRuns/budget → pipeline                                                 |
| POST pipelines/:id/run         | idempotency key → queued job                                                          |
| POST pipelines/:id/duplicate   | → paused copy with fresh counters                                                     |
| DELETE pipelines/:id           | → delete unused pipeline; pause and 409 when accounting history exists                |
| PATCH settings                 | name/workspaceName → `{ok:true}`                                                      |
| POST billing/checkout          | starter/creator/studio → real Stripe URL                                              |
| POST billing/portal            | → Stripe portal URL                                                                   |
| POST webhooks/stripe           | raw signed Stripe body → receipt; no browser Origin requirement                       |
| GET health                     | authenticated → runtime origin and mode enum                                          |

CreateInput is defined exactly by `createSchema`: title 1–120, enumerated mode, content 1–12000, duration 5–180, aspect 9:16/1:1/16:9, approved voice enum, tone/language, generateImages, optional owned source/preset IDs, up to four characters, 1–5 clips, literal rightsConfirmed=true. User scripts exceeding supported scenes or per-scene text lengths must be rejected, never truncated. See the schema for defaults; clients cannot bypass it.

## Timeline, editor and render parity

Timeline schema version 1 uses 30 FPS and a maximum of 180 seconds/60 scenes. Aspect resolves to 720×1280, 720×720, or 1280×720. Each scene has stable ID, original script, visible caption, durationFrames, background, nullable source/narration asset IDs, mediaStart seconds, sourceVolume, fade/cut, cover/contain, and optional timestamped caption cues with stable IDs/from/to frames. Global settings include font size/colors/placement and background music reference/volume. Cue ranges must fit their scene; object IDs are unique.

Media references are UUIDs, not remote URLs or raw filesystem paths. Save validates ownership/type, video boundaries, narration duration, total duration, and schema. Autosave submits expected revision and returns 409 on concurrent edits. Each successful content save increments revision, clears approval/reminder, and marks draft. The editor holds its own bounded 50-step undo/redo store; server state remains in Query. Failed saves retain local content and support JSON preservation.

`VideoComposition` is used by both Remotion Player and headless rendering. No preview-only visual operations. The worker snapshots the submitted revision so later edits do not mutate a job. Fonts/render settings must remain deterministic for the same runtime, timeline, assets, and pinned renderer/browser. Cross-host byte-identical MP4 output is not promised.

## Queue and automation

Jobs transition queued → running → completed/failed. Claim uses BEGIN IMMEDIATE; running job lease lasts 120 seconds and heartbeats every 15 seconds. Worker publishes its own heartbeat while idle/active; UI calls it online for 60 seconds. Only renderer frame progress yields a percentage. Other stages use names: preparing/script/narration/assets/composition/render/validation/review.

Expired jobs fail and refund once; they are not automatically replayed because a provider call may already have incurred costs. Operator/user retry creates a new idempotency key. Asset outputs are staged under render_results and become project outputs only during successful job completion with a live lease. Completion and credit capture must be atomic; expired/late workers cannot publish refunded results. Preserve newer revisions when an old render finishes.

One worker polls every 1.5 seconds and performs the complete workflow sequentially; multiple workers may claim independently against the same local database. Scheduled pipelines atomically enforce due time, no overlapping run, run cap, total committed budget, subscription status, and wallet. Keys are `schedule:pipelineId:dueEpoch`. A manual run advances next_run by the configured interval. Attempts/budget are lifetime commitments in this release; no calendar-period reset. Failure does not automatically expand the pipeline budget. Pause prevents new triggers, not an already claimed run. Source-change triggers/notifications need a durable outbox in a future migration.

## Providers and media

`AIProvider` exposes script(CreateInput,context), speech(text,voice), image(prompt,referencePath), transcribe(path). `openAI` is the production adapter. Test doubles belong in tests and never enable a production success state. AI endpoint base is fixed; credentials never reach browser state. Requests have a 180-second timeout and provider errors are sanitized.

Script generation uses moderation plus JSON output validated to title/description/1–6 scenes. Script/gameplay modes bypass rewriting. Synthetic speech is saved as MP3, probed, then transcribed to actual timestamp cues. Image generation uses approved reference-conditioned editing when available; review consistency. Source clips use mono 16kHz/32kbps extraction, timestamped transcription, coherent grouping, and duration-fit selection; advanced highlight intelligence is not implemented. Generated provider metadata is retained as measured usage, not fabricated spend.

Uploads allow PNG/JPEG/WebP, MP4/WebM/MOV, MP3/WAV/M4A under 100 MB; request Content-Length is required and bounded. FFprobe verifies stream kind/duration/dimensions. Reject images over 40 megapixels, unsupported/animated image data, invalid durations, and sources over four hours. Never execute filenames or shell-built commands; spawn fixed binaries with argument arrays and timeouts. Filenames are UUIDs. Before public launch, isolate native media/document parsers and enforce per-workspace storage limits; current body buffering is a development limit.

Renderer bundles the composition once per worker, reads owned assets over a token-protected loopback HTTP server, supports ranges for decoding, and runs headless Chromium with render concurrency 2. Verify a responsive render browser before scheduling or claiming work; startup failure leaves queued jobs unclaimed. Reuse one browser for composition and rendering, recover a dead cached instance before creating media URLs, and close resources after each job. Recover expired leases even when Chrome is unavailable. Files are private to the workspace at the app boundary. Validate output H.264 stream, expected dimensions, duration within 0.2 seconds, and nonempty file before success. No frontend render process. No external stock assets are shipped.

## Credits and billing

Wallet writes, queue insertion, reservation, trigger counters and idempotency keys share immediate transactions. Database CHECK prevents negative credits. Reserve decrements wallet; capture is a zero-amount terminal ledger event; failure returns the full reservation once. Ledger keys: trial:workspace, reserve:job, capture:job, refund:job, invoice:invoiceId. Current tariffs are fixed disclosed product units, not an estimate of provider dollar cost. Failed jobs may still have incurred provider spend; the customer credit reservation is nevertheless refunded.

Stripe monthly price IDs map to central Starter/Creator/Studio entitlements. Checkout uses server-derived customer identity and a stable customer idempotency key. Existing subscriptions use the portal. The webhook verifies exact raw bytes/signature, retrieves current subscription state (not event arrival order), validates the configured price, and records event receipt atomically with changes. Only paid subscription_create/subscription_cycle invoices grant monthly credits; proration events do not. Repeated invoices cannot grant twice, even under different event IDs. Payment-delinquent states block new jobs. Canceled subscriptions retain already-paid credits. A periodic operator reconciliation job and real test-mode validation remain release gates.

## Publishing contract and external blockers

The Node personal workflow implements official Instagram Login/Reels and TikTok Login/Direct Post adapters, encrypted account connections and a separate durable publisher. Live credentials and platform approvals remain unverified. TikTok requires per-video review in Clipvero; Instagram may follow owner-authorized automatic approval. Calendar reminders remain manual reminders. PostgreSQL publishing and YouTube are still pending.

Adapters authorize the owner, exchange and refresh encrypted tokens, validate current render/destination metadata, persist submission IDs and reconcile actual outcomes. Never return published from upload acceptance alone. Contract fixtures cover revoked access, timeout after upload, duplicate requests, refresh contention, lease expiry and reconciliation; they do not prove live platform access. Official scopes/app reviews remain required. Unknown writes never automatically resubmit. Signed public media delivery is restricted to the authorized publication and revision.

## Auth, privacy and observability

Passwords use random 16-byte salt and scrypt 64-byte hash; comparison uses constant-time equality and a dummy hash for unknown emails. Session token is 32 random bytes, only its SHA-256 hash persists, expires after 14 days, and is stored in HttpOnly/SameSite=Lax/path=/ cookies. Secure cookie follows configured HTTPS APP_URL. Production registration requires SESSION_SECRET ≥32 characters. This secret also keys privacy-preserving login throttle identifiers; it is not used as an excuse to accept unsigned client identity. Login throttles by normalized account, registration additionally has a global ceiling. Proxy/IP abuse limits and verified email are pending prelaunch work.

Never log passwords, cookies, AI keys, Stripe secrets, OAuth codes or asset-server tokens. Structured worker logs contain job/workspace/event/failure. API unexpected errors retain details server-side but send a generic message. All user text renders escaped through React. Baseline headers disable embedding, sniffing, and unnecessary permissions; CSP, HTTPS/HSTS and reverse-proxy limits require deployment review. Keep a request/support correlation strategy and alert/error collection in the public-launch phase.

## Configuration

| Variable                            | Meaning                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| APP_NAME                            | Workspace brand label, default Clipvero; some initial marketing copy uses Clipvero            |
| APP_URL                             | Canonical origin; default http://localhost:3000; exact match for browser writes/Stripe return |
| DATA_DIR                            | Database/media directory, default ./data; web and worker must agree                           |
| SESSION_SECRET                      | Random ≥32 chars for public production; never committed                                       |
| OPENAI_API_KEY                      | Optional real provider key; absent disables AI                                                |
| OPENAI_TEXT_MODEL                   | Default gpt-4.1-mini; account/model access must be validated live                             |
| OPENAI_SPEECH_MODEL                 | Default gpt-4o-mini-tts                                                                       |
| OPENAI_IMAGE_MODEL                  | Default gpt-image-1                                                                           |
| STRIPE_SECRET_KEY                   | Stripe server key                                                                             |
| STRIPE_WEBHOOK_SECRET               | Exact endpoint signing secret                                                                 |
| STRIPE_PRICE_STARTER/CREATOR/STUDIO | Monthly prices with intended amounts/allowances                                               |
| FFMPEG_PATH/FFPROBE_PATH            | Optional system binary paths; bundled defaults otherwise                                      |

Next loads .env; worker/migration scripts load it explicitly. Never put secrets in NEXT_PUBLIC variables. .env.example contains empty credentials only. Restart both processes after provider/env changes. Use actual HTTPS APP_URL and operator-owned keys for a real integration test; lack of credentials remains a blocker, not fabricated coverage.

## Development, tests and deployment

Commands are in package.json: dev:all, dev, worker, db:migrate, check, typecheck, lint, test, test:e2e, build, start. Use Node 24 on Windows/Linux/macOS. The worker needs a compatible Chromium/headless-browser install and system dependencies. pnpm install --frozen-lockfile downloads FFmpeg/FFprobe. The browser acceptance suite uses a dedicated Playwright browser profile, development accounts and real renders; never run against production data. Domain tests use a temporary database and remove only their verified temp directory.

Verification layers: schema/domain invariants, cross-workspace HTTP cases, test-only provider/webhook adapters, a complete browser workflow, real render/FFprobe, responsive screenshots, and accessibility checks. Runtime warnings for Node 24's experimental SQLite API are expected; browser console errors and failed requests need investigation. CI must typecheck/lint/test/build and run browser/render tests on a writable ephemeral volume; no provider secret required for manual export. Live AI, Stripe and platform tests are separate opt-in release gates.

Deploy separate long-running Node web/worker processes on one host with a shared persistent data volume and reverse-proxy HTTPS. Stateless/serverless deployment is unsupported. Build before starting services. Run production start under an operator-owned process supervisor, terminate worker gracefully, allow active jobs to finish or expire safely. Resource-limit media processes, reserve disk space, monitor queue age/failures/heartbeat, and back up DB/media consistently. Restore and inspect a backup before public launch. Retain lockfile and release artifact to roll back code; data migration rollback requires explicit review.

## Production readiness checklist

Dependency audit on October 14, 2026: `npm audit --omit=dev` reports zero runtime vulnerabilities. The full audit reports five high-severity dependency entries from one development-only `braces` stack-exhaustion advisory propagated through Next's lint configuration. npm currently offers no patched `braces` release; do not downgrade Next to an unrelated major or run a forced audit fix. Keep lint inputs trusted and recheck the upstream fix before public release. This does not satisfy the broader launch checklist.

Review third-party licensing before commercial distribution, including Remotion's commercial terms and the bundled FFmpeg build's license obligations. Remotion's own Player prints a license notice; this project does not assert that a commercial license has been obtained. See the [Remotion license](https://www.remotion.dev/license).

- [ ] All advertised template/character/source/publishing capabilities meet their AGENTS.md gates.
- [ ] Email verification/recovery/password change, owner session revocation, account/data deletion and retention implemented.
- [ ] Workspace roles/invitations and cross-role authorization validated if team access is enabled.
- [ ] Native parser sandbox, upload/storage quotas, pagination and capacity limits verified.
- [ ] HTTPS origin/cookies/CSP/HSTS, abuse throttles and redacted logging reviewed.
- [ ] Real AI script/narration/image/transcription test; model availability and costs accepted by operator.
- [ ] Stripe signed replay/order tests and real test-mode purchase/portal/cancel/reconciliation passed.
- [ ] Each official social integration passes consent/scopes/refresh/upload/status/DST/retry tests.
- [ ] Measured usage units, premium tariffs, customer balances and refunds reconciled.
- [ ] Media retention/cleanup, consistent backups and restore drill passed.
- [ ] Accessibility/manual keyboard/mobile, load, queue recovery and late-worker tests pass.
- [ ] Dependency/runtime vulnerability review and third-party licensing review complete.
- [ ] Alerts/support/rollback ownership, legal terms/privacy and incident process in place.

This checklist is deliberately open. The current implementation is an early runnable development release.
