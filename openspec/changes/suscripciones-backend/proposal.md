# Proposal: suscripciones-backend (post-MVP)

> **TAREA DELEGADA** — asignada por el orquestador del worktree frontend (2026-10-12). Backend: `backend-nest/backend-dev` (rama `etrigan16/backend-dev`). Siguiente fase: `sdd-spec` (o `sdd-continue`).

## Intent
Añadir **suscripciones/membresías** periódicas por creadora (ausente hoy en backend y frontend). Post-MVP declarado en `Ingeniería...md` §5.1, pero solicitado por el dueño del producto.

## Problem
- No existe módulo de suscripciones; el roadmap del baseline lo ubica en Fase C (Etapa 2) con dependencia de liquidación/retiros.

## Scope
**In**:
1. Modelo `SubscriptionPlan` (creadora, título, precio/periodicidad mensual, beneficios) y `Subscription` (donante, plan, estado active|cancelled|past_due, fechas).
2. CRUD de planes por creadora (ownership), y endpoints públicos de planes por slug.
3. Alta/cancelación de suscripción; ciclo de renovación (cobro manual vía MP recurrencia si existe, o cobro con preferencia simple — decidir según capacidad MP); estados y errores.
4. Vínculo con pagos (`Access`/`Donation`) y con el módulo de retiros para liquidación.
5. Tests Jest unit + e2e.

**Out**: trials/prorrateos, gestión administrativa completa, UI frontend (después del contrato).

## Acceptance Criteria
1. CRUD de planes con ownership (403 no-owner).
2. Alta de suscripción crea estado `active` y renovación/cancelación funcionan con estados correctos.
3. No puede haber suscripción duplicada activa del mismo donante al mismo plan.
4. `pnpm test`, `pnpm test:e2e`, `pnpm build` verdes.

## Dependencies
- MAPA (futura HU de suscripciones) + baseline Fase C. Requiere coordinación con `retiros-backend` para liquidación.
- MP recurrencia: revisar capacidades de `@mercadopago/sdk-react` / API antes de fijar enfoque.

## Rollback
Revert del commit; DDL additive.