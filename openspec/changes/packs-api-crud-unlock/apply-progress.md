# Apply Progress: packs-api-crud-unlock (Backend) — Work Unit 1

**Change**: `packs-api-crud-unlock`
**Batch**: Unidad 1 (PR1: CRUD write-path) — Fases 1–3 (tareas 1.1–1.4, 2.1–2.5, 3.1–3.3)
**Fecha**: 2026-10-11
**Modo**: Strict TDD (RED → GREEN → REFACTOR) sobre Jest (`pnpm test`, rootDir `src`), verificación extra `pnpm build`.
**Estrategia de entrega**: `auto-chain` / stacked-to-main — PR1 = U1 (este batch). U2 y U3 quedan pendientes para PR2 y PR3.

## Estado por Work Unit

| Unit | Alcance | Estado | Comando de verificación | Resultado |
|------|---------|--------|-------------------------|-----------|
| 1 | PATCH/DELETE + ownership + soft-delete + `my-packs` filter + `OptionalJwtAuthGuard` + `hasAccess` real en `GET :id` | ✅ Completa | `pnpm test src/modules/packs src/common/guards` | 4 suites / 38 tests PASS |
| 2 | `OptionalJwtAuthGuard` ya quedó en U1 (se adelantó por diseño D3); verificación adicional de `GET :id` en runtime en U2 según tasks.md | ⏳ Pendiente | `pnpm test optional-jwt` | — |
| 3 | Webhook `'purchase'` + backfill script + e2e (Fases 4–5) | ⏳ Pendiente | `pnpm test payments backfill && pnpm test:e2e packs` | — |

Nota de frontera: las tareas 1.3/1.4 del guard y 3.3 de `GET :id` con `hasAccess` pertenecen dentro del plan original a la U1 (Fases 1 y 3) y la U2 (tasks.md los agrupa distinto); se implementaron completas en esta U1 porque la spec `packs-unlock` de `GET :id` exige el guard opcional junto con el CRUD. La U2 del tasks.md (verificación adicional de `hasAccess` sobre `GET :id` en runtime) queda como verificación complementaria.

## Tareas Completadas

### Phase 1: Foundation
- [x] 1.1 `src/common/types/authenticated-request.ts`: `OptionalAuthenticatedRequest { user?: Creator }`.
- [x] 1.2 `src/modules/packs/dto/update-pack.dto.ts`: todo-opcional (`title` IsString+IsNotEmpty, `description` IsString, `price` IsNumber+Min(0.01), `categoryId` IsUUID, `mediaIds` IsArray+IsUUID('4',{each:true}), `status` IsIn(active|hidden|archived)).
- [x] 1.3 `src/common/guards/optional-jwt.guard.ts`: `extends AuthGuard('jwt')`, `handleRequest` → `user || null` (sin 401).
- [x] 1.4 `optional-jwt.guard.spec.ts`: user válido → user; sin token / expirado / corrupto → null.

### Phase 2: Core CRUD (service)
- [x] 2.1 `packs.service.spec.ts`: `updatePack` owner-OK/403/404/archived-404/mediaIds ajenos-403/`media:{set}`/body vacío-400; `deletePack` archive/idempotente/403/404; `getMyPacks` excluye archived; `getPackById` archived→404.
- [x] 2.2 `packs.service.ts`: `findPackRaw` (sin filtro archived; select `id/creatorId/status`).
- [x] 2.3 `updatePack`: body vacío→400 → exists→404 → archived→404 → owner→403 → `media.count`→403 → `media:{set}` + update (include media/category).
- [x] 2.4 `deletePack`: exists→404 → owner→403 → `update({status:'archived'})`, idempotente sobre archived.
- [x] 2.5 `getMyPacks` `where status:{not:'archived'}`; `getPackById` 404 si `status==='archived'`.

### Phase 3: HTTP Wiring
- [x] 3.1 `packs.controller.spec.ts`: PATCH/DELETE delegan con `req.user.id`; `GET :id` `hasAccess` true/false según `req.user`.
- [x] 3.2 `packs.controller.ts`: `@Patch(':id')` y `@Delete(':id')` (`AuthGuard('jwt')`; DELETE `@HttpCode(204)`).
- [x] 3.3 `GET :id` → `@UseGuards(OptionalJwtAuthGuard)`; `hasAccess = req.user?.id ? await hasAccess(userId, id) : false`; se eliminó el hardcode `false`.

### Pendientes (U2 / U3)
- [ ] 4.1–4.5 Webhook `Access.type='purchase'` + backfill script `backfill-access-type` + entrada `package.json` (U3).
- [ ] 5.1 e2e `test/packs.e2e-spec.ts` (supertest) (U3).
- [ ] 5.2 `pack-access.guard.spec.ts`: caso archived→404 (el guard ya lo cubre vía `getPackById`; falta el test) (U3).
- [ ] 5.3 `pnpm test` + `pnpm test:e2e` + `pnpm build` completos (U3).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | — (type export, estructural) | Unit | ✅ 14/14 (packs) | ✅ Escrito | ✅ Compila | ➖ Single (solo una salida posible) | ✅ Clean |
| 1.2 | — (DTO, estructural) | Unit | N/A (nuevo) | ✅ Escrito (validado vía service/controller specs) | ✅ Compila | ➖ Single (campos declarativos) | ✅ Clean |
| 1.3/1.4 | `src/common/guards/optional-jwt.guard.spec.ts` | Unit | N/A (nuevo) | ✅ Escrito (TS2307: guard inexistente) | ✅ Passed 5/5 | ✅ 4 casos (válido, sin token, expirado, error) | ✅ `|| null` en vez de `?? null` (pasaba `false`) |
| 2.1–2.5 | `src/modules/packs/packs.service.spec.ts` | Unit | ✅ 1/1 (spec previa) | ✅ Escrito (TS2339: updatePack/deletePack inexistentes) | ✅ Passed 15/15 | ✅ 14 casos (7 update + 4 delete + my-packs + 2 getPackById) | ✅ `Prisma.ContentPackUpdateInput` (build OK) |
| 3.1–3.3 | `src/modules/packs/packs.controller.spec.ts` | Unit | ✅ 7/7 (spec previa) | ✅ Escrito (TS2554/TS2339) | ✅ Passed 12/12 | ✅ 5 casos nuevos (3 hasAccess + PATCH + DELETE) | ✅ Estilo checks una línea, sin duplicación |

