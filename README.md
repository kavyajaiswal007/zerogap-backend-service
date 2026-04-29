# ZeroGap Backend

Production-oriented Express + TypeScript backend for ZeroGap. This backend was created separately from the frontend so the existing frontend stays untouched.

## Stack

- Node.js 20+
- Express.js + TypeScript
- Supabase Postgres + Auth + Storage + Realtime
- Redis / Upstash via `ioredis`
- BullMQ background queues
- OpenAI
- RapidAPI JSearch
- Zod validation
- Winston + Morgan logging
- Swagger docs at `/api/docs`

## Project Structure

```text
zerogap-backend/
├── src/
├── supabase/
│   └── migrations/
├── postman/
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in real credentials for Supabase, Redis, Anthropic, OpenAI, GitHub OAuth, LinkedIn, and RapidAPI.
3. Install dependencies:

```bash
npm install
```

4. Run the Supabase migration in your Supabase SQL editor or with the Supabase CLI:

```bash
supabase login
supabase init
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

5. Create a Supabase Storage bucket named `resumes`.
6. Make sure GitHub and Google providers are enabled in Supabase Auth.
7. Start the API:

```bash
npm run dev
```

8. Open Swagger docs:

```text
http://localhost:5000/api/docs
```

## Environment Variables

See [.env.example](/Users/kavyajaiswal/Desktop/ZeroGap%20./ZeroGap%20backend%20/.env.example) for the full list. Required variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `RAPIDAPI_KEY`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `FRONTEND_URL`
- `JWT_SECRET`

## Key Features

- Full auth flow with Supabase email/password and OAuth redirects
- Profile, onboarding, skills, certificates, and resume upload flows
- Skill gap analysis with market-skill fallback from JSearch
- Score calculation, caching, and realtime publish hooks
- AI roadmap generation with task completion, streaks, XP, and achievements
- AI mentor SSE chat
- Resume generation + queued PDF export
- Hire Me job matching
- Benchmarking, failure prediction, and project generation
- College admin analytics endpoints

## Docker

```bash
docker compose up --build
```

## Health Check

```text
GET /health
```

## Postman

Postman collection:

- [zerogap-backend.postman_collection.json](/Users/kavyajaiswal/Desktop/ZeroGap%20./ZeroGap%20backend%20/postman/zerogap-backend.postman_collection.json)

## Notes

- The frontend was not modified.
- Real provider secrets should live only in `.env`, not in committed files.
- Some external flows depend on Supabase project configuration, OAuth provider setup, and existing storage buckets.
