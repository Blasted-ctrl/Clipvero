# Clipvero

Clipvero turns your scripts and footage into editable short videos. The current Node studio can edit, render, review and download MP4s. OpenAI generation and Stripe subscriptions have server integrations that require your own credentials.

The PostgreSQL backend currently provides accounts, workspace permissions and saved script projects. Private media, video jobs, generation and billing still need to be connected to that backend before Clipvero can launch as one production SaaS. Configuration alone does not complete that work.

## Run the video studio

Install **Node.js 24** and **pnpm 10.33**. In PowerShell or your terminal:

```sh
git clone https://github.com/Blasted-ctrl/Clipvero.git
cd Clipvero
pnpm install --frozen-lockfile
pnpm setup:env
pnpm dev:all
```

Open **http://localhost:3000**, create an account and choose **Script to video**. Separate scenes with blank lines. You can edit, render, approve and download a video without an AI key or a card. Keep the terminal open; it runs the website, video worker and publisher.

New accounts receive 120 trial credits once. A manual render costs one credit per minute, rounded up; failed jobs refund reserved credits. The ignored `data/` directory holds this studio's database, uploads and exports. Keep it on persistent local storage and back it up.

## Make a narrated DSA lesson without an API key

In **Create → Educational explainer → Lesson storyboard**, choose **Hash maps**, **Binary search**, or **Stacks and queues**. Each includes an original script, animated diagrams and Python examples. Review the script, keep one paragraph per beat, confirm your content rights, and choose **Generate video**. The worker creates local narration, timed captions and an MP4 that waits for review. Changing the words does not automatically redesign the diagrams; check that they still agree.

The explainer look uses a vertical canvas, a dark background, one accent color, persistent diagrams, animated entrances, camera moves and white captions with the spoken word highlighted. The lessons use playful running examples: anime contacts, a gaming-lobby search, and undo history versus a boba queue. In the editor, select a scene to adjust **Camera framing**, **Narrator position**, or an optional **Reaction caption**. Preview and export use the same timeline. Background footage and generated scene images belong to the Classic look.

