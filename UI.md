# Clipvero visual and interaction specification

## Foundation migration surface

Retain the existing dark violet studio identity, typography, spacing, focus treatment and responsive shell described below. Foundation mode is a real authenticated workspace dashboard backed by FastAPI. Its navigation exposes only working Overview and Settings destinations; explain once that project/media tools are being migrated. The legacy development studio remains a separate explicit process configuration. Do not present empty legacy projects as migrated Postgres data.

Registration/login preserve the existing compact labeled form, with React Hook Form and Zod field validation, disabled submit while pending, accessible field errors and server failure message. Successful auth reaches Overview. Logout revokes the actual session and clears cached state. No demo identity or fabricated activity. Session expiry returns to login; an unreachable API displays an actionable retry state, not a login redirect.

Overview shows the actual signed-in name, workspace name, membership role and credit balance returned by the protected API. No fake engagement/chart/placeholder project. Offer a real workspace-settings action and concise availability notice. Settings loads current account/workspace fields, permits account-name changes, restricts workspace rename to owner/admin, persists updates and confirms success with Sonner. Failed updates retain typed values. Theme control switches dark/light with persisted browser preference, readable contrast and reduced-motion support. Sidebar becomes a labeled mobile drawer; all actions remain keyboard accessible.

Loading skeletons describe the pending resource; empty states explain the next available action; errors provide retry without erasing input. Root and studio error boundaries permit recovery and never expose internal stack traces. API errors have a human message plus request ID for support. Test desktop and 320px layouts, protected-route redirect, complete signup/logout/login/settings, tenant isolation, keyboard/focus, contrast and actual persistence.

Later phases extend the same visual system: phase 2 project/assets/autosave states; phase 3 measured render progress and preview/export parity; phase 4 honest provider configuration and synchronized generation; phase 5 character/voice/reference approvals and working format previews; phase 6 editable coherent clip candidates and undoable proposals; phase 7 budgets/schedules/history/review; phase 8 real reconciled billing; phase 9 approved destinations and explicit consent; phase 10 source-labeled real metrics; phase 11 privacy/deletion/recovery/support. Recharts has no data until measured metrics exist; dnd-kit must also support keyboard reordering. Do not ship nonfunctional buttons or claim unconfigured integrations work.

## Existing studio design system and workflow specification

# Clipvero interface specification

AGENTS.md defines product acceptance and progress. This file defines the intended interface and labels later surfaces explicitly. Never present pending functionality as an active control.

## Visual contract

Help a creator move from an idea to a reviewable video. Use a compact production workspace, clear status, one strong page action, and room for media previews. The supplied brief is the visual reference: dark creative software, restrained violet, sober typography, visible borders, and minimal motion. No copied layouts, protected artwork, fictional metrics, glass panels, gratuitous gradients, or oversized rounded cards.

| Token             | Value   | Use                                                          |
| ----------------- | ------- | ------------------------------------------------------------ |
| Background        | #09090B | Main canvas                                                  |
| Surface           | #111115 | Panels and sidebar                                           |
| Secondary surface | #18181D | Controls and selected items                                  |
| Interactive       | #22222A | Hover state                                                  |
| Primary text      | #F5F5F7 | Essential content                                            |
| Secondary text    | #A1A1AA | Descriptions                                                 |
| Muted text        | #85858F | Small metadata, raised from the brief's #71717A for contrast |
| Accent            | #8B5CF6 | Primary actions and selection                                |
| Accent hover      | #A78BFA | Focus and links                                              |
| Success           | #22C55E | Labeled success state                                        |
| Warning           | #F59E0B | Review state                                                 |
| Error             | #EF4444 | Error borders/icons; use lighter text                        |
| Border            | #29292F | Boundaries                                                   |

Use Inter/Geist where installed, then Segoe UI/Arial. Do not depend on an external font request. Media compositions use Arial in both preview and export. Use Geist Mono/Consolas for identifiers and frame counts. Sizes: 28–30px page titles, 16px sections, 14px body, 11–12px controls, 9–10px secondary metadata. Essential instructions never live only in tiny metadata. Use 4px spacing increments, 8px panel radii, 6px controls, 4px badges, and 36px desktop gutters.

## Shared components and navigation

