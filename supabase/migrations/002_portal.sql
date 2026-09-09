-- NSWC portal expansion
-- Run after the existing public.accounts schema.

create extension if not exists pgcrypto;

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.accounts(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  session_type text not null check (session_type in ('Green Team','Pro Development','Official Training')),
  starts_at timestamptz not null,
  location text not null default 'Undecided' check (location in ('Dam Neck Annex','Mid-South Institute','Fort Johnson','Undecided')),
  status text not null default 'scheduled' check (status in ('scheduled','completed','postponed','cancelled')),
  aar text not null default '',
  completed_at timestamptz
);

create table if not exists public.session_responses (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references public.accounts(id) on delete cascade,
  response text not null check (response in ('attending','not_attending','tentative')),
  tentative_reason text,
  responded_at timestamptz not null default now(),
  primary key (session_id,user_id),
  constraint tentative_requires_reason check (response <> 'tentative' or nullif(trim(tentative_reason),'') is not null)
);

create table if not exists public.session_attendance (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references public.accounts(id) on delete cascade,
  outcome text not null check (outcome in ('attended','late','absent')),
  marked_by uuid not null references public.accounts(id) on delete restrict,
  marked_at timestamptz not null default now(),
  primary key (session_id,user_id)
);

create table if not exists public.session_reviews (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  subject_id uuid not null references public.accounts(id) on delete cascade,
  instructor_id uuid not null references public.accounts(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  review text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id,subject_id,instructor_id)
);

create table if not exists public.qualifications (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text unique not null,
  category text not null default 'General',
  sort_order integer not null default 100
);

create table if not exists public.member_qualifications (
  user_id uuid not null references public.accounts(id) on delete cascade,
  qualification_id uuid not null references public.qualifications(id) on delete restrict,
  awarded_by uuid not null references public.accounts(id) on delete restrict,
  awarded_at date not null default current_date,
  expires_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id,qualification_id),
  constraint qualification_expiry_valid check (expires_at is null or expires_at >= awarded_at)
);

create index if not exists training_sessions_starts_idx on public.training_sessions(starts_at);
create index if not exists training_sessions_type_idx on public.training_sessions(session_type);
create index if not exists responses_user_idx on public.session_responses(user_id);
create index if not exists attendance_user_idx on public.session_attendance(user_id);
create index if not exists reviews_subject_idx on public.session_reviews(subject_id);
create index if not exists member_qual_user_idx on public.member_qualifications(user_id);

insert into public.qualifications (code,name,category,sort_order) values
('DIVSUP','Diving Supervisor','Core',10),
('SLJM','Static-line Jumpmaster','Core',20),
('SARSO','Small Arms RSO','Range Safety',30),
('DYNRRSO','Dynamic Range RSO','Range Safety',40),
('DEMRSO','Demolitions RSO','Range Safety',50),
('IFRSO','Indirect Fire RSO','Range Safety',60),
('ROCKETRSO','Rockets RSO','Range Safety',70),
('CQCRSO','Close Quarters Combat RSO','Range Safety',80),
('EBRSO','Explosive Breaching RSO','Range Safety',90),
('LASERRSO','Laser RSO','Range Safety',100),
('DGMVRSO','Dynamic Ground Mobility Vehicle Range RSO','Range Safety',110),
('DWRRSO','Dynamic Waterborne Range RSO','Range Safety',120),
('DZSO','Drop-Zone Safety Officer','Air Operations',130),
('HRSTM','HRST/C MASTER','Air Operations',140),
('HRSTMI','HRST/C MASTER INSTRUCTOR','Air Operations',150),
('MTS','Master Training Specialist (MTS)','Instruction',160),
('AIROPS','AIR OPS TRAINER','Air Operations',170),
('AIROPSEX','AIROPS TRAINER EXAMINER','Air Operations',180),
('ROIC','Range Officer In Charge (ROIC)','Range Safety',190),
('ASOT2','ASOT II','Advanced',200),
('ASOT3','ASOT III','Advanced',210),
('TSO','Technical Surveillance Operations','Advanced',220),
('USNI','USN Instructor','Instruction',230),
('LANG','Language Qualification','Advanced',240),
('MFFJM','Military Freefall Jumpmaster','Air Operations',250),
('NSWAOT','NSW Air Ops Trainer','Air Operations',260),
('NSWAOTE','NSW Air Ops Trainer Examiner','Air Operations',270),
('SNIPER','NSW Sniper','Advanced',280),
('COMMS','NSW Communicator','Advanced',290),
('BREACH','NSW Breacher','Advanced',300),
('JTAC','JTAC','Fires',310),
('JTACI','JTAC Instructor','Fires',320),
('JTACE','JTAC Evaluator','Fires',330),
('SDVOP','SDV Operator','Maritime',340),
('SDVDVS','SDV Diving Supervisor','Maritime',350),
('ASDS','ASDS Lock In/Out Supervisor','Maritime',360),
('NSWMED','NSW Medic','Medical',370),
('OOM','Outboard Overhaul Mechanic','Maritime',380)
on conflict (code) do update set name=excluded.name, category=excluded.category, sort_order=excluded.sort_order;

