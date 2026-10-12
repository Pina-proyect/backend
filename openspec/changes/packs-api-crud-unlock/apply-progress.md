# Apply Progress: packs-api-crud-unlock (Backend) — Unidades 1 y 3

**Change**: `packs-api-crud-unlock`
**Batch**: Unidad 1 (PR1: CRUD write-path — Fases 1–3, tareas 1.1–1.4, 2.1–2.5, 3.1–3.3) + **Unidad 3 (PR3: webhook/backfill/e2e — Fases 4–5, tareas 4.1–4.5, 5.1–5.3)**
**Fecha**: 2026-10-11
**Modo**: Strict TDD (RED → GREEN → REFACTOR) sobre Jest (`pnpm test`, rootDir `src`), verificación `pnpm build` y `pnpm test:e2e` (harness con DB/Redis reales).
**Estrategia de entrega**: `auto-chain` / stacked-to-main — PR1 = U1 (commiteada), PR3 = U3 (este batch, sin commitear). La U2 del tasks.md (verificación runtime adicional de `hasAccess`) quedó absorbida por el e2e de U3 y por sdd-verify.

## Estado por Work Unit

| Unit | Alcance | Estado | Comando de verificación | Resultado |
|------|---------|--------|-------------------------|-----------|
| 1 | PATCH/DELETE + ownership + soft-delete + `my-packs` filter + `OptionalJwtAuthGuard` + `hasAccess` real en `GET :id` | ✅ Completa | `pnpm test src/modules/packs src/common/guards` | 4 suites / 38 tests PASS |
| 2 | Verificación runtime de `GET :id` con/sin JWT | ✅ Absorbida por U3 (e2e) | `pnpm test:e2e test/packs.e2e-spec.ts` | 16/16 PASS (anónimo, comprador, propietario, sin acceso, token inválido) |
| 3 | Webhook `'purchase'` + backfill script + e2e (Fases 4–5) | ✅ Completa | `pnpm test src/modules/payments` + e2e + backfill CLI | 9 tests unit + 16 e2e + harness runtime OK |

Nota de frontera U3 (según instrucción del orquestador): la **verificación runtime de `GET :id` con/sin JWT** queda cubierta por el harness e2e de la U3 (`test/packs.e2e-spec.ts`, DB real) y queda disponible para re-ejecución junto a **sdd-verify** (curl directo sobre stack levantado).

## Tareas Completadas

### Phase 1: Foundation (U1)
- [x] 1.1 `src/common/types/authenticated-request.ts`: `OptionalAuthenticatedRequest { user?: Creator }`.
- [x] 1.2 `src/modules/packs/dto/update-pack.dto.ts`: todo-opcional (`title` IsString+IsNotEmpty, `description` IsString, `price` IsNumber+Min(0.01), `categoryId` IsUUID, `mediaIds` IsArray+IsUUID('4',{each:true}), `status` IsIn(active|hidden|archived)).
- [x] 1.3 `src/common/guards/optional-jwt.guard.ts`: `extends AuthGuard('jwt')`, `handleRequest` → `user || null` (sin 401).
- [x] 1.4 `optional-jwt.guard.spec.ts`: user válido → user; sin token / expirado / corrupto → null.

### Phase 2: Core CRUD (U1)
- [x] 2.1 `packs.service.spec.ts`: `updatePack` owner-OK/403/404/archived-404/mediaIds ajenos-403/`media:{set}`/body vacío-400; `deletePack` archive/idempotente/403/404; `getMyPacks` excluye archived; `getPackById` archived→404.
- [x] 2.2 `packs.service.ts`: `findPackRaw` (sin filtro archived; select `id/creatorId/status`).
- [x] 2.3 `updatePack`: body vacío→400 → exists→404 → archived→404 → owner→403 → `media.count`→403 → `media:{set}` + update (include media/category).
- [x] 2.4 `deletePack`: exists→404 → owner→403 → `update({status:'archived'})`, idempotente sobre archived.
- [x] 2.5 `getMyPacks` `where status:{not:'archived'}`; `getPackById` 404 si `status==='archived'`.

### Phase 3: HTTP Wiring (U1)
- [x] 3.1 `packs.controller.spec.ts`: PATCH/DELETE delegan con `req.user.id`; `GET :id` `hasAccess` true/false según `req.user`.
- [x] 3.2 `packs.controller.ts`: `@Patch(':id')` y `@Delete(':id')` (`AuthGuard('jwt')`; DELETE `@HttpCode(204)`).
- [x] 3.3 `GET :id` → `@UseGuards(OptionalJwtAuthGuard)`; `hasAccess = req.user?.id ? await hasAccess(userId, id) : false`; se eliminó el hardcode `false`.

