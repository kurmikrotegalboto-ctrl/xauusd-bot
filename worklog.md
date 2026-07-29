---
Task ID: final-verify
Agent: main

Task: Verify Vercel deployment readiness, test Upstash Redis connection, run build, prepare deployment instructions.

Work Log:
- Read engine.ts, positions.ts, stream/route.ts, use-xau-data.ts, redis-client.ts, redis-state.ts, poll/route.ts, paper-trade/route.ts, vercel.json — all already converted for Vercel serverless (lazy ticks, Redis state, polling endpoint).
- Tested Upstash Redis connection with provided URL using rediss:// prefix → ✓ PING PONG, SET/GET works.
- Created .env.local with REDIS_URL=rediss://... for local testing.
- Ran `npm run build` → ✓ compiled successfully, no errors.
- Started dev server, tested /api/xau/poll → returns full snapshot (price + paper trade). Redis seed logs visible.
- Tested POST /api/xau/paper-trade with action=deposit amount=500 → balance became 10500 ✓.
- Cleaned test data from Upstash Redis (deleted xauusd:engine:v1, xauusd:paper:v1) so Vercel starts fresh.
- Verified GitHub repo (kurmikrotegalboto-ctrl/xauusd-bot) already has Vercel conversion commit (42f2375) pushed.

Stage Summary:
- All code conversion already pushed to GitHub in commit 42f2375 ("feat: Vercel serverless deployment with Redis-backed state").
- Latest GitHub commit: c289519 ("fix: force-include .env.example").
- Redis connection verified working with TLS (rediss://).
- Build passes locally.
- Local smoke test confirms polling endpoint + paper trade POST both work with Redis persistence.
- Redis state cleaned for fresh Vercel deploy.
- User is ready to deploy: import repo on Vercel, set REDIS_URL env var (rediss://...), click Deploy.

Artifacts:
- /home/z/my-project/.env.local (local testing — gitignored)
- /home/z/my-project/scripts/test-redis.mjs (Redis connection test)
- /home/z/my-project/scripts/clean-redis.mjs (Redis cleanup utility)
