-- ═══════════════════════════════════════════════════════════
--  QEMaker — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- ── Enable UUID extension ──────────────────────────────────
create extension if not exists "pgcrypto";

-- ── 1. admins ──────────────────────────────────────────────
-- Mirrors auth.users for admin-specific metadata.
create table if not exists public.admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  name        text,
  picture     text,
  created_at  timestamptz default now()
);

-- ── 2. classes ─────────────────────────────────────────────
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  admin_id    uuid not null references public.admins(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ── 3. quizzes ─────────────────────────────────────────────
create table if not exists public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  class_id    uuid not null references public.classes(id) on delete cascade,
  class_code  text not null,
  admin_id    uuid not null references public.admins(id) on delete cascade,
  questions   jsonb not null default '[]',   -- array of Question objects
  raw_input   text,
  is_active   boolean not null default true,
  created_at  timestamptz default now()
);

-- ── 4. submissions ─────────────────────────────────────────
create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes(id) on delete cascade,
  class_id     uuid not null references public.classes(id) on delete cascade,
  class_code   text,
  email        text not null,
  full_name    text not null,
  section      text not null,
  year_course  text not null,
  answers      jsonb not null default '[]',  -- array of AnswerRecord objects
  score        int  not null default 0,
  total        int  not null default 0,
  percentage   int  not null default 0,
  submitted_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════════
--  Row Level Security (RLS)
-- ══════════════════════════════════════════════════════════

alter table public.admins     enable row level security;
alter table public.classes    enable row level security;
alter table public.quizzes    enable row level security;
alter table public.submissions enable row level security;

-- ── admins ─────────────────────────────────────────────────
-- Admins can only read/write their own row
create policy "admins: own row read"
  on public.admins for select
  using (auth.uid() = id);

create policy "admins: own row insert"
  on public.admins for insert
  with check (auth.uid() = id);

create policy "admins: own row update"
  on public.admins for update
  using (auth.uid() = id);

-- ── classes ────────────────────────────────────────────────
-- Admin can CRUD their own classes
create policy "classes: admin read own"
  on public.classes for select
  using (admin_id = auth.uid());

create policy "classes: admin insert"
  on public.classes for insert
  with check (admin_id = auth.uid());

create policy "classes: admin delete"
  on public.classes for delete
  using (admin_id = auth.uid());

-- ── quizzes ────────────────────────────────────────────────
-- Admins can CRUD their own quizzes
create policy "quizzes: admin read own"
  on public.quizzes for select
  using (admin_id = auth.uid());

create policy "quizzes: admin insert"
  on public.quizzes for insert
  with check (admin_id = auth.uid());

create policy "quizzes: admin update"
  on public.quizzes for update
  using (admin_id = auth.uid());

create policy "quizzes: admin delete"
  on public.quizzes for delete
  using (admin_id = auth.uid());

-- Students (anon) can read ACTIVE quizzes by ID (for taking the quiz)
create policy "quizzes: anon read active"
  on public.quizzes for select
  using (is_active = true);

-- ── submissions ────────────────────────────────────────────
-- Anyone (anon) can insert a submission
create policy "submissions: anon insert"
  on public.submissions for insert
  with check (true);

-- Admins can read submissions for their own quizzes
create policy "submissions: admin read own"
  on public.submissions for select
  using (
    quiz_id in (
      select id from public.quizzes where admin_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════
--  Indexes for performance
-- ══════════════════════════════════════════════════════════
create index if not exists idx_classes_admin_id    on public.classes(admin_id);
create index if not exists idx_quizzes_admin_id    on public.quizzes(admin_id);
create index if not exists idx_quizzes_class_id    on public.quizzes(class_id);
create index if not exists idx_submissions_quiz_id on public.submissions(quiz_id);
create index if not exists idx_submissions_email   on public.submissions(email);

-- ══════════════════════════════════════════════════════════
--  Trigger: auto-create admin row on first Google sign-in
-- ══════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.admins (id, email, name, picture)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update set
    name    = excluded.name,
    picture = excluded.picture;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();