### Phase 4: Unlock Persistence (U3)
- [x] 4.1 RED `src/modules/payments/payments.service.spec.ts` (fetch mockeado): approved PACK crea `Access type='purchase'` (falló contra `'PACK'` actual); duplicado `findFirst` → skip; rejected/pending → sin Access; DONATION intacto; falta userId/packId → sin Access.
- [x] 4.2 `payments.service.ts`: `type:'PACK'` → `type:'purchase'` (solo esa línea; flujo DONATION sin tocar).
- [x] 4.3 `scripts/backfill-access-type.ts`: `updateMany({where:{type:'PACK'},data:{type:'purchase'}})`, conteo before/after, re-ejecutable (patrón `scripts/migrate-r2.ts`: core puro exportado + CLI por `require.main === module`).
- [x] 4.4 Spec del backfill: solo `'PACK'` cambia; `purchase`/`gift`/`subscription` intactos (cliente mockeado, sin DB); verificación real en harness runtime.
- [x] 4.5 `package.json`: `"backfill:access-type": "ts-node scripts/backfill-access-type.ts"`.

### Phase 5: E2E + Verification (U3)
- [x] 5.1 `test/packs.e2e-spec.ts` (supertest): PATCH 200/403/404/archivado-404/400-vacío/401; DELETE 204/204-idempotente/403/404; `GET :id` hasAccess anónimo/comprador/propietario/sin-acceso/token-inválido/archivado-404.
- [x] 5.2 `pack-access.guard.spec.ts`: caso archived → 404 (re-propaga el NotFoundException de `getPackById`).
- [x] 5.3 `pnpm test` (24 suites / 145 tests) ✅, `pnpm test:e2e test/packs.e2e-spec.ts` (16/16) ✅, `pnpm build` ✅.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1–1.4 | `optional-jwt.guard.spec.ts` (U1) | Unit | N/A (nuevo) | ✅ TS2307 | ✅ 5/5 | ✅ 4 casos | ✅ `\|\| null` |
| 2.1–2.5 | `packs.service.spec.ts` (U1) | Unit | ✅ spec previa | ✅ TS2339 | ✅ 15/15 | ✅ 14 casos | ✅ tipos Prisma |
| 3.1–3.3 | `packs.controller.spec.ts` (U1) | Unit | ✅ 7/7 previos | ✅ TS2554/TS2339 | ✅ 12/12 | ✅ 5 casos nuevos | ✅ estilo checks una línea |
| 4.1/4.2 | `src/modules/payments/payments.service.spec.ts` | Unit | N/A (nuevo) | ✅ 1 fail / 5 pass (`'PACK'` ≠ `'purchase'`) | ✅ 6/6 | ✅ 6 casos (approved/dup/rejected/pending/DONATION/sin-ref) | ✅ `delete global.fetch` restore |
| 4.3/4.4 | `src/modules/payments/backfill-access-type.spec.ts` | Unit | N/A (nuevo) | ✅ TS2307 (módulo inexistente) | ✅ 3/3 | ✅ 3 casos (conteos/where acotado/idempotencia) | ✅ interfaz `BackfillAccessClient` + default `prisma` |
| 5.1 | `test/packs.e2e-spec.ts` | E2E | Harness DB+Redis reales | ➖ Caracterización (comportamiento U1 ya verde; el harness fija el contrato HTTP) | ✅ 16/16 | ✅ 16 escenarios (PATCH 6 / DELETE 4 / GET 6) | ✅ helpers de setup/cleanup por email único |
| 5.2 | `pack-access.guard.spec.ts` | Unit | ✅ 6/6 previos | ➖ Caracterización (guard ya re-propaga 404 de `getPackById`; faltaba el test) | ✅ 7/7 | ✅ caso nuevo archived→404 | ✅ reuso de `createMockExecutionContext` |
| 5.3 | Suite completa | Verify | — | — | ✅ `pnpm test` 24/145; e2e 16/16; `pnpm build` exit 0 | — | — |

## Work Unit Evidence (U3)

| Evidence | Valor requerido |
|----------|-----------------|
| Comando de test enfocado y resultado exacto | `pnpm test src/modules/payments/payments.service.spec.ts src/modules/payments/backfill-access-type.spec.ts src/modules/packs/guards/pack-access.guard.spec.ts` → 3 suites / 16 tests PASS. Suite completo `pnpm test` → **24 suites / 145 tests PASS** (era 22/135 en U1; +9 unit: payments 6 + backfill 3, +1 guard). |
| Runtime harness comando/escenario y resultado exacto | **E2E real (DB + Redis)**: `pnpm test:e2e test/packs.e2e-spec.ts` → **16/16 PASS** (PATCH 200/403/404/archivado/400/401; DELETE 204/204/403/404; GET hasAccess anónimo/comprador/owner/sin-acceso/token-inválido/archivado). **Backfill CLI real**: seed de 1 `Access type='PACK'` + 1 control `'gift'`; `node --env-file=.env node_modules/ts-node/dist/bin.js scripts/backfill-access-type.ts` → corrida 1 `{before:1, updated:1, after:0}`; corrida 2 `{before:0, updated:0, after:0}` (idempotente); verificación en DB: `PACK`→`purchase`, `gift` intacto; datos temporales eliminados. |
| Rollback boundary | **Webhook**: revertir la línea `type:'purchase'` en `src/modules/payments/payments.service.ts` (el `type` no se consume en lecturas hoy). **Backfill**: borrar `scripts/backfill-access-type.ts`, `src/modules/payments/backfill-access-type.spec.ts` y la entrada `backfill:access-type` de `package.json`; el script es idempotente, re-ejecutable y su reversa sería `updateMany({where:{type:'purchase'}}...)` filtrado por fecha si hiciera falta. **E2E**: borrar `test/packs.e2e-spec.ts`. Sin migración de schema. Revertir U3 no afecta U1 (archivos distintos salvo `payments.service.ts` que U1 no tocó). Los archivos ajenos sin commitear (`multer-error.filter.ts`, `media.controller.spec.ts`, `media.e2e-spec.ts`) no fueron modificados. |

