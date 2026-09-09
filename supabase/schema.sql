-- NSWC personnel schema for Supabase
-- Run this entire file once in the Supabase SQL Editor.
-- Passwords are NOT stored in public.accounts. Supabase Auth stores password hashes securely in auth.users.

create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unit_joined_at date not null default current_date,

  email text not null,
  fictional_first_name text,
  fictional_last_name text,

  branch text check (branch in ('Navy', 'Army', 'Air Force')),
  navy_rank text,
  army_rank text,
  air_force_rank text,

  callsign text unique,
  billet text,
  team text,
  squadron text,
  troop text,

  is_admin boolean not null default false,
  is_cadre boolean not null default false,
  is_candidate boolean not null default true,

  account_status text not null default 'active' check (account_status in ('active', 'inactive', 'suspended', 'retired')),

  discord_id text,
  steam64_id text,
  timezone text,
  notes text,

  last_seen_at timestamptz,

  constraint branch_rank_consistency check (
    branch is null
    or (branch = 'Navy' and army_rank is null and air_force_rank is null)
    or (branch = 'Army' and navy_rank is null and air_force_rank is null)
    or (branch = 'Air Force' and navy_rank is null and army_rank is null)
  )
);

create index if not exists accounts_branch_idx on public.accounts(branch);
create index if not exists accounts_team_idx on public.accounts(team);
create index if not exists accounts_status_idx on public.accounts(account_status);
create index if not exists accounts_admin_idx on public.accounts(is_admin) where is_admin = true;

alter table public.accounts enable row level security;

-- Returns true only when the currently authenticated user has an active admin account.
-- SECURITY DEFINER avoids recursive RLS evaluation while the function checks public.accounts.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.accounts
    where id = auth.uid()
      and is_admin = true
      and account_status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Every authenticated member may read only their own account.
drop policy if exists "accounts_select_self" on public.accounts;
create policy "accounts_select_self"
on public.accounts
for select
to authenticated
using (id = auth.uid());

-- Active administrators may read all personnel records.
drop policy if exists "accounts_select_admin" on public.accounts;
create policy "accounts_select_admin"
on public.accounts
for select
to authenticated
using (public.is_admin());

-- Only active administrators may modify personnel records through the authenticated client.
drop policy if exists "accounts_update_admin" on public.accounts;
create policy "accounts_update_admin"
on public.accounts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No INSERT or DELETE policy is intentionally granted to normal authenticated browser clients.
-- Account rows are created by the auth trigger below. Deleting an auth user cascades the account row.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
before update on public.accounts
for each row
execute function public.set_updated_at();

-- Create a personnel row whenever a Supabase Auth user is created.
-- Optional user metadata can prefill profile fields, but administration can edit them later.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- Keep the public account email synchronized with Supabase Auth.
create or replace function public.handle_auth_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.accounts
    set email = coalesce(new.email, '')
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
after update of email on auth.users
for each row
execute function public.handle_auth_email_change();

-- Safe self-service RPC used by the portal to record activity.
create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.accounts
  set last_seen_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

-- Recommended explicit table grants. RLS still controls which rows can be accessed.
revoke all on table public.accounts from anon;
grant select, update on table public.accounts to authenticated;

-- BOOTSTRAP YOUR FIRST ADMIN AFTER CREATING THAT USER IN SUPABASE AUTH:
-- update public.accounts
-- set is_admin = true,
--     is_candidate = false,
--     fictional_first_name = 'YourFictionalFirstName',
--     fictional_last_name = 'YourFictionalLastName',
--     callsign = 'EG1',
--     branch = 'Navy',
--     navy_rank = 'E-6'
-- where email = 'your-email@example.com';
