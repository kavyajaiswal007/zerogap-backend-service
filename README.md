# ZeroGap Backend

AI-powered Skill Mapping & Employability platform backend.

## Stack

- Node.js 20 + Express.js + TypeScript
- Supabase (PostgreSQL + Auth + Storage + Realtime)
- Redis (BullMQ queues + caching)
- OpenAI + optional Anthropic fallback
- JSearch RapidAPI for job listings
- Puppeteer + PDFKit fallback for resume PDFs

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

The API runs on `PORT` from `.env` and exposes Swagger at `/api/docs`.

## Database Setup

Run migrations in order:

```bash
psql "$DATABASE_URL" < supabase/migrations/001_initial_schema.sql
psql "$DATABASE_URL" < supabase/migrations/002_additions.sql
```

Create a public Supabase Storage bucket named by `RESUME_STORAGE_BUCKET` (default `resumes`).

## Environment Variables

See [.env.example](/Users/kavyajaiswal/Desktop/ZeroGap%20./ZeroGap%20backend%20/.env.example) for all required variables, including Supabase, Redis, OpenAI, OAuth, RapidAPI, and frontend URL.

## Important Endpoints

- `GET /health`
- `GET /api/dashboard`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/google`
- `GET /api/auth/github`
- `POST /api/mentor/chat`
- `POST /api/resume/:id/export-pdf`

## Architecture

- `src/modules/` feature modules
- `src/queues/` BullMQ queue entry points
- `src/workers/` worker startup
- `src/utils/` shared utilities
- `src/middleware/` auth, validation, rate limits, and errors
- `supabase/migrations/` schema changes

## Production Notes

Keep real secrets only in Render/Vercel/Supabase environment settings. Rotate any keys that were pasted into chat or logs.
