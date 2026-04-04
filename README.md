# Graider AI Test Marking

## Setup

1. Install dependencies

```bash
npm install
```

2. Copy environment variables

```bash
cp .env.example .env.local
```

3. Add the required values to `.env.local`:

- Clerk publishable and secret keys
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`

Clerk uses keyless mode by default, so you can run without setting Clerk keys first.

4. Run migrations with Drizzle ORM:

- Ensure `DATABASE_URL` is set in `.env.local` (PostgreSQL connection to your Supabase DB).
- Keep `supabase/schema.sql` as source SQL for manual edits if needed.

Initialize/refresh schema with:

```bash
pnpm run db:push
```

This runs `drizzle-kit push` from the repo scripts.

5. Create the storage bucket:

- Bucket name: `test-uploads` (or match `SUPABASE_TEST_UPLOAD_BUCKET` in env).

6. Run the app

```bash
npm run dev
```

## App flows

### Roles

Users can switch role (Student / Teacher) in-app to test both workflows. A new Clerk user is created with role `student` by default in the `app_users` table.

### Teacher workflow

- Build and edit question bank entries.
- Create reusable tests from question banks.
- Grade student submissions in one click with OpenRouter.
- Upload handwritten test photos and run OCR to auto-populate answers.

### Student workflow

- Browse available tests.
- Submit all question answers.
- Receive AI-graded marks and feedback when teachers grade submissions.

### AI request contract for grading

For each question, the grader sends:

- `question`
- `marks`
- `teacher_answer`
- `student_answer`

Expected response:

```json
{ "marks_earned": 3, "feedback": "did not identify root cause" }
```

The marks are normalized by the backend and then stored per answer and summed on each attempt.

### OCR contract

OCR extracts an array like:

```json
{ "answers": [{ "question": "Question 1...", "answer": "Student response...", "question_index": 0 }] }
```

Then matching attempts are upserted into the submission answers.