create or replace function public.portal_is_candidate(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select a.is_candidate or lower(a.email) like '%@candidate.mil' from public.accounts a where a.id=p_user),false);
$$;

create or replace function public.portal_has_qualification(p_user uuid,p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_qualifications mq
    join public.qualifications q on q.id=mq.qualification_id
    where mq.user_id=p_user
      and q.name=p_name
      and (mq.expires_at is null or mq.expires_at >= current_date)
  );
$$;

create or replace function public.portal_is_instructor(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select a.is_admin from public.accounts a where a.id=p_user),false)
         or public.portal_has_qualification(p_user,'USN Instructor');
$$;

create or replace function public.portal_can_view_session(p_session uuid,p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.training_sessions s
    where s.id=p_session
      and (
        (public.portal_is_candidate(p_user) and s.session_type='Green Team')
        or not public.portal_is_candidate(p_user)
      )
  );
$$;

create or replace function public.portal_can_manage_session(p_session uuid,p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.training_sessions s
    where s.id=p_session
      and (
        public.portal_is_instructor(p_user)
        or (s.created_by=p_user and s.session_type='Pro Development' and not public.portal_is_candidate(p_user))
      )
  );
$$;

revoke all on function public.portal_is_candidate(uuid) from public;
revoke all on function public.portal_has_qualification(uuid,text) from public;
revoke all on function public.portal_is_instructor(uuid) from public;
revoke all on function public.portal_can_view_session(uuid,uuid) from public;
revoke all on function public.portal_can_manage_session(uuid,uuid) from public;
grant execute on function public.portal_is_candidate(uuid) to authenticated;
grant execute on function public.portal_has_qualification(uuid,text) to authenticated;
grant execute on function public.portal_is_instructor(uuid) to authenticated;
grant execute on function public.portal_can_view_session(uuid,uuid) to authenticated;
grant execute on function public.portal_can_manage_session(uuid,uuid) to authenticated;

alter table public.training_sessions enable row level security;
alter table public.session_responses enable row level security;
alter table public.session_attendance enable row level security;
alter table public.session_reviews enable row level security;
alter table public.qualifications enable row level security;
alter table public.member_qualifications enable row level security;

drop policy if exists training_sessions_select on public.training_sessions;
create policy training_sessions_select on public.training_sessions
for select to authenticated
using (public.portal_can_view_session(id,auth.uid()));

drop policy if exists training_sessions_insert on public.training_sessions;
create policy training_sessions_insert on public.training_sessions
for insert to authenticated
with check (
  created_by=auth.uid()
  and not public.portal_is_candidate(auth.uid())
  and (
    session_type='Pro Development'
    or public.portal_is_instructor(auth.uid())
  )
);

drop policy if exists training_sessions_update on public.training_sessions;
create policy training_sessions_update on public.training_sessions
for update to authenticated
using (public.portal_can_manage_session(id,auth.uid()))
with check (public.portal_can_manage_session(id,auth.uid()));

drop policy if exists training_sessions_delete on public.training_sessions;
create policy training_sessions_delete on public.training_sessions
for delete to authenticated
using (public.portal_can_manage_session(id,auth.uid()));

drop policy if exists responses_select on public.session_responses;
create policy responses_select on public.session_responses
for select to authenticated
using (public.portal_can_view_session(session_id,auth.uid()));

