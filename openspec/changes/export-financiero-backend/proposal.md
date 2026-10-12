# Proposal: export-financiero-backend (HU4.3 / HU7.4)

> **TAREA DELEGADA** — asignada por el orquestador del worktree frontend (2026-10-12). Backend: `backend-nest/backend-dev` (rama `etrigan16/backend-dev`). Siguiente fase: `sdd-spec` (o `sdd-continue`).

## Intent
Permitir **exportar reportes financieros** (CSV; PDF si viable) de ingresos y métricas (HU4.3 y HU7.4) con filtros por período.

## Problem
- HU4.3/HU7.4 pendientes; no existe export en el backend.
- El dashboard (v1.14) muestra métricas pero no se puede descargar.

## Scope
**In**:
1. `GET /exports/income` (CSV): ingresos por período (donaciones/packs/ventas), columnas definidas (fecha, tipo, monto bruto, comisión 7%, neto, estado).
2. Filtros: rango de fechas, estado, tipo.
3. Streaming por archivo (sin cargar todo en memoria), content-disposition.
4. (Opcional) `GET /exports/metrics` CSV con tendencias por contenido si los datos lo permiten; si no, dejarlo para HU7.4 posterior.
5. Tests Jest unit + e2e.

**Out**: programación automática por email, PDF, UI frontend (después del contrato).

## Acceptance Criteria
1. CSV válido con cabeceras y filas correctas para un período; montos netos con comisión 7% consistente.
2. Filtros aplicados correctamente; devuelve 403/401 según auth de creadora.
3. Archivos grandes en streaming sin timeout.
4. `pnpm test`, `pnpm test:e2e`, `pnpm build` verdes.

## Dependencies
- MAPA HU4.3/HU7.4. Patrones de `users`/`payments` para datos de origen.

## Rollback
Revert del commit; no aplica schema (solo lectura).