# Grade Stack Jobs API

Async stack grading: the API accepts uploads quickly, enqueues BullMQ jobs, and the **grade-stack worker** runs OCR/matching/grading.

## Endpoints

- `POST /api/grade-stack/jobs/preview` — multipart: `testId`, `classId`, `images[]`, optional `idempotencyKey`
- `GET /api/grade-stack/jobs/:jobId` — poll job status and payloads
- `POST /api/grade-stack/jobs/commit` — JSON: `testId`, `previewJobId`, `assignments[]`, optional `idempotencyKey`

Legacy sync path remains: `POST /api/grade/stack`.

## Status values

`queued` → `processing` → `needs_review` (preview) or `completed` (commit) or `failed`.

Client polling: every ~2s until a terminal state.
