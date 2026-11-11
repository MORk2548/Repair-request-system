-- security definer so the check also sees attachments on tickets the uploader can no longer see
create function public.is_attached_photo(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ticket_attachments where storage_path = p_path)
$$;

revoke execute on function public.is_attached_photo(text) from public, anon, authenticated;
grant execute on function public.is_attached_photo(text) to authenticated;

-- lets attachPhoto remove its upload when the ticket_attachments insert fails; attached photos stay
create policy ticket_photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-photos'
    and owner_id = (select auth.uid())::text
    and not public.is_attached_photo(name)
  );
