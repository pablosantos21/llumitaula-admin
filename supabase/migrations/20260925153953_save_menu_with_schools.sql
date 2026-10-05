-- Guardar un menu y sus colegios se hacia con llamadas separadas: un upsert en
-- `menus` y un delete + insert en `menus_schools`. Si el insert fallaba (por
-- ejemplo con el antiguo trigger de menu de un solo colegio) el delete ya
-- estaba confirmado y el menu se quedaba sin colegios: una fila huerfana en
-- `menus` que la lista diaria ya no muestra. Asi un colegio puede quedarse sin
-- menu normal y seguir viendo sus menus especiales.
--
-- Este RPC hace todo en una sola transaccion: o se guardan el menu y todos sus
-- colegios, o no se toca nada. Es SECURITY INVOKER a proposito, para que las
-- politicas RLS de `menus` y `menus_schools` sigan limitando la escritura al
-- rol `admin`.
--
-- El borrado ignora `p_date` porque un menu se sirve en una sola fecha: moverlo
-- de dia no debe chocar con la clave primaria (menu_id, school_id).
create or replace function public.save_menu_with_schools(
  p_menu_id uuid,
  p_menu jsonb,
  p_school_ids uuid[],
  p_date date
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_menu_id uuid;
begin
  if p_menu is null or p_date is null then
    raise exception 'save_menu_with_schools requires the menu fields and a date'
      using errcode = '22023';
  end if;

  if p_menu_id is null then
    insert into public.menus (first_course, second_course, side, salad, dessert, type)
    values (
      coalesce(p_menu ->> 'first_course', ''),
      coalesce(p_menu ->> 'second_course', ''),
      p_menu ->> 'side',
      p_menu ->> 'salad',
      p_menu ->> 'dessert',
      coalesce(p_menu ->> 'type', 'normal')
    )
    returning id into v_menu_id;
  else
    update public.menus
       set first_course = coalesce(p_menu ->> 'first_course', ''),
           second_course = coalesce(p_menu ->> 'second_course', ''),
           side = p_menu ->> 'side',
           salad = p_menu ->> 'salad',
           dessert = p_menu ->> 'dessert',
           type = coalesce(p_menu ->> 'type', 'normal')
     where id = p_menu_id
    returning id into v_menu_id;

    if v_menu_id is null then
      raise exception 'save_menu_with_schools could not find menu %', p_menu_id
        using errcode = '22023';
    end if;
  end if;

  delete from public.menus_schools where menu_id = v_menu_id;

  insert into public.menus_schools (menu_id, school_id, date)
  select distinct v_menu_id, s.school_id, p_date
    from unnest(coalesce(p_school_ids, '{}'::uuid[])) as s(school_id);

  return v_menu_id;
end;
$$;

revoke execute on function public.save_menu_with_schools(uuid, jsonb, uuid[], date) from public, anon;
grant execute on function public.save_menu_with_schools(uuid, jsonb, uuid[], date) to authenticated;
