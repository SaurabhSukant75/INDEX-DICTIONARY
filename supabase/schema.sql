create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  leaderboard_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create table if not exists public.reading_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null check (book_id !~ '^import-'),
  page_id text,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.path_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  path_id text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, path_id)
);

alter table public.profiles enable row level security;
alter table public.reading_progress enable row level security;
alter table public.path_progress enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can manage their own reading progress" on public.reading_progress;
create policy "Users can manage their own reading progress"
  on public.reading_progress for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own path progress" on public.path_progress;
create policy "Users can manage their own path progress"
  on public.path_progress for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.reading_progress, public.path_progress from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.reading_progress, public.path_progress to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    'reader_' || left(replace(new.id::text, '-', ''), 16)
  );

  insert into public.profiles (id, username)
  values (new.id, requested_username);
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

insert into public.profiles (id, username)
select u.id, 'reader_' || left(replace(u.id::text, '-', ''), 16)
from auth.users as u
on conflict (id) do nothing;

create or replace function public.get_public_leaderboard()
returns table (username text, completed_books bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.username, count(r.book_id)::bigint as completed_books
  from public.profiles as p
  left join public.reading_progress as r
    on r.user_id = p.id and r.completed = true
  where p.leaderboard_opt_in = true
  group by p.id, p.username
  order by completed_books desc, p.username asc
  limit 50;
$$;

revoke all on function public.get_public_leaderboard() from public;
grant execute on function public.get_public_leaderboard() to anon, authenticated;
