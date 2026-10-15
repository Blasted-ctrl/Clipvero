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

Open **http://localhost:3000**, create an account and choose **Script to video**. Separate scenes with blank lines. You can edit, render, approve and download a video without an AI key or a card. Keep the terminal open while rendering; it runs both the website and its video worker.

New accounts receive 120 trial credits once. A manual render costs one credit per minute, rounded up; failed jobs refund reserved credits. The ignored `data/` directory holds this studio's database, uploads and exports. Keep it on persistent local storage and back it up.

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

Stop and restart `pnpm dev:all` after editing the file so the website and worker both reload the key. Supplied-script narration, ElevenLabs and several advanced formats still require implementation; adding extra environment names will not enable them.

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

## Production work still required

The next implementation work is to connect private assets, durable video jobs, generation, rendering, review and billing to the same PostgreSQL workspace and credit ledger. Account recovery, permanent data deletion, official social publishing, measured analytics, monitoring, backups with verified restore and the final hosting/TLS setup also remain open. No live AI generation, payment or private bucket has been verified with your credentials.

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
