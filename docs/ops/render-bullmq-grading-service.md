# Render BullMQ Grading Service

## Services

| Service | Render type | Start command |
|---------|-------------|---------------|
| Next.js API | Web | `npm run start` |
| Grade stack worker | Background Worker | `npm run worker:start` |
| Redis | Render Redis | (managed) |

Deploy both app services from this repo. Attach the same **environment group** so `DATABASE_URL`, `REDIS_URL`, `OPENROUTER_*`, and `UPLOAD_DIR` match.

## Worker entrypoint

- Source: `worker/main.ts`
- Local: `npm run worker:dev` (requires Redis + Postgres + env)
- Health: `GET http://localhost:10000/` when `WORKER_HEALTH_PORT` is set

## Upload storage

Stack images are written under `UPLOAD_DIR` by the API (`POST /api/grade-stack/jobs/preview`). The worker reads the same paths when processing `stack_preview` jobs.

On Render, mount a **persistent disk** at `/var/data/uploads` on **both** the web and worker services (see `render.yaml`), or migrate to shared object storage.

## Queue

- Queue: `grade-stack` (override with `GRADE_STACK_QUEUE_NAME`)
- Jobs: `stack_preview`, `stack_commit`
- Redis prefix: `graider` (`GRADE_STACK_QUEUE_PREFIX`)

## Local development

```bash
docker compose up -d          # Postgres + Redis
npm run db:push               # includes grade_stack_jobs table
npm run dev                   # API on :3000
npm run worker:dev            # worker in second terminal
```

## API contract

See `docs/api/grade-stack-jobs.md`.
