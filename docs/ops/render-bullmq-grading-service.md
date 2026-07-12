# Render BullMQ Grading Service

## Services

| Service | Render type | Start command |
|---------|-------------|---------------|
| Next.js API (optional) | Web | `npm run start` |
| Grade stack worker | Background Worker | `npm run worker:start` |
| Redis | Render Redis / Key Value | (managed, `noeviction`) |

Typical production topology: **Vercel** hosts the Next.js API; **Render** runs only the background worker + Redis. Attach the same env values on Vercel and the worker: `DATABASE_URL`, `REDIS_URL`, `OPENROUTER_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optional `EXPO_ACCESS_TOKEN`.

`EXPO_ACCESS_TOKEN` (from [expo.dev](https://expo.dev) → Account → Access tokens) is optional but recommended so the worker can send push notifications when grading jobs finish.

## Worker entrypoint

- Source: `worker/main.ts`
- Local: `npm run worker:dev` (requires Redis + Postgres + env)
- Health: `GET http://localhost:10000/` when `WORKER_HEALTH_PORT` is set

## Upload storage

Uploads use **Supabase Storage** (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, bucket `SUPABASE_TEST_UPLOAD_BUCKET` / `test-uploads`) so the Vercel API and Render worker share the same objects.

Create a private bucket named `test-uploads` (or match your env). Locally, if Supabase env is unset, files fall back to `UPLOAD_DIR`.

## Queue

- Queue: `grade-stack` (override with `GRADE_STACK_QUEUE_NAME`)
- Jobs: `stack_preview`, `stack_commit`
- Redis prefix: `graider` (`GRADE_STACK_QUEUE_PREFIX`)

## Local development

```bash
docker compose up -d          # Postgres + Redis
npm run db:push               # includes grade_stack_jobs + push_tokens tables
npm run dev                   # API on :3000
npm run worker:dev            # worker in second terminal
```

## API contract

See `docs/api/grade-stack-jobs.md`.
