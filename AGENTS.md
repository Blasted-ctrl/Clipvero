# Clipvero: product and execution contract

Clipvero helps independent creators, educators, and small marketing teams turn their own ideas and media into short videos. Configure a style once, then create, edit, review, render, and eventually publish recurring content. The working name is configurable with APP_NAME. Use original assets and characters, official integrations, and honest capability states.

## Repository rules

- Keep product specifications here, visual specifications in UI.md, and engineering contracts in CODING.md. README.md is the requested quick-start guide. Create no other original planning Markdown files.
- Never add AI or assistant co-author trailers to commits. Never commit credentials, .env files, runtime media, databases, build output, or test artifacts. Keep .env.example as an empty configuration template.
- Every visible action must have a defined result. Do not invent projects, job progress, balances, publishing successes, or analytics. Provider fixtures belong in tests only.
- Validate tenant ownership at every server boundary. Use transactions for credits, queue claims, webhooks, and idempotency. Never publish without an approved rendered revision and explicit destination authorization.
- Render and preview must use the same versioned timeline. Store media separately. A stale render cannot be approved or downloaded as the current revision.
- Run type checks, lint, domain tests, browser workflows, and an actual MP4 render before claiming those paths work. Record verification and limitations below.

## Release priorities and acceptance

1. Foundation: accounts, private workspaces, durable projects, structured timelines, local assets, browser editing, background rendering, review, transactional credits, and job history. A fresh install must create an account, make a script video, save/reopen edits, render a valid MP4, approve, and download it without provider credentials.
2. Assisted creation: provider-backed scripts, narration, original images, character reference records, creator presets, and manual/scheduled review-first pipelines. Missing credentials must produce actionable errors before charging. Preserve user scripts unless rewriting was requested.
3. Source processing: authorized uploads, timestamped transcription, coherent highlight candidates, source review for explainers and marketing, document extraction, character dialogue and consistency. Candidate times must refer to real source media; no performance predictions.
4. Commercial release: verified Stripe subscriptions, official OAuth publishing for YouTube, TikTok, and Instagram, analytics, team invitations, recovery email, storage hardening, backups, and production operational validation. No public production claim before these gates pass.

## Users, tenancy, and workflows

A creator owns an account and a private workspace with projects, reusable assets, fictional characters, presets, pipelines, jobs, a credit ledger, subscription state, and scheduled review reminders. Workspace membership is the authorization boundary. A creator starts from a prompt or an unchanged script, picks a format, adjusts scenes, renders, reviews, and downloads. An educator reviews claims and source provenance before export. A marketer supplies approved product information and brand media; never invent endorsements or claims. A future team reviewer will approve a specific rendered revision; invitations and delegated roles require a later release gate.

## Feature contracts

Each contract specifies behavior, input/output, data/backend duties, failures, and acceptance. Status is recorded below; a specification is not evidence of implementation.

