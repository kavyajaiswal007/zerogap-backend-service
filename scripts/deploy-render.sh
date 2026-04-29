#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

set -a
source .env
set +a

render workspace set tea-d74d6tm3jp1c7390u5ug >/dev/null

render services create \
  --name zerogap-backend-service \
  --type web_service \
  --repo https://github.com/kavyajaiswal007/zerogap-backend-service \
  --branch main \
  --runtime node \
  --region singapore \
  --build-command "npm ci && npm run build" \
  --start-command "npm start" \
  --health-check-path /health \
  --env-var "NODE_ENV=production" \
  --env-var "NODE_VERSION=20.18.0" \
  --env-var "SUPABASE_URL=$SUPABASE_URL" \
  --env-var "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
  --env-var "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" \
  --env-var "OPENAI_API_KEY=$OPENAI_API_KEY" \
  --env-var "REDIS_URL=$REDIS_URL" \
  --env-var "RAPIDAPI_KEY=$RAPIDAPI_KEY" \
  --env-var "GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID" \
  --env-var "GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET" \
  --env-var "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" \
  --env-var "GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET" \
  --env-var "LINKEDIN_CLIENT_ID=$LINKEDIN_CLIENT_ID" \
  --env-var "LINKEDIN_CLIENT_SECRET=$LINKEDIN_CLIENT_SECRET" \
  --env-var "FRONTEND_URL=https://zerogap-frontend-002.vercel.app" \
  --env-var "JWT_SECRET=$JWT_SECRET" \
  --confirm \
  -o json
