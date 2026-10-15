# Clipvero

Clipvero turns your own scripts and footage into editable short videos. It is under development and is **not ready for a public commercial launch**.

There are currently two development paths. The existing local studio can edit and export videos. The new FastAPI workspace provides PostgreSQL accounts, permissions, script projects, saved timeline versions and settings. Private media and exports are being migrated; the two paths have separate accounts and data.

## Try the existing video studio

Install **Node.js 24** and **pnpm 10.33**, then run:

```sh
git clone https://github.com/Blasted-ctrl/Clipvero.git
cd Clipvero
pnpm install --frozen-lockfile
pnpm dev:all
```

Open **http://localhost:3000**, create an account, and choose **Script to video**. Separate scenes with blank lines. Edit captions, timing, images, video and audio; preview; render an MP4; approve it; and download it. No AI key or card is required.

Keep the terminal open while rendering. The app and its separate worker save the database and media in the ignored `data/` folder. New accounts receive 120 one-time trial credits. Editing is free; a manual render costs one credit per minute, rounded up. Failed jobs refund reserved credits.

Copy `.env.example` to `.env` to configure the app. Keep `CLIPVERO_BACKEND=legacy` for this path. Optional OpenAI and Stripe adapters exist, but real generation and payments still need credentials and verification. Social publishing is unavailable; calendar entries are manual reminders.

## Run the FastAPI foundation

You need **Docker with Compose**. Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` to a random URL-safe password and `SESSION_SECRET` to a random secret of at least 32 characters. Then:

```sh
docker compose up --build
```

Open **http://localhost:3000**. Compose runs PostgreSQL, Redis, migrations, FastAPI, Celery maintenance, its scheduler and the website. It explicitly selects the FastAPI backend. Create an account, sign out and in, and update your profile and workspace name. The dashboard shows your actual membership and trial balance. Choose Projects to create a script project, edit scenes, preview and reopen saved changes. Private uploads and MP4 exports are unavailable here until their migration passes testing.

PostgreSQL and Redis use named Docker volumes. Development ports bind to localhost: PostgreSQL 55432, Redis 56379, API 8000 and web 3000. Stop with `docker compose down`; keep the volumes to retain your data. Do not run both website paths on port 3000 at once. This Compose file is for local development.

To develop Python without containers, install **uv** and Python **3.12 or newer**, provide your own PostgreSQL and Redis, and set valid `DATABASE_URL`, `REDIS_URL`, `APP_URL` and `SESSION_SECRET` values in `.env`:

```sh
uv sync --frozen
uv run python -m alembic -c services/api/alembic.ini upgrade head
uv run python -m uvicorn clipvero_api.main:app --reload --port 8000
```

In separate terminals, run `uv run python -m celery -A clipvero_workers.app:app worker -Q maintenance --loglevel=INFO` and the website with `CLIPVERO_BACKEND=fastapi`. Run Celery in Linux containers; Windows supports API development but is not a production Celery host. API documentation is at **http://localhost:8000/docs**.

The `.env.example` also lists private R2/S3 settings. They currently support an integration connection check and internal URL-signing boundary. Setting them does not enable uploads: asset ownership, quota reservation, content validation/finalization and cleanup are still being implemented. Keep the bucket private and add credentials only to your local `.env`.

## Checks

```sh
pnpm check                 # TypeScript, ESLint and domain tests
pnpm build                 # Next.js production build
uv run ruff check services scripts/export_openapi.py
uv run ruff format --check services scripts/export_openapi.py
uv run mypy
uv run pytest -q           # Isolated API and worker tests
pnpm types:api             # Regenerate TypeScript contracts from FastAPI
```

Default Python tests use isolated SQLite and an explicit Redis test double. Set `CLIPVERO_TEST_DATABASE_URL` and `CLIPVERO_TEST_REDIS_URL` to **dedicated test services** for PostgreSQL migrations and real broker tests. Never point tests at customer data. CI supplies isolated PostgreSQL and Redis.

Install Chromium with `pnpm exec playwright install chromium`. With the local studio and render worker running, use `pnpm test:e2e`. With FastAPI and its website running, use `pnpm exec playwright test -c playwright.foundation.config.ts`. These workflows create test accounts; studio tests also generate real media.

## Repository layout and status

The Next.js app remains in `src/` to preserve the working studio. `services/api` contains FastAPI and Alembic; `services/workers` contains Celery; `packages/video-engine` contains the shared Remotion composition and timeline schema; `packages/shared-types` contains generated API contracts. Dockerfiles live in `infrastructure/docker`.

The required roadmap for phases 0 through 11 and verified progress are in [AGENTS.md](AGENTS.md). [UI.md](UI.md) describes the interface and [CODING.md](CODING.md) the engineering rules. Later gates include private S3 storage, PostgreSQL video jobs, ElevenLabs, complete creative formats, source analysis, commercial billing, approved social integrations and production operations.

`.env` files, keys, databases, media, local tools, caches, builds and test results stay out of Git. Use `.env.example` as a configuration guide. Production deployment remains gated on security, backup/restore, infrastructure and real integration tests.
