-- =====================================================================
-- CG DULCES · AJUSTES (correr una vez, despues de APLICAR-TODO.sql)
-- =====================================================================
-- Actualiza la funcion dividir_cuenta() para que acepte importes por
-- cliente redondeados (ej: 10.000 / 3 = 3.333, pero cada uno paga 3.500).
-- Es seguro re-ejecutarlo. No borra ni cambia datos.
--
-- COMO USARLO: SQL Editor -> New query -> pegar todo -> Run -> "Success".
-- =====================================================================

begin;

create or replace function public.dividir_cuenta(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_pid bigint := (p->>'producto_id')::bigint;
  v_cant numeric := coalesce((p->>'cantidad')::numeric, 1);
  v_created timestamptz := coalesce((p->>'created_at')::timestamptz, now());
  v_precio numeric; v_costo numeric; v_stock numeric; v_nombre text;
  v_total numeric; v_venta_id bigint;
  v_ids bigint[]; v_montos numeric[]; v_n int; v_base numeric; v_resto numeric; i int;
begin
  select array_agg(value::text::bigint) into v_ids
  from jsonb_array_elements(coalesce(nullif(p->'clientes','null'::jsonb),'[]'::jsonb));
  v_n := coalesce(array_length(v_ids,1),0);
  if v_n < 2 then raise exception 'MIN_2_CLIENTES' using errcode='P0001'; end if;

  if nullif(p->'montos','null'::jsonb) is not null then
    select array_agg((value)::text::numeric) into v_montos
    from jsonb_array_elements(p->'montos');
    if coalesce(array_length(v_montos,1),0) <> v_n then
      raise exception 'MONTOS_NO_COINCIDEN' using errcode='P0001';
    end if;
  end if;

  select precio_venta, costo_ultimo, stock, nombre
    into v_precio, v_costo, v_stock, v_nombre
  from public.productos where id = v_pid for update;
  if v_cant > coalesce(v_stock,0) then
    raise exception 'SIN_STOCK: % (hay %)', v_nombre, coalesce(v_stock,0) using errcode='P0001';
  end if;

  if v_montos is not null then
    select sum(x) into v_total from unnest(v_montos) x;
  else
    v_total := v_precio * v_cant;
  end if;

  insert into public.ventas (subtotal, descuento_total, total, medio_pago, es_fiado,
                             registrado_por, cliente_id, created_at)
  values (v_total, 0, v_total, 'fiado', true, p->>'registrado_por', null, v_created)
  returning id into v_venta_id;

  insert into public.venta_items (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, descuento, subtotal)
  values (v_venta_id, v_pid, v_cant,
          case when v_cant > 0 then v_total / v_cant else v_total end,
          v_costo, 0, v_total);

  update public.productos set stock = stock - v_cant where id = v_pid;

  if v_montos is not null then
    for i in 1 .. v_n loop
      insert into public.venta_repartos (venta_id, cliente_id, monto)
      values (v_venta_id, v_ids[i], v_montos[i]);
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
    'Cuenta dividida: '||v_nombre||' ('||v_total||') entre '||v_n||' clientes', p->>'registrado_por');
  return v_venta_id;
end $$;

commit;
