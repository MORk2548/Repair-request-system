create function public.ticket_summary(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz := p_from::timestamp at time zone 'Asia/Bangkok';
  v_end timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Bangkok';
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = 'P0001', message = 'invalid_range';
  end if;

  return (
    with t as (
      select status, category_id, assignee_id, resolved_at - created_at as took
      from public.tickets
      where created_at >= v_start and created_at < v_end
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*) from t),
      'by_status', (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('status', s, 'count', (select pg_catalog.count(*) from t where t.status = s))
          order by s)
        from pg_catalog.unnest(pg_catalog.enum_range(null::public.ticket_status)) as s
      ),
      'by_category', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('category_id', c.id, 'name', c.name, 'count', g.n)
          order by g.n desc, c.name)
        from (select category_id, pg_catalog.count(*) as n from t group by category_id) g
        join public.categories c on c.id = g.category_id
      ), '[]'),
      'by_assignee', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('assignee_id', g.assignee_id, 'name', p.display_name, 'count', g.n)
          order by g.n desc, p.display_name nulls last)
        from (select assignee_id, pg_catalog.count(*) as n from t group by assignee_id) g
        left join public.profiles p on p.id = g.assignee_id
      ), '[]'),
      'avg_resolve_hours', (
        select pg_catalog.round((pg_catalog.avg(pg_catalog.date_part('epoch', took)) / 3600)::numeric, 1) from t where took is not null
      )
    )
  );
end $$;

revoke execute on function public.ticket_summary(date, date) from public, anon;
grant execute on function public.ticket_summary(date, date) to authenticated;
