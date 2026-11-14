-- Guardar menus especiales de una agrupacion de colegios en una fecha.
--
-- Reemplaza atomicamente los menus especiales (type <> 'normal') de esa
-- agrupacion de colegios para esa fecha exacta.
-- Si la agrupacion A y la agrupacion B tienen menus especiales en la misma
-- fecha, guardar los menus especiales de A no altera ni borra los de B.
-- Si falla la insercion de algun menu (o la validacion), la transaccion
-- revierte por completo y se conservan los menus guardados previamente.
--
-- Es SECURITY INVOKER para que las politicas RLS sigan comprobando
-- los permisos de escritura del rol authenticated.

create or replace function public.save_special_menus(
  p_school_ids uuid[],
  p_date date,
  p_menus jsonb
)
returns uuid[]
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_target_schools uuid[];
  v_old_menu_ids uuid[];
  v_menu jsonb;
  v_new_menu_id uuid;
  v_inserted_ids uuid[] := '{}';
begin
  if p_date is null or p_school_ids is null or cardinality(p_school_ids) = 0 then
    raise exception 'save_special_menus requires non-empty school ids and a date'
      using errcode = '22023';
  end if;

  if p_menus is not null and jsonb_typeof(p_menus) <> 'array' then
    raise exception 'save_special_menus requires p_menus to be a jsonb array'
      using errcode = '22023';
  end if;

  -- Agrupacion canonica ordenada de colegios unicos
  select coalesce(array_agg(s order by s), '{}'::uuid[])
    into v_target_schools
    from (select distinct unnest(p_school_ids) as s) t;

  -- Buscar menus especiales en p_date cuyos colegios asignados coincidan EXACTAMENTE con v_target_schools
  select coalesce(array_agg(t.menu_id), '{}'::uuid[])
    into v_old_menu_ids
    from (
      select ms.menu_id
        from public.menus_schools ms
        join public.menus m on m.id = ms.menu_id
       where ms.date = p_date
         and m.type <> 'normal'
       group by ms.menu_id
      having array_agg(ms.school_id order by ms.school_id) = v_target_schools
    ) t;

  -- Borrar los menus especiales previos de esta agrupacion y fecha
  if cardinality(v_old_menu_ids) > 0 then
    delete from public.menus_schools where menu_id = any(v_old_menu_ids);
    delete from public.menus where id = any(v_old_menu_ids);
  end if;

  -- Insertar los nuevos menus especiales si se proporcionaron
  if p_menus is not null and jsonb_typeof(p_menus) = 'array' then
    for v_menu in select * from jsonb_array_elements(p_menus) loop
      insert into public.menus (
        type,
        first_course,
        second_course,
        side,
        salad,
        dessert
      ) values (
        coalesce(v_menu ->> 'type', ''),
        coalesce(v_menu ->> 'first_course', v_menu ->> 'primero', ''),
        coalesce(v_menu ->> 'second_course', v_menu ->> 'segundo', ''),
        coalesce(v_menu ->> 'side', v_menu ->> 'guarnicion'),
        coalesce(v_menu ->> 'salad', v_menu ->> 'ensalada'),
        coalesce(v_menu ->> 'dessert', v_menu ->> 'postre')
      )
      returning id into v_new_menu_id;

      v_inserted_ids := array_append(v_inserted_ids, v_new_menu_id);

      insert into public.menus_schools (menu_id, school_id, date)
      select distinct v_new_menu_id, s.school_id, p_date
        from unnest(v_target_schools) as s(school_id);
    end loop;
  end if;

  return v_inserted_ids;
end;
$$;

revoke execute on function public.save_special_menus(uuid[], date, jsonb) from public, anon;
grant execute on function public.save_special_menus(uuid[], date, jsonb) to authenticated;