| Feature                  | Behavior and inputs → outputs                                                                                                    | Data and backend duties                                                                                                         | Failures and testable acceptance                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts/workspaces      | Name/email/password → session and private owner workspace                                                                        | Salted password hash, opaque session hash, workspace authorization, rate limits                                                 | Reject duplicate/invalid credentials; another owner cannot read any project/asset; production needs secure configuration                            |
| Activation               | Empty dashboard → first script project and exported video                                                                        | Explicit one-time 120-credit trial ledger entry                                                                                 | New signup never inherits another user's cached data; grant happens once                                                                            |
| Prompt video             | Topic, tone, language, aspect, target duration, voice, visuals → generated script, scenes, media, metadata, MP4                  | Server provider adapters, moderation, persisted timeline/assets, measured audio duration, queue                                 | Missing key fails before reservation; provider failure refunds; output requires real render validation                                              |
| Script video             | Supplied words, scene breaks, aspect/duration → unchanged editable scenes                                                        | Preserve all accepted paragraphs, reject unsupported counts, optional synthetic narration                                       | No silent truncation/rewriting; >60 scenes rejected; no-key manual path exports                                                                     |
| Fictional characters     | Original identity, personality, appearance, voice preference, speech, approved image, continuity, ownership → reusable character | Tenant-owned references; include descriptors and approved reference in provider request                                         | No protected packs or impersonation; deletion preserves existing media; reference-conditioned output still needs review                             |
| Character continuity     | Approved reference/settings history, expressions, dialogue, groups, series history → consistent recurring cast                   | Future versioned reference records, per-line voice tracks, continuity updates only after approval                               | Pending; gate requires two episodes, multiple speakers, expression changes, animation and explicit consistency limitations                          |
| Authorized stories       | Original/licensed story, hook, ending question, background → narration/captions/music/story video                                | No scraping; story mode uses only supplied authorized material                                                                  | Rights confirmation required; reject unsafe content; never claim third-party licensing automatically                                                |
| Gameplay                 | Owned/licensed footage, script, background volume → captioned narrated gameplay video                                            | Probe source, crop/fill, source in, licensed provenance, music mix                                                              | Current editor rejects footage overrun; automatic looping and length matching remain pending; accept only verified final duration                   |
| Explainers               | Topic/source text/authorized document/URL context → source-grounded educational short                                            | Current pasted-text context; future safe extraction, source citations, fact-review records and diagrams                         | Never invent citations or call claims verified; gate needs source review and accurate provenance                                                    |
| Marketing                | Approved product facts, screenshots/demo, audience, CTA → product scenes/script/variations                                       | Keep claims grounded in supplied content; store brand assets                                                                    | No invented testimonials/capabilities/results; multiple hooks/variation comparison and URL extraction pending                                       |
| Auto-clip                | Uploaded source, requested count, target aspect/duration → timestamped excerpt candidates and renders                            | FFmpeg audio extraction, real timestamped transcription, coherent grouping, duration-fit ranking, preserved source audio        | Reject missing speech/invalid source; accurate cuts. Silence/scene detection, diarization, speaker tracking, topic highlight ranking remain pending |
| Templates                | One of ten named scene/layout/caption/narration/media configurations → editable timeline defaults                                | Future explicit template registry with schema, compatible modes and rendering rules                                             | Pending; gate requires all ten produce distinct valid timelines, supported overrides, same preview/export behavior                                  |
| Creator presets          | Colors, caption size/position, voice/tone/audience preferences → saved reusable preset                                           | Current visual settings apply to new manual/generated timelines; preferences are explicit in form                               | Reject foreign assets; no mutation of past projects. Logo/fonts/music/template and publishing preference propagation pending                        |
| Assets                   | Image/audio/video + license/provenance → private validated media record                                                          | MIME allowlist, FFprobe content/duration/dimensions, generated UUID filenames, separate storage                                 | Reject unsupported, mismatched, empty/oversized media; foreign/missing assets return 404; isolate parsers before public launch                      |
| Editing                  | Structured scenes/assets/tracks/settings → versioned timeline                                                                    | Source of truth supports trims/order/text/color/music/source audio/transitions/aspect; optimistic concurrency                   | Autosave conflict preserves edit; undo/redo restores actual model; no preview-only effects                                                          |
| Caption timing           | Narration or speech transcript → stable cue IDs and frame ranges                                                                 | Actual transcription timestamps; scene edits can explicitly replace cues                                                        | Reject invalid or out-of-scene timestamps; no estimated speech synchronization presented as exact                                                   |
| Natural-language editing | Instruction → validated operation proposal → confirmed timeline mutation                                                         | Provider-backed operation plan or labeled deterministic quick edits; no unaffected-media regeneration                           | Reject unsupported operations/stale proposals; destructive changes reviewed; undo required. Advanced voice/asset regeneration pending               |
| Rendering                | Immutable saved timeline/assets → validated H.264 MP4                                                                            | Independent Remotion worker, FFmpeg/FFprobe, real frame progress, compare dimensions and duration                               | Worker expiry/failure refunds once; late output cannot become current; stale revision cannot approve/export                                         |
| Pipeline configuration   | Mode/content/style/interval/run cap/budget → paused reusable automation                                                          | Current owner workspace, JSON config, committed budget and lifetime attempts, next UTC instant                                  | Validate configuration; missing key prevents activation; edit limits cannot spend past cap                                                          |
| Pipeline execution       | Manual or interval trigger → reserved job → generated/rendered review item                                                       | Transactional trigger key, no overlap, source resolution, job/usage/ledger linkage                                              | Duplicate triggers enqueue once; failure pauses or records error; resume never auto-publishes                                                       |
| Additional triggers      | Authorized upload or newly approved source → content run                                                                         | Future source-event records/outbox, source deduplication and authorization                                                      | Pending; repeated upload event must not double-enqueue or spend twice                                                                               |
| Review                   | Actual rendered revision → approve/reject/edit/download                                                                          | Review states bind to current revision; description retained                                                                    | Never approve stale output; rejection returns draft; regenerate and per-destination metadata pending                                                |
| Calendar                 | Approved video + local future time → UTC manual reminder                                                                         | Date persisted, displayed in browser timezone                                                                                   | Current reminder does not publish. Real scheduler needs IANA zone/DST, authorized destinations and explicit publish consent                         |
| Social publishing        | Official OAuth account + approved render/metadata/schedule → provider submission and verified public URL/status                  | Pending full adapter, encrypted refresh tokens, least-privilege scopes, resumable uploads, provider poll/webhook reconciliation | No false success; unknown outcomes require reconciliation before retry. YouTube/TikTok/Instagram app credentials/review and real tests required     |
| Billing                  | Configured monthly price → Stripe Checkout/portal → reconciled subscription                                                      | Signed raw-body webhooks, actual subscription retrieval, recognized price mapping, invoice-key allowance grant                  | Replays grant once, no credit on redirect, no duplicate active checkout; real test-mode/live validation pending                                     |
| Quotas/credits           | Estimated tariff → reserve/capture or refund                                                                                     | SQLite immediate transactions, nonnegative wallet, unique ledger key, immutable job price                                       | Concurrent jobs cannot overspend; retry has fresh reservation; expiry/refund exactly once; paid invoice allowance grants idempotent                 |
| Usage analytics          | Completed processing → categorized measured usage and production metrics                                                         | Text provider metadata, narration characters, images, transcript/render seconds; workspace-scoped aggregation                   | No invented engagement. Storage/source-processing/regeneration charging and social metrics pending                                                  |
| Recovery/support         | Job/error/history → retry after resolving cause                                                                                  | Worker heartbeat, leases, persisted failure reason, local structured logs, credit history                                       | No blind automatic provider rerun after a crash; admin support console/alerts/email notification pending                                            |
| Security/privacy         | User input/provider data → validated private operations                                                                          | Origin validation, HttpOnly/SameSite sessions, hashes, SQL parameters, no secrets in client, uploaded rights                    | Public release requires verification/recovery, deletion/retention, parser isolation, rate-limit scaling, backup restore and security audit          |

