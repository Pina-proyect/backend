# Proposal: campanas-backend (HU8.1 / HU8.2)

> **TAREA DELEGADA** — asignada por el orquestador del worktree frontend (2026-10-12). Backend: `backend-nest/backend-dev` (rama `etrigan16/backend-dev`). Siguiente fase: `sdd-spec` (o `sdd-continue`).

## Intent
Habilitar **campañas con meta monetaria** (HU8.1) y **progreso público** (HU8.2). La creadora arma una campaña con objetivo, meta y fecha límite; los aportes (donaciones/packs) alimentan el progreso visible.

## Problem
- HU8.1/HU8.2 pendientes; el MAPA las especifica como títulos sin detalle (deben completarse en el spec).
- Hoy solo hay donaciones directas y packs, sin concepto de campaña.

## Scope
**In**:
1. Modelo `Campaign` (creadora, título, descripción, meta (ARS), fecha límite, estado draft|active|ended) y su vínculo con aportes.
2. CRUD de campañas con ownership; `GET public /:id` y `GET public /:id/progress` (suma de aportes vinculados).
3. Aportes: decidir si las donaciones existentes pueden "etiquetarse" a campaña (campaignId en donation) o si hay un endpoint de aporte dedicado; documentar decisión.
4. Tests Jest unit + e2e.

**Out**: niveles de recompensa, crowdfunding complejo, UI frontend (después del contrato).

## Acceptance Criteria
1. CRUD con ownership (403 no-owner); meta y fecha límite validados.
2. Progress = suma real de aportes vinculados; pública sin auth para `GET progress`.
3. Estado `ended` congela aportes nuevos.
4. `pnpm test`, `pnpm test:e2e`, `pnpm build` verdes.

## Dependencies
- MAPA HU8.1/HU8.2 (completar detalle en spec). `retiros-backend` para liquidación de aportes.

## Rollback
Revert del commit; DDL additive.