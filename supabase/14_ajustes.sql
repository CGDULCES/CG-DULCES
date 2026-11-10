-- =====================================================================
-- CG DULCES · Ajuste 14 — Dividir cuenta con varios productos
-- ---------------------------------------------------------------------
-- Antes dividir_cuenta aceptaba UN solo producto. Ahora acepta una lista:
--   { "items": [ { "producto_id": 5, "cantidad": 2 }, ... ],
--     "clientes": [12, 15], "montos": [..opcional..], "registrado_por": "Guada",
--     "created_at": "..." }
-- Sigue aceptando el formato anterior (producto_id + cantidad).
-- Si hay redondeo (montos), la diferencia se suma al primer producto para
-- que el total de la venta coincida con lo que se cobra.
-- =====================================================================

create or replace function public.dividir_cuenta(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_items jsonb;
  v_created timestamptz := coalesce((p->>'created_at')::timestamptz, now());
  r record; v_precio numeric; v_costo numeric; v_stock numeric; v_nombre text; v_nombres text := '';
  v_real numeric := 0; v_total numeric; v_diff numeric; v_sub numeric; v_venta_id bigint;
  v_ids bigint[]; v_montos numeric[]; v_n int; v_base numeric; v_resto numeric; i int;
begin
  if nullif(p->'items','null'::jsonb) is not null and jsonb_array_length(p->'items') > 0 then
    v_items := p->'items';
  else
    v_items := jsonb_build_array(jsonb_build_object(
      'producto_id', (p->>'producto_id')::bigint, 'cantidad', coalesce((p->>'cantidad')::numeric, 1)));
  end if;

  select array_agg(value::text::bigint) into v_ids
  from jsonb_array_elements(coalesce(nullif(p->'clientes','null'::jsonb),'[]'::jsonb));
  v_n := coalesce(array_length(v_ids,1),0);
  if v_n < 2 then raise exception 'MIN_2_CLIENTES' using errcode='P0001'; end if;

  if nullif(p->'montos','null'::jsonb) is not null then
    select array_agg((value)::text::numeric) into v_montos from jsonb_array_elements(p->'montos');
    if coalesce(array_length(v_montos,1),0) <> v_n then
      raise exception 'MONTOS_NO_COINCIDEN' using errcode='P0001';
    end if;
  end if;

  -- Paso 1: bloquear cada producto, validar stock y calcular el total real
  for r in
    select (x->>'producto_id')::bigint as pid, sum((x->>'cantidad')::numeric) as cant
    from jsonb_array_elements(v_items) x group by 1 order by 1
  loop
    select precio_venta, stock, nombre into v_precio, v_stock, v_nombre
      from public.productos where id = r.pid for update;
    if not found then raise exception 'PRODUCTO_INEXISTENTE' using errcode='P0001'; end if;
    if r.cant > coalesce(v_stock,0) then
      raise exception 'SIN_STOCK: % (hay %)', v_nombre, coalesce(v_stock,0) using errcode='P0001';
    end if;
    v_real := v_real + v_precio * r.cant;
    v_nombres := v_nombres || case when v_nombres = '' then '' else ', ' end || v_nombre;
    update public.productos set stock = stock - r.cant where id = r.pid;
  end loop;

  if v_montos is not null then
    select sum(x) into v_total from unnest(v_montos) x;
  else
    v_total := v_real;
  end if;
  v_diff := v_total - v_real;

  insert into public.ventas (subtotal, descuento_total, total, medio_pago, es_fiado,
                             registrado_por, cliente_id, created_at)
  values (v_total, 0, v_total, 'fiado', true, p->>'registrado_por', null, v_created)
  returning id into v_venta_id;

  -- Paso 2: una línea por producto; el redondeo va al primero
  i := 0;
  for r in
    select (x->>'producto_id')::bigint as pid, (x->>'cantidad')::numeric as cant
    from jsonb_array_elements(v_items) x
  loop
    i := i + 1;
    select precio_venta, costo_ultimo into v_precio, v_costo from public.productos where id = r.pid;
    v_sub := v_precio * r.cant + case when i = 1 then v_diff else 0 end;
    insert into public.venta_items (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, descuento, subtotal)
    values (v_venta_id, r.pid, r.cant, case when r.cant > 0 then v_sub / r.cant else v_sub end, v_costo, 0, v_sub);
  end loop;

  if v_montos is not null then
    for i in 1 .. v_n loop
      insert into public.venta_repartos (venta_id, cliente_id, monto) values (v_venta_id, v_ids[i], v_montos[i]);
    end loop;
  else
    v_base := floor(v_total / v_n);
    v_resto := v_total - v_base * v_n;
    for i in 1 .. v_n loop
      insert into public.venta_repartos (venta_id, cliente_id, monto)
      values (v_venta_id, v_ids[i], v_base + case when i = 1 then v_resto else 0 end);
    end loop;
  end if;

  perform public._hist('ventas', v_venta_id, 'crear',
    'Cuenta dividida: '||v_nombres||' ('||v_total||') entre '||v_n||' clientes', p->>'registrado_por');
  return v_venta_id;
end $$;