## Templates required for the commercial release

The registry must include fictional character conversation (dialogue/multiple voices/reference images), narrated gameplay story (licensed loop/background/narration), original dramatic story (hook/escalation/ending), educational explainer (sources/diagrams), product advertisement (facts/CTA/brand), podcast highlight (accurate source times/captions), talking-head short (speaker crop), animated facts (source-backed fact scenes), quiz (question/pause/reveal), and motivational narration (original script/music). Each entry must store scene structure, layout, captions, animation, narration rules, media requirements, default duration, customizations, and deterministic rendering behavior. Current modes are not substitutes for a verified template registry.

## Credit and subscription policy

One standard video is at most 60 seconds and includes one text plan, synthetic narration with timestamped caption alignment, up to six images, and a final render: 10 credits under default tariffs. Render-only is ceil(seconds/60), script generation 2, narration/alignment 2, optional scene images 5. Manual script creation costs no credits until an operation queues. Clip extraction reserves ceil(target seconds/60) + 5 per requested excerpt. Character-conditioned visuals use the image tariff. No premium video-generation provider is enabled.

Starter $29/month grants 120 credits (12 standard videos); Creator $79 grants 400 (40); Studio $199 grants 1200 (120). Entitlements live in the central plan table. Paid monthly allowances accumulate; plan-change prorations do not create a second allowance. One-time trial balance is 120, independent of paid billing. Reservation fixes the disclosed job price, capture finalizes it, and a failed job refunds it once. Provider account costs are separate. Future metered premiums/storage need explicit estimates, reconciliation, and customer-visible units before enabling.

## Execution phases and completion gates

### Phase 1 — Durable local production loop

1. Objective: signup → script → editor → real MP4 → approve/download.
2. Prerequisites: Node 24, writable disk, FFmpeg/FFprobe, renderer browser.
3. Modules: lib/model, server/auth/db/projects/jobs/media, video, worker, app, editor UI.
4. Database/API: users/workspaces/sessions/projects/assets/jobs/render_results/ledger; authenticated CRUD/render/review/media routes.
5. UI: public/auth, Overview, Create, Projects, Editor, Review, Calendar.
6. Background: durable poller, atomic queue claim, heartbeat, expiry recovery, independent render.
7. Security: owner authorization, validation, origins, private files, nonnegative wallet.
8. Tests: domain invariants, browser complete path, actual media probe, viewport/keyboard checks.
9. Gate: all checks and real output pass; stale/failed output cannot be presented as current.
10. Limits: single-machine storage, owner-only tenancy; public deployment gate remains closed.