## Work Unit Evidence

| Evidence | Valor requerido |
|----------|-----------------|
| Comando de test enfocado y resultado exacto | `pnpm test src/modules/packs src/common/guards` → **4 suites / 38 tests PASS** (guard 5, service 15, controller 12, pack-access 6). Suite completo `pnpm test` → **22 suites / 135 tests PASS**. |
| Runtime harness comando/escenario y resultado | N/A — esta U1 es write-path con ownership; el harness runtime (curl PATCH/DELETE 403/404/204 y `GET :id` con/sin JWT) está planificado en U2/U3 (e2e supertest) y requiere stack levantado (DB + Redis). Verificación sustituta: `pnpm build` (nest build) → **OK sin errores de tipo**. |
| Rollback boundary | Revertir: `src/modules/packs/packs.controller.ts`, `src/modules/packs/packs.service.ts`, `src/modules/packs/dto/update-pack.dto.ts`, `src/common/guards/optional-jwt.guard.ts`, `optional-jwt.guard.spec.ts`, `src/common/types/authenticated-request.ts` (+ specs). Sin migración de schema; sin tocar `payments.service.ts` ni scripts. Revertir `git revert` de los archivos de U1 no afecta U2/U3. |

## Archivos Cambiados (U1)

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/common/types/authenticated-request.ts` | Modify | +`OptionalAuthenticatedRequest { user?: Creator }`. |
| `src/common/guards/optional-jwt.guard.ts` | Create | Guard JWT opcional (subclase de `AuthGuard('jwt')`). |
| `src/common/guards/optional-jwt.guard.spec.ts` | Create | Spec unit (5 casos). |
| `src/modules/packs/dto/update-pack.dto.ts` | Create | DTO todo-opcional + enum `PACK_STATUSES`/`PackStatus`. |
| `src/modules/packs/packs.service.ts` | Modify | +`findPackRaw`, `updatePack`, `deletePack`; `getMyPacks` filtra archived; `getPackById` 404 si archived. |
| `src/modules/packs/packs.service.spec.ts` | Modify | 15 tests (CRUD/ownership/soft-delete/filtros). |
| `src/modules/packs/packs.controller.ts` | Modify | +`PATCH :id`, +`DELETE :id` (204); `GET :id` con `OptionalJwtAuthGuard` y `hasAccess` real. |
| `src/modules/packs/packs.controller.spec.ts` | Modify | 12 tests (hasAccess anónimo/buyer/sin acceso, delegación PATCH/DELETE). |
| `openspec/changes/packs-api-crud-unlock/tasks.md` | Modify | `[x]` en tareas 1.1–1.4, 2.1–2.5, 3.1–3.3. |

## Verificación

- `pnpm test src/modules/packs src/common/guards` → 4 suites / 38 tests PASS ✅
- `pnpm test` (suite completo) → 22 suites / 135 tests PASS ✅ (incluye specs preexistentes; no hay fallos preexistentes)
- `pnpm build` → OK ✅

### Fallos preexistentes
Ninguno. El log de `pnpm test` muestra un `console.error` intencional en `media.service.spec.ts` (test de ruta de error 413) que pasa igual; el warning "worker process has failed to exit gracefully" es un leak de teardown preexistente (timers), no un fallo de test.

## Desviaciones del Design

- **D3** se implementó con `user || null` en vez del `user ?? null` literal del tasks.md: passport entrega `user=false` cuando no hay token, y `false ?? null` devuelve `false` (rompería el contrato anónimo). `|| null` normaliza cualquier falsy a `null`. Los specs 1.4/3.3 exigen `null` sin 401, así que la desviación corrige el diseño.
- **Orden de checks en `updatePack`**: el 400 "al menos un campo" se evalúa primero (antes de tocar la DB), consistente con D5 (validación en service). No hay escenario de spec que combine body vacío + pack inexistente.
- `findPackRaw` usa `select: { id, creatorId, status }` en vez de devolver el pack completo: las mutaciones solo necesitan esos campos (menos superficie, mismo comportamiento observable).

## Issues Encontrados

- Ninguno pendiente. Hubo un edit accidental que borró una línea (`const data: Prisma.ContentPackUpdateInput`) durante un pulido de estilo; se detectó por relectura y se reparó antes de re-verificar (tests + build verdes después del fix).

## Siguiente Paso Recomendado

- Ejecutar **U2** (fases remanentes del tasks.md relacionadas con `hasAccess` runtime) o pasar directo a **U3** (Fases 4–5: webhook `'purchase'` + backfill + e2e), según la cadena stacked-to-main decidida por el orquestador. Luego `sdd-verify` sobre el cambio completo.