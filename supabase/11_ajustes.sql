-- Ajuste 11 — Mantenimiento: seguridad e índices (ya aplicado en producción)
-- anular_venta quedó ejecutable sin iniciar sesión (se recreó en 08 y perdió el revoke).
revoke all on function public.anular_venta(bigint, text, text) from public, anon;
grant execute on function public.anular_venta(bigint, text, text) to authenticated;

create index if not exists idx_caja_mov_cobro on public.caja_movimientos(cobro_id);
create index if not exists idx_caja_mov_venta on public.caja_movimientos(venta_id);
create index if not exists idx_recetas_insumo on public.recetas(insumo_id);