### Phase 2 — AI-assisted creation and reuse

1. Objective: prompt/script/story/explainer/marketing/character inputs produce editable narrated media through real providers.
2. Prerequisites: Phase 1; authorized provider credentials and billing access.
3. Modules: server/providers, worker/generate, character/preset services and UI, provider tests.
4. Database/API: character/preset records, generation jobs, usage events and edit proposals.
5. UI: creation controls, character references, saved styles, actionable capability errors.
6. Background: moderate, script, synthesize, transcribe captions, generate images, compose/render.
7. Security: server-only secrets, provider output schemas, content rights, synthetic-voice disclosure.
8. Tests: provider fixture contract/error tests plus real configured script/speech/image calls.
9. Gate: real authorized runs validate all outputs, accurate narration/cues, original script preservation, failure refunds.
10. Limits: credentials unavailable in this session; no claim of verified live AI.

### Phase 3 — Recurring automation

1. Objective: durable review-first manual/scheduled pipelines with budgets and history.
2. Prerequisites: Phases 1–2 provider contract; reliable worker clock.
3. Modules: server/pipelines, worker scheduler, pipeline form/history/limits UI.
4. Database/API: pipeline config/next-run/attempt/budget records and trigger keys; create/pause/resume/run/edit/duplicate/delete.
5. UI: paused setup, explicit activation, measured runs/spend, errors and history.
6. Background: atomic scheduled trigger and overlap prevention; outbox for future upload/source events.
7. Security: workspace scope, subscription/quota, max spending, explicit review end state.
8. Tests: duplicate scheduled trigger, concurrent scheduler, exhaustion, restart, provider error, pause/resume.
9. Gate: real scheduled generation once per due slot, no unauthorized publication, budget enforced across workers.
10. Limits: lifetime caps/current interval semantics; source events and notifications pending.

### Phase 4 — Advanced creative formats

1. Objective: full template registry, character dialogue/animation/continuity, gameplay looping, quiz/marketing variations.
2. Prerequisites: verified Phase 2 assets and composition parity.
3. Modules: future lib/templates and character continuity, video tracks/effects, editor controls.
4. Database/API: versioned templates/characters/groups/series, operation history and regeneration references.
5. UI: template chooser, expression/reference approval, per-speaker voice, variation review, caption/animation controls.
6. Background: scene-local regeneration, reference conditioning, multiple voice alignment, loop/crop assembly.
7. Security: license checks and approved references; no unauthorized characters or imitation.
8. Tests: all ten templates render; voice/cue alignment, continuity, scene-local regeneration and undo.
9. Gate: user can produce and edit every named format with render parity.
10. Limits: partially specified boundaries exist; registry, animation and multi-speaker implementation pending.

### Phase 5 — Source intelligence

1. Objective: authorized URLs/documents and long videos become grounded explanations or quality highlight candidates.
2. Prerequisites: Phases 1–2, source rights, isolated parsers and bounded network access.
3. Modules: future source extraction/fact review/highlight analysis; current FFmpeg/transcription excerpts.
4. Database/API: source documents/transcripts/citations/segments/speaker candidates and processing status.
5. UI: source review, transcript corrections, candidate boundaries/ranking reasons, crop controls.
6. Background: audio/scene/silence detection, diarization when feasible, coherent topic ranking, reframing, renders.
7. Security: DNS-pinned SSRF prevention, redirects and response limits, sandboxed documents/media, provenance.
8. Tests: private IP/redirect rejection, malicious/large documents, exact clip boundaries, source citations, source audio preserved.
9. Gate: accurate authorized source ingestion and candidates; no fabricated performance prediction.
10. Limits: current transcript-based duration-fit excerpts are implemented but live transcription unverified; advanced analysis and safe URL/PDF extraction pending.

### Phase 6 — Commercial billing and accounting

1. Objective: real subscription lifecycle, checkout/portal, allowances, categorized usage and quotas.
2. Prerequisites: Stripe account, monthly price IDs, webhook secret and accessible endpoint.
3. Modules: server/billing, webhook route, billing/history UI, reconciliation tests and operational job.
4. Database/API: Stripe customer/subscription IDs, webhook receipts, invoice ledger keys, plan state.
5. UI: configured plan actions, actual balance/history, payment status, portal upgrade/downgrade.
6. Background: webhook retry/reconciliation, future alerting and measured premium settlement.
7. Security: signature verification, price allowlist, owner identity, unique customer/active subscription.
8. Tests: signed fixtures, duplicate/out-of-order invoices, concurrent checkout, payment failure, cancel/upgrade/downgrade and real test-mode purchase.
9. Gate: no allowance on redirects or duplicate webhook; correct live reconciliation and quotas.
10. Limits: code boundary present; Stripe credentials/tests unavailable. Premium video, storage pricing and support reconciliation pending.

