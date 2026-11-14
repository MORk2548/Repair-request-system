-- One row per browser that receives Web Push. An endpoint identifies a browser, not a person, so saving it
-- goes through save_web_push_subscription, which takes it away from whoever had it before (as claim_push_token does).
create table public.web_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index web_push_subscriptions_user_idx on public.web_push_subscriptions (user_id);

alter table public.web_push_subscriptions enable row level security;

revoke all on public.web_push_subscriptions from public, anon, authenticated;
grant select, delete on public.web_push_subscriptions to authenticated;

create policy web_push_subscriptions_select on public.web_push_subscriptions for select to authenticated
  using (user_id = auth.uid() and public.current_app_role() is not null);
create policy web_push_subscriptions_delete on public.web_push_subscriptions for delete to authenticated
  using (user_id = auth.uid() and public.current_app_role() is not null);

create function public.save_web_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_app_role() is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  insert into public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

revoke execute on function public.save_web_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_web_push_subscription(text, text, text) to authenticated;