## Archivos Cambiados (U3)

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/modules/payments/payments.service.ts` | Modify | línea del webhook PACK: `type: 'PACK'` → `type: 'purchase'` (+comentario); DONATION intacto. |
| `src/modules/payments/payments.service.spec.ts` | Create | 6 tests: approved→purchase, duplicado skip, rejected/pending sin Access, DONATION intacto, sin userId/packId. |
| `scripts/backfill-access-type.ts` | Create | Core puro `runBackfill` + CLI (patrón migrate-r2), idempotente, conteos before/after. |
| `src/modules/payments/backfill-access-type.spec.ts` | Create | 3 tests con cliente mockeado (sin DB). |
| `package.json` | Modify | +`"backfill:access-type": "ts-node scripts/backfill-access-type.ts"`. |
| `test/packs.e2e-spec.ts` | Create | 16 tests e2e (CRUD + hasAccess + 404 archivado + 403 no-owner). |
| `src/modules/packs/guards/pack-access.guard.spec.ts` | Modify | +1 test archived→404 (7 total). |
| `openspec/changes/packs-api-crud-unlock/tasks.md` | Modify | `[x]` en tareas 4.1–4.5 y 5.1–5.3. |

Archivos de U1 (ya commiteados en `23990bb`): `packs.controller.ts`, `packs.service.ts`, `update-pack.dto.ts`, `optional-jwt.guard.ts` + specs, `authenticated-request.ts`.

## Verificación

- `pnpm test` (suite completo) → **24 suites / 145 tests PASS** ✅ (incluye specs preexistentes y el trabajo ajeno pendiente de la otra sesión; sin fallos)
- `pnpm test:e2e test/packs.e2e-spec.ts` → **16/16 PASS** ✅ (DB y Redis reales; los `ERROR` en el log son los 403/404 intencionales registrados por `GlobalExceptionFilter`)
- `pnpm build` → **exit 0** ✅ (compila también `dist/scripts/backfill-access-type.js` sin errores de tipos)

### Fallos preexistentes
Ninguno. Se mantienen los avisos conocidos: `console.error` intencional en `media.service.spec.ts` (ruta 413) y el warning de teardown "worker process has failed to exit gracefully" (timers preexistentes). El `media.e2e-spec.ts` y `media.controller.spec.ts` (trabajo ajeno) no se ejecutaron como parte de la verificación enfocada de U3; la suite e2e completa queda para sdd-verify.

## Desviaciones del Design (U3)

1. **Ubicación del spec del backfill**: el design proponía `scripts/backfill-access-type.spec.ts`, pero Jest del repo tiene `rootDir: "src"` y no recolecta specs fuera de `src`. El spec vive en `src/modules/payments/backfill-access-type.spec.ts` (cubre `pnpm test` completo y `pnpm test backfill`), importando el core puro de `scripts/backfill-access-type.ts`. El script CLI queda donde diseñó.
2. **RED de 4.4 sin DB**: "solo PACK cambia; purchase/gift/subscription intactos" se prueba con cliente mockeado verificando que el único `updateMany` tiene `where:{type:'PACK'}` y `data:{type:'purchase'}`; la prueba real de "otros tipos intactos" quedó en el harness runtime (gift quedó intacto tras dos corridas).
3. **Ejecución local del backfill**: el script requiere `DATABASE_URL` en el entorno (igual que `migrate:r2` — patrón del repo). Localmente: `node --env-file=.env node_modules/ts-node/dist/bin.js scripts/backfill-access-type.ts`; en producción las env vars del proceso ya están, así que `pnpm backfill:access-type` funciona directo. No se agregó carga de dotenv al script para mantener el patrón `migrate-r2` (consistencia repo).
4. **5.1/5.2 como tests de caracterización**: el comportamiento ya existía de U1; el RED formal no aplica (no hay código nuevo que falle), los tests fijan el contrato y pasan al primer intento (ver evidencia).

## Issues Encontrados

- Ninguno pendiente. Nota operativa: `pnpm backfill:access-type` sin env vars en el shell falla con `PrismaClientInitializationError: DATABASE_URL not found` — comportamiento idéntico al script `migrate:r2` existente; usar `--env-file` localmente o correr en entorno con env configurado (prod/Render).

## Siguiente Paso Recomendado

- Ejecutar **sdd-verify** sobre el cambio completo (U1 commiteada + U3 sin commitear): re-correr `pnpm test`, `pnpm test:e2e` completo (incluye `media.e2e-spec.ts` ajeno) y la verificación runtime `GET :id` con/sin JWT sobre stack levantado. Luego sdd-archive tras merge de PRs.