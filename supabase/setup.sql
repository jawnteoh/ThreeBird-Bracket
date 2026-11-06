-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.tournament (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tournament enable row level security;

-- Everyone can read (the public page).
drop policy if exists "Anyone can read the tournament" on public.tournament;
create policy "Anyone can read the tournament"
  on public.tournament for select
  to anon, authenticated
  using (true);

-- Only signed-in users (the organizer) can write.
drop policy if exists "Organizer can insert" on public.tournament;
create policy "Organizer can insert"
  on public.tournament for insert
  to authenticated
  with check (true);

drop policy if exists "Organizer can update" on public.tournament;
create policy "Organizer can update"
  on public.tournament for update
  to authenticated
  using (true)
  with check (true);

insert into public.tournament (id) values ('main') on conflict (id) do nothing;

-- Live updates for everyone watching.
do $$
begin
  alter publication supabase_realtime add table public.tournament;
exception when duplicate_object then null;
end $$;
