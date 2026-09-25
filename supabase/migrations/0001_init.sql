-- Hotel Ops Sales Tracker — initial schema
-- Multi-tenant ready: every row belongs to an organization; users reach rows through org_members.

create extension if not exists pgcrypto;

-- ───────────────────────── Organizations ─────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My workspace',
  pricing jsonb not null default '{
    "founding": {"label":"Founding Customer","setup_fee":2000,"monthly":500,"contract_months":13,"free_months":1},
    "standard": {"label":"Standard","setup_fee":1500,"monthly":799,"contract_months":12,"free_months":0}
  }'::jsonb,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.org_members(user_id);

create or replace function public.user_org_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.org_members where user_id = auth.uid()
$$;

create or replace function public.default_org_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.org_members where user_id = auth.uid() order by created_at limit 1
$$;

-- New user → personal organization
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_org uuid;
begin
  insert into public.organizations(name) values (coalesce(split_part(new.email,'@',1),'My') || '''s workspace')
  returning id into new_org;
  insert into public.org_members(org_id, user_id, role) values (new_org, new.id, 'owner');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── Hotels ─────────────────────────
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org_id() references public.organizations(id) on delete cascade,
  name text not null,
  brand text,
  management_company text,
  ownership_type text check (ownership_type in ('independent','franchise','corporate')),
  address text,
  city text,
  phone text,
  website text,
  maps_url text,
  rooms int,
  airport boolean not null default false,
  shuttle boolean not null default false,
  shuttle_24h boolean not null default false,
  long_term_parking boolean not null default false,
  short_term_parking boolean not null default false,
  restaurant boolean not null default false,
  meeting_space boolean not null default false,
  front_desk_24h boolean not null default true,
  pms text,
  ops_software text,
  notes text,
  tags text[] not null default '{}',

  -- workflow
  stage text not null default 'prospect'
    check (stage in ('prospect','stage1_review','research_more','call_again','not_fit','stage2')),
  pipeline_status text,
  not_fit_reason text,
  stage1_completed_at timestamptz,
  inquiry_call_count int not null default 0,

  -- scoring
  opportunity_score int,
  score_override int check (score_override between 0 and 100),
  classification_override text,
  score_breakdown jsonb not null default '[]'::jsonb,
  corporate_controlled boolean not null default false,
  mgmt_no_pain boolean not null default false,
  biggest_pain text,
  stage1_summary text,

  -- manual-workflow flags (from latest Stage 1 call; null = unknown)
  manual_housekeeping boolean,
  manual_houseman boolean,
  manual_maintenance boolean,
  manual_shuttle boolean,
  manual_parking boolean,
  manual_wakeup boolean,

  -- next action
  next_action text,
  next_action_date date,
  last_contacted_at timestamptz,
  lead_owner text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.hotels(org_id);
create index on public.hotels(org_id, stage);
create index on public.hotels(org_id, next_action_date);
create trigger hotels_touch before update on public.hotels for each row execute function public.touch_updated_at();

-- ───────────────────────── Contacts ─────────────────────────
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org_id() references public.organizations(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  title text,
  linkedin_url text,
  email text,
  phone text,
  decision_maker text not null default 'unknown' check (decision_maker in ('yes','no','unknown')),
  influence text check (influence in ('low','medium','high')),
  preferred_contact text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.contacts(hotel_id);
create index on public.contacts(org_id);

-- ───────────────────────── Stage 1 inquiry calls ─────────────────────────
create table public.inquiry_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org_id() references public.organizations(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  called_at timestamptz not null default now(),
  spoke_with text,
  spoke_role text,
  answered boolean not null default true,
  answers jsonb not null default '{}'::jsonb,
  outside_pms text,
  most_manual text,
  notes text,
  score int,
  created_at timestamptz not null default now()
);
create index on public.inquiry_calls(hotel_id);
create index on public.inquiry_calls(org_id);

-- ───────────────────────── Pain points ─────────────────────────
create table public.pain_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org_id() references public.organizations(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  department text not null default 'Other',
  description text not null,
  current_workflow text,
  existing_system text,
  severity text check (severity in ('Low','Medium','High')),
  frequency text check (frequency in ('Rare','Weekly','Daily','Multiple times daily')),
  impact text,
  product_feature text,
  confirmed_by_mgmt boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.pain_points(hotel_id);
create index on public.pain_points(org_id);

-- ───────────────────────── Activities (timeline; includes management calls) ─────────────────────────
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org_id() references public.organizations(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  kind text not null,
  summary text not null,
  outcome text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.activities(hotel_id, occurred_at desc);
create index on public.activities(org_id);
create index on public.activities(contact_id);

-- ───────────────────────── Deals (one active per hotel) ─────────────────────────
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org_id() references public.organizations(id) on delete cascade,
  hotel_id uuid not null unique references public.hotels(id) on delete cascade,
  plan text not null default 'founding',
  setup_fee numeric(12,2) not null default 2000,
  monthly numeric(12,2) not null default 500,
  contract_months int not null default 13,
  free_months int not null default 1,
  discount numeric(12,2) not null default 0,
  tcv numeric(12,2) generated always as
    (setup_fee + monthly * greatest(contract_months - free_months, 0) - discount) stored,
  mrr numeric(12,2) generated always as (monthly) stored,
  arr numeric(12,2) generated always as (monthly * 12) stored,
  proposal_date date,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.deals(org_id);
create trigger deals_touch before update on public.deals for each row execute function public.touch_updated_at();

-- ───────────────────────── Demos ─────────────────────────
create table public.demos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org_id() references public.organizations(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz not null default now()
);
create index on public.demos(hotel_id);
create index on public.demos(org_id, scheduled_at);
create index on public.demos(contact_id);

-- ───────────────────────── Tasks (lightweight; reserved for future use) ─────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org_id() references public.organizations(id) on delete cascade,
  hotel_id uuid references public.hotels(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.tasks(org_id);
create index on public.tasks(hotel_id);

-- ───────────────────────── Row-level security ─────────────────────────
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;

create policy "members read org" on public.organizations for select to authenticated
  using (id in (select public.user_org_ids()));
create policy "members update org" on public.organizations for update to authenticated
  using (id in (select public.user_org_ids())) with check (id in (select public.user_org_ids()));
create policy "read own memberships" on public.org_members for select to authenticated
  using (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['hotels','contacts','inquiry_calls','pain_points','activities','deals','demos','tasks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "org members full access" on public.%I for all to authenticated
      using (org_id in (select public.user_org_ids()))
      with check (org_id in (select public.user_org_ids()))$p$, t);
  end loop;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
