create extension if not exists pg_net with schema extensions;

-- Posts each status event to the notify-ticket-event Edge Function. The URL and the shared secret live in
-- Vault (notify_function_url, notify_webhook_secret); without them nothing is sent, so tests and fresh
-- databases need no function.
create function public.notify_ticket_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  -- a notification problem must never roll back the ticket change that caused it
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_function_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_webhook_secret';
    if v_url is not null and v_secret is not null then
      perform net.http_post(
        url := v_url,
        body := pg_catalog.jsonb_build_object(
          'id', new.id, 'ticket_id', new.ticket_id, 'actor_id', new.actor_id,
          'action', new.action, 'to_status', new.to_status,
          -- read here, in the event's own transaction: by the time the function runs the ticket may have moved on
          'reporter_id', (select reporter_id from public.tickets where id = new.ticket_id),
          'assignee_id', (select assignee_id from public.tickets where id = new.ticket_id)
        ),
        headers := pg_catalog.jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
      );
    end if;
  exception when others then
    raise warning 'notify_ticket_event: %', sqlerrm;
  end;
  return null;
end $$;

create trigger notify_ticket_event after insert on public.ticket_events
for each row when (new.to_status is not null) execute function public.notify_ticket_event();

revoke execute on function public.notify_ticket_event() from public, anon, authenticated;