### Phase 7 — Official publishing and performance

1. Objective: OAuth account connection → approved schedule → verified platform post and analytics.
2. Prerequisites: phases 1/3/6, HTTPS storage, platform developer apps, scopes/app review.
3. Modules: future publishing adapters, OAuth/state/encryption, scheduler/outbox/status reconciliation.
4. Database/API: encrypted account tokens/scopes, immutable approved publication records, submission IDs/URLs/errors/retry eligibility.
5. UI: Connect/Reconnect/Disconnect, destination privacy/account preview, consent, scheduled posts, actual outcomes/analytics.
6. Background: official upload APIs, token refresh, result poll/webhook, safe retries and notifications.
7. Security: one-time state/PKCE where supported, least privilege, encrypted refresh tokens, revision/destination approval, no duplicate upload after unknown outcome.
8. Tests: deterministic test-only adapters, revoked/expired scopes, provider validation, ambiguous upload timeout, DST schedules, verified authorized post on each platform.
9. Gate: YouTube/TikTok/Instagram live tests and required reviews pass; never mark a submission published without provider evidence.
10. Limits: no live connection or publishing implementation is claimed; MP4 download/manual calendar is the current fallback.

### Phase 8 — Public launch and operations

1. Objective: supported commercial service with security, privacy, reliability and recovery validated.
2. Prerequisites: all applicable earlier gates; operator ownership of hosting/credentials/support.
3. Modules: verification/recovery/deletion, memberships/roles, object storage, observability, backup/support tools.
4. Database/API: membership/invitations, recovery tokens, audit/retention/deletion state, durable notifications.
5. UI: complete onboarding, account lifecycle, teams, privacy/legal, support and accessible mobile review.
6. Background: email outbox, retention/cleanup, backups, reconciliations, alerts and storage lifecycle.
7. Security: parser sandbox, CSP review, upload storage quotas, session revocation/abuse controls, redacted logs.
8. Tests: restore drill, load/queue isolation, failover, accessibility, end-to-end integration suite, threat review.
9. Gate: production checklist in CODING.md satisfied, rollback/restore tested, no critical/high runtime vulnerabilities, actual operational owner acceptance.
10. Limits: this phase is not complete; do not market this development build as production-ready.

## Current progress

- Public marketing polish: replaced the generic AI-studio hero with an editorial brief composer and original illustrated scene workflow; scoped warm charcoal/ivory styling, simpler navigation, calmer pricing/cards, shorter homepage, updated social image and explicit preview disclosures. Removed glow grids, text shimmer, rotating borders, pointer spotlights and the continuously moving poster strip. Runtime storage remains ignored; static marketing content now stays tracked.
- Verified the polish against the production build: TypeScript, ESLint and all 41 domain/content tests pass. All 46 browser checks pass, including 43 public-site cases and the existing workspace/security/real-MP4 workflows. Automated WCAG checks pass on home/features/Autopilot/pricing; responsive checks pass at 320/375/768/1024/1440px. Independent code review reports no required findings. No paid AI, billing or publishing verification is implied.

- Repository inspected: initial commit contained only README.md.
- Verified on October 14, 2026 with Node 24 on Windows: type generation/type checking, lint, production build, and 17 domain/provider/Stripe contract tests pass. A deliberately inverted quota guard was caught by the tests and restored.
- All three browser acceptance tests pass against the production build: signup/workspace accessibility checks; cross-workspace media/project isolation, invalid uploads and Origin checks; and the complete edit/render/approve/download/reminder workflow. Responsive checks pass at widths 320, 768, 1024 and 1440.
- The production workflow was additionally verified with real uploaded PNG and WAV assets. The resulting two-second MP4 has a 720×1280 H.264 video stream and an audio stream, checked with FFprobe. Internal editor navigation flushes unsaved edits before leaving.
- Provider and Stripe tests use explicit test-only transport fixtures. No live AI request or paid transaction is implied. GitHub CI is configured but has not been observed running remotely.
- Implemented local surfaces: accounts, workspace, script editor, assets, characters/presets, jobs/review, manual calendar, billing/provider boundaries, and interval pipelines. Implemented is distinct from externally verified.
- Pending functionality is named in the inventory/phases above. No social post, live AI generation, or Stripe purchase has been verified.
