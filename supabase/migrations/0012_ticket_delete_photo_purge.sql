-- Admins delete a mis-filed ticket through delete_ticket(); events, comments, attachment rows and notifications
-- go with it (on delete cascade). Storage objects cannot be deleted from SQL, so the RPC returns their paths
-- and the client removes them, which ticket_photos_admin_delete allows once their ticket is gone (never an upload
-- still waiting for its attachment row on a live ticket).
create function public.delete_ticket(p_ticket_id uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_equipment_id int;
  v_paths text[];
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  select coalesce(pg_catalog.array_agg(storage_path order by id), '{}') into v_paths
  from public.ticket_attachments where ticket_id = p_ticket_id;
  delete from public.tickets where id = p_ticket_id returning equipment_id into v_equipment_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_equipment_id is not null then
    perform public.sync_equipment_status(v_equipment_id);
  end if;
  return v_paths;
end $$;

revoke execute on function public.delete_ticket(uuid) from public, anon;
grant execute on function public.delete_ticket(uuid) to authenticated;

-- Storage deletes with RETURNING, so the files also need a select policy; the usual one checks the ticket, which is gone by now
create policy ticket_photos_admin_select_detached on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-photos'
    and public.current_app_role() = 'admin'
    and not exists (select 1 from public.tickets t where t.id::text = split_part(name, '/', 1))
  );
create policy ticket_photos_admin_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-photos'
    and public.current_app_role() = 'admin'
    and not exists (select 1 from public.tickets t where t.id::text = split_part(name, '/', 1))
  );

-- Photos of a ticket closed more than p_days ago. A closed ticket never changes status again, so its latest
-- closed event is when it was closed. Only the purge-photos Edge Function (service role) calls this.
create function public.expired_closed_photos(p_days int, p_limit int) returns table (id bigint, storage_path text)
language sql stable set search_path = '' as $$
  select a.id, a.storage_path
  from public.ticket_attachments a
  join public.tickets t on t.id = a.ticket_id
  where t.status = 'closed'
    and (select pg_catalog.max(e.created_at) from public.ticket_events e where e.ticket_id = t.id and e.to_status = 'closed')
      < pg_catalog.now() - pg_catalog.make_interval(days => p_days)
  order by a.id
  limit p_limit
$$;

revoke execute on function public.expired_closed_photos(int, int) from public, anon, authenticated;
grant execute on function public.expired_closed_photos(int, int) to service_role;

-- Asks the purge-photos Edge Function to run. Like notify_ticket_event(), it does nothing without the Vault
-- secrets (purge_function_url, notify_webhook_secret), so fresh databases and tests need no function.
create extension if not exists pg_cron with schema pg_catalog;

create function public.request_photo_purge() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'purge_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_webhook_secret';
  if v_url is not null and v_secret is not null then
    perform net.http_post(
      url := v_url,
      body := '{}'::jsonb,
      headers := pg_catalog.jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
      timeout_milliseconds := 60000
    );
  end if;
end $$;

revoke execute on function public.request_photo_purge() from public, anon, authenticated;

-- 19:00 UTC is 02:00 in Bangkok
select cron.schedule('purge-closed-photos', '0 19 * * *', 'select public.request_photo_purge()');
