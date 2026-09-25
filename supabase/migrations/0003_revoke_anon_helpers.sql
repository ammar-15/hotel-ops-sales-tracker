revoke execute on function public.user_org_ids() from public, anon;
revoke execute on function public.default_org_id() from public, anon;
grant execute on function public.user_org_ids() to authenticated;
grant execute on function public.default_org_id() to authenticated;