drop policy if exists responses_insert on public.session_responses;
create policy responses_insert on public.session_responses
for insert to authenticated
with check (user_id=auth.uid() and public.portal_can_view_session(session_id,auth.uid()));

drop policy if exists responses_update on public.session_responses;
create policy responses_update on public.session_responses
for update to authenticated
using (user_id=auth.uid() and public.portal_can_view_session(session_id,auth.uid()))
with check (user_id=auth.uid() and public.portal_can_view_session(session_id,auth.uid()));

drop policy if exists responses_delete on public.session_responses;
create policy responses_delete on public.session_responses
for delete to authenticated
using (user_id=auth.uid() or public.portal_is_instructor(auth.uid()));

drop policy if exists attendance_select on public.session_attendance;
create policy attendance_select on public.session_attendance
for select to authenticated
using (public.portal_can_view_session(session_id,auth.uid()) or public.portal_is_instructor(auth.uid()));

drop policy if exists attendance_all_instructor on public.session_attendance;
create policy attendance_all_instructor on public.session_attendance
for all to authenticated
using (public.portal_is_instructor(auth.uid()))
with check (public.portal_is_instructor(auth.uid()) and marked_by=auth.uid());

drop policy if exists reviews_select on public.session_reviews;
create policy reviews_select on public.session_reviews
for select to authenticated
using (subject_id=auth.uid() or public.portal_is_instructor(auth.uid()));

drop policy if exists reviews_all_instructor on public.session_reviews;
create policy reviews_all_instructor on public.session_reviews
for all to authenticated
using (public.portal_is_instructor(auth.uid()))
with check (public.portal_is_instructor(auth.uid()) and instructor_id=auth.uid());

drop policy if exists qualifications_select on public.qualifications;
create policy qualifications_select on public.qualifications
for select to authenticated using (true);

drop policy if exists member_qualifications_select on public.member_qualifications;
create policy member_qualifications_select on public.member_qualifications
for select to authenticated using (true);

drop policy if exists member_qualifications_insert on public.member_qualifications;
create policy member_qualifications_insert on public.member_qualifications
for insert to authenticated
with check (public.portal_is_instructor(auth.uid()) and awarded_by=auth.uid());

drop policy if exists member_qualifications_update on public.member_qualifications;
create policy member_qualifications_update on public.member_qualifications
for update to authenticated
using (public.portal_is_instructor(auth.uid()))
with check (public.portal_is_instructor(auth.uid()));

drop policy if exists member_qualifications_delete on public.member_qualifications;
create policy member_qualifications_delete on public.member_qualifications
for delete to authenticated
using (public.portal_is_instructor(auth.uid()));

