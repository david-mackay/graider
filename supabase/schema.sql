create extension if not exists "pgcrypto";

create table if not exists public.app_users (
  id text primary key,
  email text,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null references public.app_users(id) on delete cascade,
  name text not null,
  invite_code text not null unique,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id text not null references public.app_users(id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  status text not null default 'active' check (status in ('active', 'pending')),
  created_at timestamptz default timezone('utc', now()),
  unique (class_id, user_id)
);

create table if not exists public.class_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  invited_email text,
  invitation_code text not null unique,
  invited_by text not null references public.app_users(id) on delete cascade,
  student_id text references public.app_users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null references public.app_users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  prompt text not null,
  correct_answer text not null,
  marks integer not null check (marks >= 0),
  topic text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id text not null references public.app_users(id) on delete cascade,
  title text not null,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  sort_order integer not null default 0,
  unique (test_id, question_id)
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id text not null references public.app_users(id) on delete cascade,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'graded')),
  total_marks integer,
  max_marks integer,
  submitted_at timestamptz,
  graded_at timestamptz,
  ocr_uploads text[] not null default '{}'::text[],
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  student_answer text not null default '',
  marks_earned integer,
  feedback text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now()),
  unique (attempt_id, question_id)
);

create table if not exists public.ocr_batches (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  grader_teacher_id text not null references public.app_users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz default timezone('utc', now())
);

create index if not exists class_memberships_class_id_idx on public.class_memberships (class_id);
create index if not exists class_memberships_user_id_idx on public.class_memberships (user_id);
create index if not exists class_invitations_code_idx on public.class_invitations (invitation_code);
create index if not exists class_invitations_class_id_idx on public.class_invitations (class_id);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_question_bank_updated_at on public.question_bank;
create trigger touch_question_bank_updated_at
before update on public.question_bank
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_tests_updated_at on public.tests;
create trigger touch_tests_updated_at
before update on public.tests
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_test_attempts_updated_at on public.test_attempts;
create trigger touch_test_attempts_updated_at
before update on public.test_attempts
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_attempt_answers_updated_at on public.attempt_answers;
create trigger touch_attempt_answers_updated_at
before update on public.attempt_answers
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_classes_updated_at on public.classes;
create trigger touch_classes_updated_at
before update on public.classes
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_class_invitations_updated_at on public.class_invitations;
create trigger touch_class_invitations_updated_at
before update on public.class_invitations
for each row execute procedure public.touch_updated_at();

drop function if exists public.get_test_questions_with_bank(uuid);
create or replace function public.get_test_questions_with_bank(p_test_id uuid)
returns table(question_id uuid, prompt text, correct_answer text, marks integer, sort_order integer)
language sql stable as $$
  select q.id, q.prompt, q.correct_answer, q.marks, tq.sort_order
  from public.test_questions tq
  join public.question_bank q on q.id = tq.question_id
  where tq.test_id = p_test_id
  order by tq.sort_order asc;
$$;
