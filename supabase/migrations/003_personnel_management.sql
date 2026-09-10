-- NSWC personnel management expansion
-- Safe additive migration for ORBAT, LOA, profile metadata and portal administration.
-- Run after schema.sql and 002_portal.sql. Existing rows are preserved.

create extension if not exists pgcrypto;

alter table public.accounts add column if not exists leadership_level text not null default 'Member';
alter table public.accounts add column if not exists position_title text;
alter table public.accounts add column if not exists avatar_url text;

do $$ begin
  alter table public.accounts add constraint accounts_leadership_level_check check (leadership_level in ('Member','Team Leader','HQ'));
exception when duplicate_object then null; end $$;

create table if not exists public.orbat_slots (
  callsign text primary key,
  section_key text not null,
  section_title text not null,
  section_subtitle text not null default '',
  default_role text not null default 'Operator',
  sort_order integer not null default 100,
  active boolean not null default true
);

create table if not exists public.leave_of_absence (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text not null check (char_length(trim(reason)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','denied','withdrawn')),
  reviewed_by uuid references public.accounts(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '',
  constraint loa_dates_valid check (ends_on >= starts_on)
);

create index if not exists leave_of_absence_user_idx on public.leave_of_absence(user_id,created_at desc);
create index if not exists leave_of_absence_status_idx on public.leave_of_absence(status,created_at desc);
create index if not exists orbat_slots_sort_idx on public.orbat_slots(sort_order);

insert into public.orbat_slots(callsign,section_key,section_title,section_subtitle,default_role,sort_order) values
('E31','troop-hq','Troop HQ','3 Troop Command','Troop Chief',10),
('E32','troop-hq','Troop HQ','3 Troop Command','Troop Operations',20),
('EG1','golf','Golf Team','Assault Element','Team Leader',100),('EG2','golf','Golf Team','Assault Element','Operator',110),('EG3','golf','Golf Team','Assault Element','Operator',120),('EG4','golf','Golf Team','Assault Element','Operator',130),('EG5','golf','Golf Team','Assault Element','Operator',140),('EG6','golf','Golf Team','Assault Element','Operator',150),('EG7','golf','Golf Team','Assault Element','Operator',160),('EG8','golf','Golf Team','Assault Element','Operator',170),
('EH1','hotel','Hotel Team','Assault Element','Team Leader',200),('EH2','hotel','Hotel Team','Assault Element','Operator',210),('EH3','hotel','Hotel Team','Assault Element','Operator',220),('EH4','hotel','Hotel Team','Assault Element','Operator',230),('EH5','hotel','Hotel Team','Assault Element','Operator',240),('EH6','hotel','Hotel Team','Assault Element','Operator',250),('EH7','hotel','Hotel Team','Assault Element','Operator',260),('EH8','hotel','Hotel Team','Assault Element','Operator',270),
('EI1','india','India Team','Reconnaissance Element','Team Leader',300),('EI2','india','India Team','Reconnaissance Element','Operator',310),('EI3','india','India Team','Reconnaissance Element','Operator',320),('EI4','india','India Team','Reconnaissance Element','Operator',330),
('EU1','enablers','Enablers','Attached Support','CCT',400),('EU2','enablers','Enablers','Attached Support','CCT',410),('EN1','enablers','Enablers','Attached Support','EOD',420),('EY1','enablers','Enablers','Attached Support','Combatant Craft',430),('EP1','enablers','Enablers','Attached Support','PJ',440),('EP2','enablers','Enablers','Attached Support','PJ',450)
on conflict (callsign) do nothing;

create or replace function public.portal_can_review_loa(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = auth.uid() and exists (
    select 1 from public.accounts a
    where a.id=p_user and a.account_status='active'
      and (a.is_admin or a.leadership_level in ('Team Leader','HQ'))
  );
$$;

create or replace function public.portal_can_review_loa_record(p_loa uuid,p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user=auth.uid() and exists (
    select 1
    from public.leave_of_absence l
    join public.accounts reviewer on reviewer.id=p_user
    join public.accounts subject on subject.id=l.user_id
    where l.id=p_loa
      and reviewer.account_status='active'
      and (
        reviewer.is_admin
        or reviewer.leadership_level='HQ'
        or (reviewer.leadership_level='Team Leader' and nullif(reviewer.team,'') is not null and reviewer.team=subject.team)
      )
  );
$$;

alter table public.orbat_slots enable row level security;
alter table public.leave_of_absence enable row level security;

drop policy if exists orbat_slots_select on public.orbat_slots;
create policy orbat_slots_select on public.orbat_slots for select to authenticated using (active=true or public.is_admin());

drop policy if exists orbat_slots_admin on public.orbat_slots;
create policy orbat_slots_admin on public.orbat_slots for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists loa_select on public.leave_of_absence;
create policy loa_select on public.leave_of_absence for select to authenticated
using (user_id=auth.uid() or public.portal_can_review_loa_record(id,auth.uid()));

drop policy if exists loa_insert on public.leave_of_absence;
create policy loa_insert on public.leave_of_absence for insert to authenticated
with check (user_id=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null);

drop policy if exists loa_update_own on public.leave_of_absence;
create policy loa_update_own on public.leave_of_absence for update to authenticated
using (user_id=auth.uid() and status='pending')
with check (user_id=auth.uid() and status in ('pending','withdrawn') and reviewed_by is null and reviewed_at is null);

create or replace function public.get_loa_people()
returns table (
  id uuid, display_name text, fictional_first_name text, fictional_last_name text,
  callsign text, team text, branch text, navy_rank text, army_rank text, air_force_rank text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,trim(concat_ws(' ',a.fictional_first_name,a.fictional_last_name)),a.fictional_first_name,a.fictional_last_name,
         a.callsign,a.team,a.branch,a.navy_rank,a.army_rank,a.air_force_rank
  from public.accounts a
  where a.account_status='active'
    and (a.id=auth.uid() or public.portal_can_review_loa(auth.uid()))
  order by a.fictional_last_name nulls last,a.fictional_first_name nulls last,a.callsign nulls last;
$$;

create or replace function public.review_loa(p_loa uuid,p_status text,p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('approved','denied') then raise exception 'Invalid LOA review status'; end if;
  if not public.portal_can_review_loa_record(p_loa,auth.uid()) then raise exception 'Not authorized to review this LOA'; end if;
  update public.leave_of_absence
  set status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),review_note=coalesce(p_note,''),updated_at=now()
  where id=p_loa and status='pending';
  if not found then raise exception 'LOA request is no longer pending'; end if;
end;
$$;

create or replace function public.get_orbat()
returns table (
  section_key text,section_title text,section_subtitle text,sort_order integer,callsign text,default_role text,
  user_id uuid,email text,fictional_first_name text,fictional_last_name text,branch text,navy_rank text,army_rank text,air_force_rank text,
  billet text,team text,avatar_url text,rank text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.section_key,s.section_title,s.section_subtitle,s.sort_order,s.callsign,s.default_role,
         a.id,a.email,a.fictional_first_name,a.fictional_last_name,a.branch,a.navy_rank,a.army_rank,a.air_force_rank,
         a.billet,a.team,a.avatar_url,
         case a.branch when 'Navy' then a.navy_rank when 'Army' then a.army_rank when 'Air Force' then a.air_force_rank else null end
  from public.orbat_slots s
  left join public.accounts a on a.callsign=s.callsign and a.account_status='active'
  where s.active=true
  order by s.sort_order,s.callsign;
$$;

create or replace function public.get_admin_accounts()
returns setof public.accounts
language sql
stable
security definer
set search_path = ''
as $$
  select a.* from public.accounts a where public.is_admin() order by a.callsign nulls last,a.fictional_last_name nulls last;
$$;

create or replace function public.admin_update_account(
  p_id uuid,p_first_name text,p_last_name text,p_callsign text,p_branch text,
  p_navy_rank text,p_army_rank text,p_air_force_rank text,p_billet text,p_team text,p_squadron text,p_troop text,
  p_leadership_level text,p_is_admin boolean,p_is_cadre boolean,p_is_candidate boolean,p_account_status text,p_position_title text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_branch is not null and p_branch not in ('Navy','Army','Air Force') then raise exception 'Invalid branch'; end if;
  if p_leadership_level not in ('Member','Team Leader','HQ') then raise exception 'Invalid leadership level'; end if;
  if p_account_status not in ('active','inactive','suspended','retired') then raise exception 'Invalid account status'; end if;
  if p_callsign is not null and not exists(select 1 from public.orbat_slots where callsign=p_callsign and active=true) then raise exception 'Unknown or inactive callsign'; end if;

  update public.accounts set
    fictional_first_name=nullif(trim(p_first_name),''),fictional_last_name=nullif(trim(p_last_name),''),callsign=nullif(trim(p_callsign),''),
    branch=p_branch,
    navy_rank=case when p_branch='Navy' then nullif(trim(p_navy_rank),'') else null end,
    army_rank=case when p_branch='Army' then nullif(trim(p_army_rank),'') else null end,
    air_force_rank=case when p_branch='Air Force' then nullif(trim(p_air_force_rank),'') else null end,
    billet=nullif(trim(p_billet),''),position_title=nullif(trim(p_position_title),''),team=nullif(trim(p_team),''),
    squadron=nullif(trim(p_squadron),''),troop=nullif(trim(p_troop),''),leadership_level=p_leadership_level,
    is_admin=p_is_admin,is_cadre=p_is_cadre,is_candidate=p_is_candidate,account_status=p_account_status
  where id=p_id;
  if not found then raise exception 'Account not found'; end if;
end;
$$;

revoke all on function public.portal_can_review_loa(uuid) from public;
revoke all on function public.portal_can_review_loa_record(uuid,uuid) from public;
revoke all on function public.get_loa_people() from public;
revoke all on function public.review_loa(uuid,text,text) from public;
revoke all on function public.get_orbat() from public;
revoke all on function public.get_admin_accounts() from public;
revoke all on function public.admin_update_account(uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,text,text) from public;

grant execute on function public.portal_can_review_loa(uuid) to authenticated;
grant execute on function public.portal_can_review_loa_record(uuid,uuid) to authenticated;
grant execute on function public.get_loa_people() to authenticated;
grant execute on function public.review_loa(uuid,text,text) to authenticated;
grant execute on function public.get_orbat() to authenticated;
grant execute on function public.get_admin_accounts() to authenticated;
grant execute on function public.admin_update_account(uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,text,text) to authenticated;

grant select,insert,update,delete on public.orbat_slots to authenticated;
grant select,insert,update on public.leave_of_absence to authenticated;
revoke all on public.orbat_slots from anon;
revoke all on public.leave_of_absence from anon;