Primary button backgrounds use #7C3AED with #8050E5 on hover so white action labels meet contrast requirements. The requested #8B5CF6 remains the brand/selection accent. Inline authentication links are underlined as well as colored.

- Buttons: primary, secondary, ghost, danger; action verbs; request loading/disabled state; visible failure. Icon-only controls have accessible names.
- Dialog: Radix focus trap, Escape, visible title, description, labeled close, focus restoration. Ambiguous/destructive proposals require review.
- Inputs: connected labels, browser and server validation, visible focus, values retained after failure. Errors announce through `alert`, saves/success through `status`.
- Status: words plus color marker. Only measured render progress gets a percentage. Other stages use words/counts.
- Empty state: explain the area and give an applicable next action. Loading/error states provide understandable text and retry.
- Sidebar: Overview, Create, Projects, Character Studio, Pipelines, Review Queue, Calendar, Analytics, Asset Library; Settings, Billing, Help at bottom. Show actual credit balance and account. Desktop collapse retains labeled icons; mobile uses a dismissible drawer.
- Header: workspace context, area, worker availability, help, account initials. The workspace badge is informational; workspace switching is pending.
- Toasts are dismissible and time limited. Persistent job failure details remain in Projects.

## Page contracts

### Public home

Product headline, original typographic storyboard, workflow, three configured price offers. Navigation jumps to workflow/pricing or sign-in/sign-up. Main action opens sign-up. Clearly disclose configuration-dependent billing. Authenticated visitors go to Overview. No claims of live AI verification or social publishing.

### Authentication and onboarding

Focused form beside an original editorial visual. Registration collects name/email/12–128-character password; sign-in collects email/password. Submit validates, establishes a session, and opens Overview. Show duplicate account, invalid credentials, production configuration, and throttle errors inline. Starter balance is a one-time grant. Empty Overview guides the first script creation. Email verification, recovery, invitations, and deletion remain prelaunch work.

### Overview

Personalized heading and Create video. Four real metrics: rendered videos created this month, credits, active pipelines, review count. Banner links to creation and autopilots. Four quick format links open creation details. Recent projects open the editor. Activity shows real queue stages, timestamps, and measured rendering progress. Footer reports reminder count and unavailable social connections. No fabricated projects in empty accounts.

### Create wizard

First choose one of eight formats. Details include name, script/topic/authorized source text, target duration, aspect, language, voice, tone, preset, optional footage, illustrations, character references, and rights confirmation. Script mode preserves words; blank lines create scenes. TXT/Markdown import fills the script from a local document. Source URLs remain context; safe website fetching and PDF parsing are pending.

Side summary explains outcome and credits. Manual editing needs no AI key. Missing AI configuration disables generation with setup guidance. Submit opens the editor for a manual project, or queues provider work and opens Projects. Failure retains inputs. Clip mode explains timestamped excerpts, count and source selection, duration-based ranking, and no performance predictions. Generated narration determines the final measured duration.

### Projects and jobs

Title search and All/Draft/Review/Approved filters. Cards use real timeline caption/color storyboard thumbnails, duration, aspect, status, and date. Opening a card loads Editor. Job history shows kind, ID, state, stage, reservation, date, failure details, and failure-only retry. Explain refunds and an offline worker. Retry is a fresh reservation. Projects/jobs are capped at 200/100 in this release; pagination is pending.

### Character Studio

Cards show approved image or neutral icon, description, personality, voice preference, appearance, speech style, continuity, and original ownership. New dialog collects those fields and rights confirmation; references must be owned library images. Remove deletes the reusable record while preserving existing media. Reference version history, groups, expression libraries, multi-voice dialogue, series continuity updates, and animation remain pending; show no nonfunctional controls.

### Video editor and preview

Top: editable name, truthful save state, undo/redo, Save, current View MP4, Render. Left: Scenes/Assets/Style. Center: shared Remotion preview with native play/pause/seek/volume controls. Right: selected scene. Bottom: proportional scene timeline, audio track, edit-command field.

Scene selection seeks to the start. Add/duplicate creates stable IDs; move reorders; last-scene deletion is disabled. Source in/duration trim the media. Caption editing replaces timed cues with a scene-wide caption and explains that change. Script edits detach old narration. Audio/media selectors use owned assets; source volume is separate. Style sets aspect, caption size/colors/position, music, and volume. Fade and cut are current transitions. Additional fonts/effects are pending.

