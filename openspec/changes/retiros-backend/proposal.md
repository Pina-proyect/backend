# Proposal: retiros-backend (HU4.2)

> **TAREA DELEGADA** — asignada por el orquestador del worktree frontend (2026-10-12). Backend: `backend-nest/backend-dev` (rama `etrigan16/backend-dev`). Siguiente fase: `sdd-spec` (o `sdd-continue`).

## Intent
Permitir a la creadora **solicitar y seguir retiros** de su saldo (donaciones menos comisión 7%). HU4.2 del MAPA (canónico).

## Problem
- Hoy existe el dashboard de ingresos (HU4.1, v1.14) pero **no hay flujo de retiro**: no hay endpoints, estados ni historial.
- `backlog.md` §8: HU4.2 pendiente. Baseline `documentacion/docs-dev/docs/baseline-canonico-pina.md` §4 lo lista en Fase C.

## Scope
**In**:
1. Modelo `Withdrawal`: `id, creatorId, amount, method (mp|bank|email), status (pending|approved|rejected|paid), timestamps`, + relación con saldo disponible.
2. `POST /withdrawals` (monto ≥ mínimo configurable, método, validación contra saldo disponible descontando comisión).
3. `GET /withdrawals` (historial con filtros por estado) y `GET /withdrawals/:id`.
4. Transición de estados (admin/modera) con motivo de rechazo.
5. Cálculo de saldo disponible consistente con donaciones/packs y webhooks (reusar lógica existente).
6. Tests Jest unit + e2e (stack DB+Redis).

**Out**: integración real de payout/transferencias bancarias (E0/ops), exportaciones (otro change), UI frontend (se delega aparte o después del contrato).

## Acceptance Criteria
1. `POST /withdrawals` rechaza monto < mínimo y saldo insuficiente (4xx con DTO claro).
2. `GET /withdrawals` devuelve historial ordenado con estados y filtros.
3. No permite retirar más del saldo disponible (incluye comisión 7%).
4. `pnpm test`, `pnpm test:e2e`, `pnpm build` verdes.

## Dependencies
- Patrones: `backend-dev/openspec/specs/packs-crud/spec.md`, `packs-unlock/spec.md`.
- Referencia de negocio: MAPA HU4.2 (`documentacion/docs-dev/MAPA DE ÉPICAS...md`, sección HU4.2 con estados, URIs y visión BD).

## Rollback
Revert del commit; si hay migración de schema, migración destructiva desaconsejada (DDL additive).