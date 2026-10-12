# Proposal: packs-api-crud-unlock (BACKEND)

## Intent

HU3.1/HU3.2 quedan parciales: el backend no expone edición/borrado de packs (el frontend `packs/page.tsx:242-247` tiene botones sin handler) y el frontend no puede derivar `purchasedPacks`/`isUnlocked`. Este cambio completa el CRUD de packs con ownership y consolida el contrato de desbloqueo que el frontend consume.

## Scope

### In Scope
- `PATCH /api/pina/packs/:id` (JWT + ownership): `title`, `description`, `price`, `categoryId`, `mediaIds` (reemplazo), `status`. Reusa verificación de media ownership de `createPack`.
- `DELETE /api/pina/packs/:id` (JWT + ownership): soft-delete → `status='archived'`, idempotente (204). `GET my-packs` excluye `archived`.
- `UpdatePackDto` (campos opcionales; al menos uno presente) en `dto/update-pack.dto.ts`.
- `GET /packs/:id`: `hasAccess` real con auth opcional (`OptionalJwtAuthGuard` en `common/guards/`); hoy hardcodea `false`.
- Webhook MP: `Access.type` se normaliza a `'purchase'` (hoy escribe `'PACK'`); idempotencia ya existe (`findFirst` previo al `create`).
- Contrato unlock: `GET /users/library` (ya devuelve packs comprados vía `Access`) queda como fuente canónica de `purchasedPacks`; sin endpoint nuevo.
- Tests Jest: controller/service specs PATCH/DELETE/ownership/`hasAccess`; spec del webhook crea `Access`.

### Out of Scope
- Frontend (repo `frontend-dev`): wire de botones y llamada a `/users/library`.
- Hard-delete físico / cascada en DB / borrado de media en R2.
- Tipos futuros de `Access` (`gift`, `subscription`).
- Flujo DONATION del webhook (no se toca).

## Capabilities

### New Capabilities
- `packs-crud`: PATCH/DELETE de packs con validación de ownership (completa HU3.1).
- `packs-unlock`: persistencia del desbloqueo en el webhook y exposición del estado desbloqueado/`purchasedPacks` al frontend (completa HU3.2).

### Modified Capabilities
- None (no existen specs previos en `openspec/specs/`).

## Approach

- Endpoints en `PacksController` siguiendo el patrón de comments: `AuthGuard('jwt')` en controller, ownership en service (`pack.creatorId !== req.user.id` → `ForbiddenException`; inexistente → `NotFoundException`).
- `PacksService.updatePack/deletePack`: `deletePack` = `update({ status: 'archived' })`; `updatePack` bloquea packs `archived` (404).
- `getMyPacks` → `where: { creatorId, status: { not: 'archived' } }`.
- `GET /packs/:id` con `OptionalJwtAuthGuard`; con usuario → `hasAccess(user.id, packId)`; anónimo → `false` (proyección pública intacta).
- Webhook: `type: 'purchase'`; sin migración de schema (campos `status` y tabla `Access` ya existen).

## Affected Areas

| Area | Impacto | Descripción |
|------|---------|-------------|
| `src/modules/packs/packs.controller.ts` | Modified | +PATCH/DELETE `:id`, fix `hasAccess` en `GET :id` |
| `src/modules/packs/packs.service.ts` | Modified | +`updatePack`/`deletePack`; filtro `archived` en `my-packs` |
| `src/modules/packs/dto/update-pack.dto.ts` | New | DTO de PATCH |
| `src/common/guards/optional-jwt.guard.ts` | New | Auth opcional para `GET :id` |
| `src/modules/payments/payments.service.ts` | Modified | `Access.type='purchase'` en webhook |
| `src/modules/packs/*.spec.ts`, `payments/*.spec.ts` | Modified | Tests CRUD, ownership, unlock |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Soft-delete deja `archived` visible en listados | Low | Filtrar en `my-packs`; públicos ya filtran `active` |
| Auth opcional en `GET :id` filtra datos internos | Low | Solo añade `hasAccess`; proyección pública intacta |
| Webhook duplicado crea doble `Access` | Low | `findFirst` previo (ya existe) + test de idempotencia |
| Compradores pierden acceso al editar `mediaIds` | Med | `updatePack` reemplaza media solo si todas pertenecen al owner (misma regla que `createPack`) |

## Rollback Plan

- Sin migración de schema: nada que deshacer en DB. `git revert` del commit revierte endpoints y tests.
- Soft-delete reversible en ejecución: `UPDATE "ContentPack" SET status='active' WHERE status='archived' AND creator_id=:owner`.
- Webhook `type`: su retroceso no afecta lecturas (`type` no se consume hoy).

## Dependencies

- Ninguna externa. El frontend consumirá `GET /users/library` existente.

## Success Criteria

- [ ] `pnpm test`, `pnpm test:e2e` y `pnpm build` verdes.
- [ ] PATCH/DELETE: 403 si no es owner; 404 si el pack no existe.
- [ ] Webhook `approved` crea `Access` `type='purchase'` (idempotente).
- [ ] `GET /packs/:id` devuelve `hasAccess:true` para buyer autenticado.
- [ ] `GET /users/library` devuelve packs comprados (soporte de `purchasedPacks`).

## Proposal question round

Supuestos a validar por el usuario/orquestador: (1) borrado = soft-delete `archived` vs hard-delete; (2) `Access.type` normalizado a `'purchase'` (con backfill opcional de `'PACK'` histórico); (3) `GET /users/library` como única fuente de `purchasedPacks` (sin endpoint nuevo).