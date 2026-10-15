# Clipvero

A short-form video workspace for turning your own scripts and footage into editable, downloadable videos.

Clipvero is an early development release, not a finished commercial service. Create an account, write a script, edit scenes and captions, render an MP4, review it, and download it. AI generation needs your own OpenAI API key. Social publishing is not available yet.

## Run it on your computer

You need **Node.js 24** and **Git**. The first install downloads video-processing tools and may take a few minutes.

```sh
git clone https://github.com/Blasted-ctrl/Clipvero.git
cd Clipvero
npm ci
npm run dev:all
```

Open **http://localhost:3000**, create an account, and choose **Script to video**. Use a blank line between scenes. No API key or credit card is needed for this workflow.

The app and its render worker run together. Keep the terminal open while rendering. Your database and media are saved in the ignored `data/` folder. New accounts receive 120 one-time trial credits. Editing is free. A manual render costs one credit per minute, rounded up. Failed jobs return their reserved credits.

## Add AI generation

Copy `.env.example` to `.env` in the project folder and add your key:

```dotenv
OPENAI_API_KEY=your-key-here
```

Restart the app and worker. You can then request AI scripts, synthetic narration, scene illustrations, or transcript-based excerpts from uploaded videos. Review generated claims, captions, and character consistency before exporting. Provider usage is billed to your AI provider account separately.

The example file lists model settings and optional Stripe configuration. Keep real keys in `.env`, never in source files. `.env`, local databases, uploaded media, build output, and test results are ignored by Git.

## What works, and what still needs work

| Area                            | Current state                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Accounts and private workspaces | Local email/password accounts and private saved data                              |
| Script editor                   | Scene order, timing, captions, media, audio, colors, undo/redo, autosave          |
| Export                          | Separate worker, shared preview/export composition, validated MP4 download        |
| Review and calendar             | Approvals and manual publishing reminders                                         |
| Characters and styles           | Saved character references and creator presets                                    |
| AI creation                     | OpenAI adapters implemented; live calls need credentials and validation           |
| Autopilots                      | Scheduled/manual jobs, spending limits, review-first output                       |
| Long videos                     | Timestamped transcription and duration-based excerpts; advanced analysis pending  |
| Billing                         | Stripe Checkout, portal, and signed webhooks implemented; live billing unverified |
| Social publishing               | Pending; download and upload your MP4 manually                                    |
| Public commercial launch        | Pending the documented security and integration release gates                     |

The full feature inventory, remaining work, and release gates are in [AGENTS.md](AGENTS.md). The interface specification is in [UI.md](UI.md), and engineering contracts are in [CODING.md](CODING.md).

## Development commands

```sh
npm run dev          # Website only
npm run worker       # Render and automation worker
npm run check        # Type checks, lint, and domain tests
npm run build        # Production build
npm start            # Serve the production build
```

For browser tests, run the app and worker in another terminal, then:

```sh
npx playwright install chromium
npm run test:e2e
```

Browser tests create test accounts and real media. Use a development database, never customer data.

## Hosting

Run the website and worker as separate long-running Node processes on the same machine with a shared persistent data volume. Set `APP_URL` to your real HTTPS address and `SESSION_SECRET` to a random value of at least 32 characters. Back up the database and media together.

This version needs a writable filesystem and video-rendering processes. Stateless serverless deployment is not supported. Read the production checklist in `CODING.md` before exposing it publicly.