Autosave waits 1.2 seconds. Errors preserve local edits and offer retry/unsaved JSON download. Conflicts require reload or preservation, never silent overwrite. Render flushes the save, queues its revision, and shows measured progress. Older renders cannot be exported as current. MP4 preview uses the actual file and offers download, approval, then reminder scheduling.

Edit instructions use a real provider proposal when configured, or an explicitly deterministic parser otherwise. Current operations: caption/accent color, placement, music volume, duration, scene caption replacement, scene removal. Show validated operations, require Apply, reject a stale proposal, allow undo. Natural-language voice regeneration, pause removal, and image replacement remain pending; direct controls remain available.

### Pipelines

Builder includes recurring format, topic, styles, interval, lifetime run cap, and total committed-credit budget. Save paused. Activate requires AI configuration. Run now queues durable work; pause/resume affects future triggers. Cards show next run, limits, state, history/errors, duplicate, edit limits, delete. Retain and pause pipelines with accounting history. Scheduled precondition failure pauses with the reason. Current runs finish after pause. Publishing and upload/source-change triggers are pending.

### Review queue

Real rendered review/approved/reminder projects with title, duration, revision, description, date. Preview plays the actual MP4; Edit opens timeline. Approve requires current render. Return to draft revokes approval. Download checks revision. Set reminder asks for local datetime and explicitly says publishing is manual. Destination-specific descriptions, regenerate controls, and platform submission results await publishing work.

### Calendar

Month grid, Today/Previous/Next, project links. Use browser timezone and persist UTC epoch milliseconds. Entries are manual reminders; becoming due performs no upload. Future destination-aware schedules need IANA timezone and daylight-saving tests, notifications, and real platform outcomes.

### Analytics

Actual completed/failed jobs, approved videos, net credits used, and measured worker usage. Empty states explain when data appears. Social views/engagement remain unavailable until official integrations. Future date filters/export must disclose units, source, and timestamp; no invented forecasts.

### Asset library

Image/video/audio filters, private image originals, native playback. Upload accepts supported types under 100 MB, source/license, rights confirmation, and server probing. Cards show kind/size/date/provenance. No scraped stories or protected character/voice packs. Asset deletion, retention, larger uploads, media isolation, and licensed stock sourcing remain pending.

### Billing

Actual credits, trial or reconciled paid plan, subscription state, ledger. Starter $29/12 standard videos, Creator $79/40, Studio $199/120. Standard video: up to 60 seconds, at most 10 credits with default script/narration/illustrations. Explain lesser manual costs, longer videos, reservation/refund, and accumulated monthly allowances. Checkout/portal use real Stripe only when configured. Redirect is not proof of payment; signed reconciled webhooks grant credits.

### Settings and Help

Edit names, display email, manage creator presets. Presets save caption colors/size/position plus voice/tone/audience preferences. Current timeline applies visual preset settings; creation explicitly chooses voice/tone. Connections distinguish worker online, configured AI, unavailable social. Help gives first-video, worker, AI, content-rights, and privacy instructions. No message is sent externally. Teams, password changes/recovery, deletion, and legal pages remain release work.

## Responsive and accessibility rules

- 1450px+: up to 1600px content; expanded editor properties.
- 1000–1449px: denser panels, two-column mode grid under 1200px.
- 768–999px: 205px sidebar; editor properties below; stack pricing/help as needed.
- Below 768px: drawer, two-column metrics, stacked review/media panels. Scene/preview controls remain usable; properties below. Only timeline/tables may scroll internally.
- Below 420px: simplify decorative art, single-column assets/projects; preserve core actions at 320px.
- Keyboard: Tab/Shift+Tab through controls; Enter activates; Escape dismisses dialogs. Outside inputs, Space toggles preview; Ctrl/Cmd+Z undo, Shift+Z redo. Preserve typing/browser shortcuts.
- Skip link, landmarks, connected labels, heading hierarchy, control names, visible focus, non-color status, and focus restoration. No action requires dragging.
- Short hover/focus/drawer transitions; respect reduced motion. Never animate imaginary job progress.
- Verify widths 320/768/1024/1440, keyboard creation/review, empty/errors, console, and real output. Automated accessibility checks complement manual review; they are not certification.
