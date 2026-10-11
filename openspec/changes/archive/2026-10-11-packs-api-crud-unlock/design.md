# Design: packs-api-crud-unlock (Backend)

## Technical Approach

Completar el CRUD de packs (PATCH/DELETE) con ownership en `PacksService`, exponer
`hasAccess` real en `GET /packs/:id` mediante un nuevo `OptionalJwtAuthGuard`,
normalizar el `Access.type` del webhook a `'purchase'` y agregar un backfill de datos
idempotente. Sin cambio de schema Prisma: `ContentPack.status` y `Access.type` ya
existen. Reutiliza el patrón comments (controller delgado, ownership en service) y la
regla de ownership de media de `createPack`.

## Architecture Decisions

| # | Decisión | Opciones descartadas | Racional |
|---|----------|----------------------|----------|
| D1 | DELETE = soft-delete `status='archived'` vía `contentPack.update` | hard-delete / cascada | Spec exige reversibilidad; no borra `Access`, `Media` ni comentarios. |
| D2 | PATCH/DELETE usan un finder **raw** (`findPackRaw`); `getPackById` agrega 404 si `status==='archived'` | un solo finder parametrizado | Mantiene mutaciones idempotentes (DELETE sobre archivado = 204) y oculta archivados de lecturas públicas/contenido. |
| D3 | Guard opcional = subclase de `AuthGuard('jwt')` que sobreescribe `handleRequest(err,user)` devolviendo `user ?? null` | `ValidateIf`, try/catch manual | Sin 401 en token inválido/expirado; anónimo explícito. |
| D4 | Orden de checks en `updatePack`: exists → `archived` (404) → owner (403) | owner antes de archived | 404 antes que 403 evita filtrar existencia de packs archivados ajenos. |
| D5 | "Al menos un campo" se valida en el service (`BadRequestException` → 400); DTO todo-opcional | constraint class-level custom | class-validator no tiene built-in de clase; el service ya es dueño de reglas de negocio. |
| D6 | Backfill = script `ts-node` (patrón `scripts/migrate-r2.ts`), sin DDL | migración Prisma custom | Skill database-migrations: DML separado de DDL. |
| D7 | Webhook: `type:'purchase'` inline; se preserva `findFirst` de idempotencia | constraint/upsert nuevo | Cambio de 1 línea, no toca flujo DONATION. |

## Data Flow

    PATCH/DELETE /packs/:id
      AuthGuard('jwt') → Controller → PacksService.updatePack/deletePack
        → findPackRaw(id) ─(missing)→ 404
        → status archived? ─(sí, PATCH)→ 404 / (DELETE)→ idempotente 204
        → owner? ─(no)→ 403
        → PATCH: media.count(ids, creatorId) ─(≠len)→ 403 ; media:{set} + update
        → DELETE: update({status:'archived'}) → 204

    GET /packs/:id
      OptionalJwtAuthGuard → user? ─(sí)→ hasAccess(user.id,id) : false
        → getPackById (404 si archived) → proyección pública + hasAccess

    Webhook approved (PACK) → findFirst(userId,packId) ─(existe)→ skip
        └──────────────────(no existe)→ access.create(type:'purchase')

## File Changes

| File | Acción | Descripción |
|------|--------|-------------|
| `src/modules/packs/packs.controller.ts` | Modify | +`PATCH :id`, +`DELETE :id`; `GET :id` usa `OptionalJwtAuthGuard` y `hasAccess` real. |
| `src/modules/packs/packs.service.ts` | Modify | +`findPackRaw`, `updatePack`, `deletePack`; `getMyPacks` filtra `status:{not:'archived'}`; `getPackById` 404 si archived. |
| `src/modules/packs/dto/update-pack.dto.ts` | Create | Todos los campos opcionales (title/description/price/categoryId/mediaIds/status). |
| `src/common/guards/optional-jwt.guard.ts` | Create | `OptionalJwtAuthGuard extends AuthGuard('jwt')`. |
| `src/common/types/authenticated-request.ts` | Modify | +`OptionalAuthenticatedRequest { user?: Creator }`. |
| `src/modules/payments/payments.service.ts` | Modify | `type: 'PACK'` → `type: 'purchase'` (línea ~365). |
| `scripts/backfill-access-type.ts` | Create | `updateMany({where:{type:'PACK'},data:{type:'purchase'}})`, conteo antes/después, re-ejecutable. |
| `package.json` | Modify | +`"backfill:access-type": "ts-node scripts/backfill-access-type.ts"`. |
| `src/modules/packs/packs.service.spec.ts` | Modify | +casos PATCH/DELETE/getMyPacks. |
| `src/modules/packs/packs.controller.spec.ts` | Modify | +PATCH/DELETE/hasAccess. |
| `src/common/guards/optional-jwt.guard.spec.ts` | Create | Guard unit. |
| `src/modules/packs/guards/pack-access.guard.spec.ts` | Modify | Caso archived→404. |
| `src/modules/payments/payments.service.spec.ts` | Create | Webhook PACK idempotente + `type='purchase'`. |
| `scripts/backfill-access-type.spec.ts` | Create | Función pura idempotente. |
| `test/packs.e2e-spec.ts` | Create | PATCH/DELETE + hasAccess anónimo/comprador. |