Free voices need a separate Python 3.12 environment. With [uv](https://docs.astral.sh/uv/) installed, run these PowerShell commands once:

```powershell
uv venv --python 3.12 .tools/voice-venv
uv pip install --python .tools/voice-venv/Scripts/python.exe "kokoro==0.9.4" soundfile
```

The first voice run downloads the model and voice files; later runs reuse cached files. One model instance speaks all scenes in a video. **Free voice · cute** is the voice used for these lessons. Warm and deep voices are also available. Narrated explainer exports adjust the complete audio mix toward −16 LUFS with a −1.5 dB true-peak limit. Initial setup needs internet access and local narration takes processing time. `VOICE_PYTHON` can point to another compatible Python executable. On Linux, the default path is `.tools/voice-venv/bin/python`.

An agent can supply its own script and typed `beats` through `clipvero_create_batch`: use `mode: "script"`, `style: "explainer"`, `voice: "free-cute"`, and `aspect: "9:16"`. Join beat texts with blank lines to form `content`. Each beat has a fixed `visual`, an optional shared `panel` ID, and optional display-only `code`. Adjacent beats with the same panel ID and visual type keep their diagram on screen. Optional `presentation` sets `camera` (`wide` or `close`), `mascotSide` (`left` or `right`), and `reaction` (up to 24 characters). These supplied storyboards need neither an OpenAI key nor the local script writer.

## Fill in your .env

### 1. Generate the application secrets

Run `pnpm setup:env` from the repository directory. It creates `.env` when missing, generates separate random `SESSION_SECRET` and `POSTGRES_PASSWORD` values, and fills the default local PostgreSQL URL. Existing credentials, custom database URLs and other settings are preserved. Repeating the command keeps the same secrets.

Keep these local settings while working on your computer:

```dotenv
APP_NAME=Clipvero
APP_URL=http://localhost:3000
ENVIRONMENT=development
CLIPVERO_BACKEND=legacy
DATA_DIR=./data
```

`legacy` currently runs the working video studio. `fastapi` selects the PostgreSQL workspace, whose video services are still being implemented. The two backends have separate accounts and projects. Switching the setting does not migrate data.

The setup command writes generated secrets directly to `.env`. Keep that file private; it is ignored by Git. On a new production server, generate its own secrets once and preserve them across redeployments.

### 2. Connect OpenAI

Create a project API key in the [OpenAI platform](https://platform.openai.com/api-keys) and configure API billing for that project. Put the key in `.env`:

```dotenv
OPENAI_API_KEY=your_project_api_key
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_SPEECH_MODEL=gpt-4o-mini-tts
OPENAI_IMAGE_MODEL=gpt-image-2
```

These settings are consumed by the Node video worker. They enable its provider requests for scripts, narration, images and transcription; requests still depend on your account's model access and limits. The image adapter explicitly requests PNG output. Existing `.env` files retain their model setting, so replace `gpt-image-1` if it is still configured: OpenAI lists it for retirement on October 23, 2026. See the [official deprecations](https://developers.openai.com/api/docs/deprecations) and [image model documentation](https://developers.openai.com/api/docs/models/gpt-image-2).

Stop and restart `pnpm dev:all` after editing the file so the website and worker reload the key. The creation form and agent batches can request narration for an unchanged supplied script. Free local voices work without this key; paid provider voices use it. ElevenLabs and several advanced formats still require implementation; extra environment names will not enable them.

### 3. Connect Stripe subscriptions

In your [Stripe dashboard](https://dashboard.stripe.com/), create these products with **monthly recurring USD prices** matching the app:

| Product | Monthly price | Environment setting    |
| ------- | ------------- | ---------------------- |
| Starter | $29           | `STRIPE_PRICE_STARTER` |
| Creator | $79           | `STRIPE_PRICE_CREATOR` |
| Studio  | $199          | `STRIPE_PRICE_STUDIO`  |

Copy each `price_...` ID, then set:

```dotenv
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_endpoint_signing_secret
STRIPE_PRICE_STARTER=price_from_starter
STRIPE_PRICE_CREATOR=price_from_creator
STRIPE_PRICE_STUDIO=price_from_studio
```

Use the secret key, price IDs and webhook signing secret from the same Stripe environment. A publishable key is not needed by the current hosted Checkout implementation.

Register `https://YOUR_DOMAIN/api/webhooks/stripe` as your webhook destination, and subscribe it to these five events:

- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy that destination's signing secret into `STRIPE_WEBHOOK_SECRET`. Enable the [Stripe customer portal](https://docs.stripe.com/customer-management/activate-no-code-customer-portal) so customers can manage their subscriptions. For local development, the [Stripe CLI](https://docs.stripe.com/webhooks) can forward events with `stripe listen --forward-to localhost:3000/api/webhooks/stripe`; use the signing secret printed by that listener while it runs. Restart the app after changing secrets.

The current billing integration belongs to the Node studio. PostgreSQL billing and real purchase verification remain required before charging customers through the migrated application. See Stripe's [keys](https://docs.stripe.com/keys) and [price setup](https://docs.stripe.com/products-prices/manage-prices) guides.

### 4. Prepare private media storage

For Cloudflare R2, create a private bucket, such as `clipvero-media`. In R2's API token settings, create an **Object Read & Write** credential scoped to that bucket. Copy the Access Key ID, Secret Access Key and exact S3 endpoint shown by Cloudflare:

```dotenv
S3_ENDPOINT_URL=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_BUCKET=clipvero-media
S3_REGION=auto
S3_ACCESS_KEY_ID=your_r2_access_key_id
S3_SECRET_ACCESS_KEY=your_r2_secret_access_key
```

Use the jurisdiction-specific endpoint if your bucket has one. The endpoint is the S3 API origin, not a public bucket URL. Keep public access disabled. Cloudflare documents the [credential steps](https://developers.cloudflare.com/r2/api/tokens/) and [`auto` region](https://developers.cloudflare.com/r2/api/s3/api/).

These variables currently configure FastAPI's connection check and internal URL signing. The private upload, validation and download workflow still needs implementation. The Node studio continues to use `DATA_DIR`.

### 5. Run the PostgreSQL backend when developing its services

Install Docker with Compose. `pnpm setup:env` has already filled `POSTGRES_PASSWORD` and the matching local `DATABASE_URL`. Keep these host connection settings:

```dotenv
API_BACKEND_URL=http://127.0.0.1:8000
REDIS_URL=redis://127.0.0.1:56379/0
```

Stop any website already using port 3000, then run:

```sh
docker compose up --build --detach
```

Compose runs PostgreSQL, Redis, migrations, FastAPI, Celery maintenance, its scheduler and the website. **This Compose setup always selects FastAPI**, regardless of the `CLIPVERO_BACKEND` value in the root `.env`. It supplies internal container connection URLs; the localhost URLs above are for Python/Next.js processes running outside Docker.

Open **http://localhost:3000** to use PostgreSQL accounts and script projects. Uploads, generation and MP4 exports are not connected here yet. The Celery worker currently performs maintenance; it is not the Node video worker.

Development ports bind to localhost: PostgreSQL 55432, Redis 56379, API 8000 and web 3000. Stop with `docker compose down`; retain the volumes to keep data. Changing `POSTGRES_PASSWORD` later does not rotate an already-initialized database's password.

For Python development outside Docker, install **uv** and Python **3.12+**, then use your actual PostgreSQL and Redis connections in `.env`:

```sh
uv sync --frozen
uv run python -m alembic -c services/api/alembic.ini upgrade head
uv run python -m uvicorn clipvero_api.main:app --reload --port 8000
```

Run Celery on Linux or in its container. API documentation is at **http://localhost:8000/docs**.

### 6. Set production values after choosing hosting

A Linux server with Docker is a practical starting point for this repository because it needs persistent databases and continuously running media workers. [Docker documents Compose deployments on a single server](https://docs.docker.com/compose/how-tos/production/). Provision HTTPS and a domain, then set on that server:

```dotenv
APP_URL=https://YOUR_DOMAIN
ENVIRONMENT=production
```

`APP_URL` must be the exact public origin: no path, query or fragment. It controls session-cookie security, allowed request origins, billing return URLs and public metadata. Keep database and Redis services private. Use the hosting provider's secret storage, or a restricted server `.env`, for actual keys.

The Compose services now honor `ENVIRONMENT`; production FastAPI startup requires an HTTPS origin and a session secret of at least 32 characters. Compose's current loopback ports still require an HTTPS reverse proxy. Changing these two values does not supply the unfinished video services or production operations.

`FFMPEG_PATH`, `FFPROBE_PATH` and `REMOTION_BROWSER_EXECUTABLE` may stay blank locally. Set them only when supplying your own installed binaries; the render container already sets its Linux binary paths.

## Run your own content workflow with an agent

Use the Node studio (`CLIPVERO_BACKEND=legacy`) for this workflow. The PostgreSQL Compose deployment does not expose these operations yet.

1. Your connected agent can write a complete script and send it as mode `script`, with images disabled. Choose `voice: "none"` for captions only, or `voice: "free-cute"` after installing the local voice environment above. Both work without an OpenAI key. Paid provider generation needs its own credentials; a chat subscription does not supply those credentials to the worker.
2. Open **Automation** in the sidebar. Connect your publishing accounts after completing the account setup below.
3. Choose **Connect an agent**. Start with **1 video**, a credit allowance and an expiry. Select the destination accounts and local start/end times. The saved schedule uses UTC instants; elapsed minutes determine spacing across daylight-saving changes. The guided video always needs your review.
4. Save the one-time token in your MCP client's private settings. An HTTP MCP client uses `https://YOUR_DOMAIN/api/mcp` with `Authorization: Bearer YOUR_TOKEN`. For a stdio client, launch `pnpm --silent --dir C:/Users/kings/Clipvero agent:mcp` with `CLIPVERO_URL` and `CLIPVERO_AGENT_TOKEN` in its environment. The bridge forwards requests to your website. Clients must support Bearer HTTP or stdio; OAuth connector discovery is not implemented.
5. Ask the agent to create one original short. It inspects its allowance with `clipvero_status`, calls `clipvero_create_batch` with a UUID `requestId`, then polls `clipvero_get_batch`. Reuse that request ID for retries of the same request. Credits and durable job IDs are stored before returning, so rendering continues after the agent disconnects. Open the returned review URL or the publishing queue to inspect the real output.
6. Once that run works, issue a **new** allowance for **3**, then **5**, then **8** videos. These are lifetime limits across all requests with that token. Automatic approval applies to Instagram within your destinations, window and spacing. **Every TikTok video requires review, audience selection and consent in Clipvero.** Agents cannot increase limits or approve TikTok posts.

Agents can create supported script, prompt, story, character, explainer and marketing jobs and read their own results. Source clipping/gameplay batches are rejected so one job cannot evade the video allowance. Failed attempts still count against that token's allowance; job refunds return credits to the workspace. Internal credits are a fixed processing tariff, not a dollar cap on your provider's bill. Inspect usage and control provider spending separately.

**Reuse the same agent token for multiple videos until its allowance, credit budget or expiry is reached.** A one-video grant intentionally stops after one attempt; it is not a separate login token required for every video. A larger owner-issued allowance supports multiple requests. Agents cannot extend their own authorization.

The website, video worker and publisher must share persistent `DATA_DIR`, `APP_URL` and stable `SESSION_SECRET`. `pnpm dev:all` runs all three locally; separate processes use `pnpm dev`, `pnpm worker` and `pnpm publisher`. The render Dockerfile can also run the publisher with `pnpm exec tsx scripts/publisher.ts`. Keep one durable volume on one host for this personal workflow. SQLite is not a distributed multi-host queue.

### Run privately from your computer without buying a domain

1. Create a free [ngrok account](https://dashboard.ngrok.com). Copy the assigned hostname from **Domains** and your token from **Your Authtoken**. Install the [official ngrok agent](https://ngrok.com/download); on Windows, the launcher also finds `.tools/ngrok/ngrok.exe`. Set `NGROK_BIN` only when using a different executable path.
2. Add these settings to your private `.env`. Use your own values; the domain field takes only the hostname, without `https://` or a path:

   ```dotenv
   PILOT_OWNER_EMAIL=your_clipvero_login_email
   NGROK_DOMAIN=your_assigned_hostname.ngrok-free.dev
   NGROK_AUTHTOKEN=your_actual_ngrok_token
   ```

3. Keep `APP_URL=http://localhost:3000` for initial setup. Run `pnpm dev`, open **http://localhost:3000/signup**, and create the account using exactly that owner email. Only the configured owner can register in local development. Stop the local app once you are signed in.
4. Run `pnpm pilot:setup`. It checks that the owner exists and updates only `APP_URL` to your HTTPS hostname while preserving your secrets.
5. Run `pnpm pilot`. It builds and starts the website, video worker, publisher and tunnel together. It prints your actual website, OAuth callbacks and TikTok media prefix. Sign in at the HTTPS address; your localhost browser session does not transfer there. Leave the terminal open and your computer awake. **Ctrl+C** stops the processes started by this command.

This private run accepts only the configured owner account, including existing sessions and agent grants. Registration is closed at the public address. It does not delete other local accounts or their data. The ngrok inspector and remote management are disabled. Free ngrok pages may show a one-time browser notice; normal API traffic does not receive it. The free plan supplies one assigned development hostname with usage limits; see [ngrok's free-plan documentation](https://ngrok.com/docs/pricing-limits/free-plan-limits).

When TikTok asks you to verify the media URL prefix, place its exact downloaded `.txt` proof file in `.local-services/tiktok-verification/`. Verify `https://YOUR_HOSTNAME/api/social/media/` in the developer portal. Only small plain-text proof files from that ignored folder are served there; video downloads still require their signed URL. Keep that prefix and HTTPS address unchanged after registering them. Follow TikTok's [media transfer guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide).

### Connect Instagram and TikTok

You need a public **HTTPS origin** for OAuth callbacks and platform video downloads, even when workers run on your computer. Open Clipvero through that origin, set it as `APP_URL`, and restart all three processes. Localhost alone cannot complete publishing. A stable HTTPS tunnel or private server can supply the origin; public customer signup is not needed for your guided run.

Add these four values to your private `.env` after creating the developer apps:

```dotenv
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
```

**Instagram:** In your [Meta developer app](https://developers.facebook.com/apps/), enable **Instagram API with Instagram Login**. Use the Instagram App ID/secret from that setup, switch your Instagram account to a professional Business or Creator account, and add it to your app's authorized developer/tester setup. Register `https://YOUR_DOMAIN/api/social/callback/instagram` as the exact redirect URI. Clipvero requests `instagram_business_basic` and `instagram_business_content_publish`. Then use **Automation → Connect Instagram**. Account roles/access and public app review must satisfy Meta's requirements. See [Instagram login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login) and [publishing](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing).

**TikTok:** Create an app in [TikTok for Developers](https://developers.tiktok.com/), enable **Login Kit** and **Content Posting API / Direct Post**, and request `user.info.basic` and `video.publish`. Register `https://YOUR_DOMAIN/api/social/callback/tiktok` as the Web redirect URI. Verify ownership of your media domain or the prefix `https://YOUR_DOMAIN/api/social/media/` through its URL properties setup. Then use **Automation → Connect TikTok**. Clipvero loads current creator settings, requires an audience choice, keeps interactions off by default, collects commercial disclosures and music-usage consent, and submits the reviewed render.

TikTok restricts unaudited Direct Post clients to private accounts and “Only me” visibility. Public posting requires its audit; a private upload cannot prove public reach. TikTok also requires an app intended for a broad creator audience rather than solely an internal upload utility. See [Direct Post setup](https://developers.tiktok.com/docs/en/content-posting-api-get-started) and [sharing requirements](https://developers.tiktok.com/docs/en/content-sharing-guidelines).

Connections store encrypted tokens; agent tokens store only hashes. Preserve `SESSION_SECRET` privately: changing it makes saved social credentials unreadable. Videos use time-limited links bound to the publication and rendered revision. Revoking a grant stops queued work; disconnecting an account removes saved credentials. An accepted platform submission may still finish. The queue keeps that outcome visible instead of claiming cancellation. An unknown write is never automatically resubmitted; check the platform account before creating another submission.

Publishing shows actual provider processing/completion states and available post IDs/Instagram links. Adapters have contract coverage with explicit fixtures; **no live account connection, AI generation or social post has been verified with your credentials**. Engagement collection is pending: use real platform analytics for the 1 → 3 → 5 → 8 runs. Track failures, time saved and actual views before deciding whether to launch.

## Production work still required

The immediate priority is a guided creation-and-publishing run on your own accounts. Before a public SaaS launch, connect private assets, durable video jobs, generation, rendering, review and billing to the same PostgreSQL workspace and credit ledger. Account recovery, permanent data deletion, live social verification/app approvals, measured analytics, monitoring, backups with verified restore and hosting/TLS also remain open. No live AI generation, payment or private bucket has been verified with your credentials.

Product requirements and implementation status are in [AGENTS.md](AGENTS.md), interface behavior in [UI.md](UI.md), and engineering rules in [CODING.md](CODING.md). Development stays on `main`.

## Checks

```sh
pnpm check
pnpm format:check
pnpm build
uv run ruff check services scripts/export_openapi.py
uv run ruff format --check services scripts/export_openapi.py
uv run mypy
uv run pytest -q
```

Install Chromium with `pnpm exec playwright install chromium`. With the Node studio and worker running, use `pnpm test:e2e`. With FastAPI and its website running, use `pnpm exec playwright test -c playwright.foundation.config.ts`. Browser workflows create isolated accounts; video acceptance also renders real media. Python tests use isolated SQLite by default; dedicated PostgreSQL and Redis services can be selected with `CLIPVERO_TEST_DATABASE_URL` and `CLIPVERO_TEST_REDIS_URL`.

The Next.js app lives in `src/`; FastAPI in `services/api`; Celery in `services/workers`; shared Remotion composition in `packages/video-engine`; generated API contracts in `packages/shared-types`; Dockerfiles in `infrastructure/docker`. Credentials, databases, runtime media, tools, builds and test results stay out of Git.