create or replace function public.get_portal_people()
returns table (
  id uuid,
  display_name text,
  fictional_first_name text,
  fictional_last_name text,
  callsign text,
  email text,
  branch text,
  navy_rank text,
  army_rank text,
  air_force_rank text,
  billet text,
  team text,
  unit_joined_at date,
  is_candidate boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
         trim(concat_ws(' ',a.fictional_first_name,a.fictional_last_name)),
         a.fictional_first_name,a.fictional_last_name,a.callsign,a.email,a.branch,
         a.navy_rank,a.army_rank,a.air_force_rank,a.billet,a.team,a.unit_joined_at,
         (a.is_candidate or lower(a.email) like '%@candidate.mil')
  from public.accounts a
  where a.account_status='active'
    and (
      not public.portal_is_candidate(auth.uid())
      or a.is_candidate
      or lower(a.email) like '%@candidate.mil'
    )
  order by a.fictional_last_name nulls last,a.fictional_first_name nulls last,a.callsign nulls last;
$$;

create or replace function public.get_session_roster(p_session uuid)
returns table (
  id uuid,
  display_name text,
  callsign text,
  is_candidate boolean,
  response text,
  tentative_reason text,
  outcome text,
  my_rating integer,
  my_review text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
         trim(concat_ws(' ',a.fictional_first_name,a.fictional_last_name)),
         a.callsign,
         (a.is_candidate or lower(a.email) like '%@candidate.mil'),
         r.response,r.tentative_reason,sa.outcome,sr.rating,sr.review
  from public.training_sessions s
  join public.accounts a on a.account_status='active'
    and (
      (s.session_type='Green Team' and (a.is_candidate or lower(a.email) like '%@candidate.mil'))
      or (s.session_type='Official Training' and not (a.is_candidate or lower(a.email) like '%@candidate.mil'))
      or (s.session_type='Pro Development' and not (a.is_candidate or lower(a.email) like '%@candidate.mil'))
    )
  left join public.session_responses r on r.session_id=s.id and r.user_id=a.id
  left join public.session_attendance sa on sa.session_id=s.id and sa.user_id=a.id
  left join public.session_reviews sr on sr.session_id=s.id and sr.subject_id=a.id and sr.instructor_id=auth.uid()
  where s.id=p_session
    and public.portal_can_view_session(s.id,auth.uid())
  order by a.fictional_last_name nulls last,a.fictional_first_name nulls last,a.callsign nulls last;
$$;

create or replace function public.get_attendance_leaderboard(p_cohort text default 'full')
returns table (
  id uuid,
  display_name text,
  callsign text,
  unit_joined_at date,
  eligible_sessions bigint,
  attended bigint,
  late bigint,
  absent bigint,
  attendance_percent numeric,
  average_review numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select a.id,
           trim(concat_ws(' ',a.fictional_first_name,a.fictional_last_name)) as display_name,
           a.callsign,a.unit_joined_at,
           (a.is_candidate or lower(a.email) like '%@candidate.mil') as candidate
    from public.accounts a
    where a.account_status='active'
      and case when p_cohort='green'
               then (a.is_candidate or lower(a.email) like '%@candidate.mil')
               else not (a.is_candidate or lower(a.email) like '%@candidate.mil') end
      and (not public.portal_is_candidate(auth.uid()) or (a.is_candidate or lower(a.email) like '%@candidate.mil'))
  ), eligible as (
    select p.id as user_id,s.id as session_id
    from people p
    join public.training_sessions s
      on s.status='completed'
     and s.starts_at::date >= p.unit_joined_at
     and ((p.candidate and s.session_type='Green Team') or (not p.candidate and s.session_type='Official Training'))
  ), reviews as (
    select sr.subject_id,avg(sr.rating)::numeric(4,2) as avg_rating
    from public.session_reviews sr
    group by sr.subject_id
  )
  select p.id,p.display_name,p.callsign,p.unit_joined_at,
         count(e.session_id)::bigint,
         count(*) filter (where sa.outcome='attended')::bigint,
         count(*) filter (where sa.outcome='late')::bigint,
         count(*) filter (where sa.outcome='absent' or (e.session_id is not null and sa.outcome is null))::bigint,
         case when count(e.session_id)=0 then 100::numeric
              else round((100.0 * count(*) filter (where sa.outcome in ('attended','late'))) / count(e.session_id),1) end,
         coalesce(r.avg_rating,0)::numeric
  from people p
  left join eligible e on e.user_id=p.id
  left join public.session_attendance sa on sa.session_id=e.session_id and sa.user_id=p.id
  left join reviews r on r.subject_id=p.id
  group by p.id,p.display_name,p.callsign,p.unit_joined_at,r.avg_rating
  order by 8 desc,p.display_name;
$$;

revoke all on function public.get_portal_people() from public;
revoke all on function public.get_session_roster(uuid) from public;
revoke all on function public.get_attendance_leaderboard(text) from public;
grant execute on function public.get_portal_people() to authenticated;
grant execute on function public.get_session_roster(uuid) to authenticated;
grant execute on function public.get_attendance_leaderboard(text) to authenticated;

grant select,insert,update,delete on public.training_sessions to authenticated;
grant select,insert,update,delete on public.session_responses to authenticated;
grant select,insert,update,delete on public.session_attendance to authenticated;
grant select,insert,update,delete on public.session_reviews to authenticated;
grant select on public.qualifications to authenticated;
grant select,insert,update,delete on public.member_qualifications to authenticated;

revoke all on public.training_sessions from anon;
revoke all on public.session_responses from anon;
revoke all on public.session_attendance from anon;
revoke all on public.session_reviews from anon;
revoke all on public.qualifications from anon;
revoke all on public.member_qualifications from anon;
