-- Single-user MVP: the first account to sign up owns the workspace and is confirmed immediately.
-- Any further sign-ups are rejected unless the email is on the invite list (future multi-user).
create table public.invites (
  email text primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now()
);
alter table public.invites enable row level security;
create policy "org owners manage invites" on public.invites for all to authenticated
  using (org_id in (select public.user_org_ids())) with check (org_id in (select public.user_org_ids()));

create or replace function public.guard_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users) and not exists (select 1 from public.invites i where lower(i.email) = lower(new.email)) then
    raise exception 'Sign-ups are closed for this workspace';
  end if;
  if new.email_confirmed_at is null then
    new.email_confirmed_at = now();
  end if;
  return new;
end $$;
revoke execute on function public.guard_signup() from public, anon, authenticated;

create trigger before_auth_user_created before insert on auth.users
  for each row execute function public.guard_signup();

-- Invited users join the inviting org instead of getting a fresh one
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_org uuid; inv record;
begin
  select * into inv from public.invites where lower(email) = lower(new.email);
  if found then
    insert into public.org_members(org_id, user_id, role) values (inv.org_id, new.id, inv.role);
    delete from public.invites where email = inv.email;
    return new;
  end if;
  insert into public.organizations(name) values (coalesce(split_part(new.email,'@',1),'My') || '''s workspace')
  returning id into new_org;
  insert into public.org_members(org_id, user_id, role) values (new_org, new.id, 'owner');
  return new;
end $$;