## Interfaces / Contracts

```ts
// update-pack.dto.ts — todos @IsOptional
title?: string;            // @IsString @IsNotEmpty
description?: string;      // @IsString
price?: number;            // @IsNumber @Min(0.01)
categoryId?: string;       // @IsUUID
mediaIds?: string[];       // @IsArray @IsUUID('4',{each:true})
status?: 'active'|'hidden'|'archived'; // @IsIn([...])

// packs.service.ts
async updatePack(creatorId: string, packId: string, dto: UpdatePackDto)
async deletePack(creatorId: string, packId: string): Promise<void>
private findPackRaw(packId: string) // sin filtro archived

// GET /packs/:id
const userId = req.user?.id;
hasAccess = userId ? await this.packsService.hasAccess(userId, id) : false;
```

`hasAccess` existente ya cubre owner→true, `Access`→true, resto→false (usa
`access.findUnique({ where:{ userId_packId }})`). No requiere cambios.

## Testing Strategy

| Capa | Qué | Cómo |
|------|-----|------|
| Unit | `updatePack`: owner OK, 403 ajeno, 404 missing/archived, `mediaIds` ajenos→403, `set` reemplaza; body vacío→400 | `packs.service.spec.ts` con Prisma mock (`findUnique`, `media.count`, `update`). |
| Unit | `deletePack`: archiva, idempotente sobre archived→204, 403, 404; `getMyPacks` excluye archived | `packs.service.spec.ts`. |
| Unit | Controller PATCH/DELETE delegan; `hasAccess` true/false según `req.user` | `packs.controller.spec.ts`. |
| Unit | `OptionalJwtAuthGuard` con/sin user y con error | `optional-jwt.guard.spec.ts`. |
| Unit | Guard bloquea archived (404 vía `getPackById`) | `pack-access.guard.spec.ts`. |
| Unit | Webhook: approved crea `purchase`, duplicado skip, rejected/pending sin Access | `payments.service.spec.ts` (fetch mockeado). |
| Unit | Backfill pura: solo `'PACK'`, deja `purchase/gift/subscription` | `scripts/backfill-access-type.spec.ts`. |
| E2E | PATCH/DELETE ownership + `hasAccess` anónimo/comprador/owner | `test/packs.e2e-spec.ts` (supertest). |

## Threat Matrix

| Boundary | Applicable | Comportamiento seguro / fallo esperado | Test RED |
|----------|-----------|----------------------------------------|----------|
| Script `ts-node` backfill (`process`/DB) | Sí | Sin DDL; updateMany acotado por `type='PACK'`; re-ejecutable; reporta conteo antes/después; no toca otros tipos | `backfill-access-type.spec.ts` |
| Routing HTTP | No (rutas Nest estándar, sin proxy/redirección) | — | — |
| Ejecución de shell/subproceso arbitrario | No | — | — |
| VCS/PR automation / clasificación de ejecutables | No | — | — |

## Migration / Rollout

Sin migración DDL. Rollout: (1) deploy backend con endpoints + webhook `purchase`;
(2) ejecutar `pnpm backfill:access-type` (idempotente, conteo verificado). Rollback:
`git revert` del commit; soft-delete reversible con
`UPDATE "ContentPack" SET status='active' WHERE status='archived' AND "creatorId"=:owner`;
backfill reversible con `updateMany({where:{type:'purchase'}}...)` filtrado por fecha si
hiciera falta; el `type` no se consume en lecturas hoy.

## Open Questions

- [ ] ¿Se permite `PATCH` con `status:'archived'` (equivalente a DELETE)? El spec lo permite vía enum; se implementa tal cual.
- [ ] ¿DONATION debe algún día registrar `Access`? Fuera de scope.
