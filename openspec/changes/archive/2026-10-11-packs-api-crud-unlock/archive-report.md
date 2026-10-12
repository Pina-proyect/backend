# Archive Report: packs-api-crud-unlock (Backend)

- **Fecha de cierre**: 2026-10-11
- **Repositorio**: `C:\Users\guill\orca\workspaces\backend-nest\backend-dev` (PINA backend, worktree `backend-dev`)
- **Modo de artefactos**: hybrid (openspec + engram)
- **Fase archivadora**: sdd-archive
- **Estado**: ARCHIVADO — ciclo SDD completo (proposal → spec → design → tasks → apply → verify → archive)

## Resumen ejecutivo

El cambio `packs-api-crud-unlock` completa las historias HU3.1/HU3.2 del backend: expone `PATCH /api/pina/packs/:id` y `DELETE /api/pina/packs/:id` con validación de ownership y soft-delete (`status='archived'`), implementa `hasAccess` real en `GET /packs/:id` con autenticación JWT opcional, normaliza el `Access.type` del webhook de Mercado Pago a `'purchase'` (con backfill idempotente de los registros `'PACK'` históricos) y consolida `GET /users/library` como fuente canónica de `purchasedPacks`. Verificación final: **23/23 escenarios COMPLIANT** (0 CRITICAL), `pnpm test` **25 suites / 148 tests** PASS, `pnpm test:e2e` **4 suites / 36 tests** PASS (stack real DB+Redis), `pnpm build` exit 0. Sin migración de schema.

## Estado final (autoridad: launch prompt del orquestador + verify-report remediado + git log)

### Tareas
- **20/20 tareas de implementación** (fases 1–5: 4+5+3+5+3) + **remediación R.1–R.4** completas — todas `[x]` en `tasks.md` archivado (24 checkboxes `[x]`, 0 sin marcar). Nota de trazabilidad: el launch prompt del orquestador las contaba como "12/12"; el artefacto persistido y verify-report registran 20/20 — el conteo autoritativo es el del artefacto persistido, y en ambos casos todas están completas.
- Task Completion Gate: 0 tareas sin marcar en el artefacto persistido. ✅

### Gates
- **Review gate**: no existe `state.yaml` ni transacciones de review para este cambio; review nativo `disabled/unmanaged` (kill switch off) → no bloquea.
- **CRITICAL issues en verify-report**: **0** → no bloquea archive.

### Verificación (verde en runtime, determinista)
| Suite | Resultado |
|-------|-----------|
| `pnpm test` (Jest unit) | ✅ 25 suites / 148 tests PASS (era 24/145 pre-remediación) |
| `pnpm test:e2e` (supertest, DB+Redis reales) | ✅ 4 suites / 36 tests PASS (era 4/31 pre-remediación; `packs.e2e-spec` 16 → 21) |
| `pnpm build` (nest build) | ✅ exit 0, hash de salida idéntico al veredicto original (`9aba080a…` — build determinista) |
| Backfill CLI sobre DB real | ✅ 2 corridas consecutivas `{before:0, updated:0, after:0}` (dataset limpio; idempotencia y ejecución real demostradas) |

- **Verify**: PASS remediado — **23/23 escenarios COMPLIANT** (7/7 requisitos), 0 PARTIAL, 0 UNTESTED, 0 CRITICAL, 3 WARNING cerrados por remediación, 3 SUGGESTION (preexistentes). Gaps originales (400 ValidationPipe en payload inválido, orden `createdAt desc` en library, caso vacío `200 []`) cubiertos **sin tocar implementación** (los tests pasaron GREEN a la primera, confirmando que eran gaps de cobertura).

### Remediación (2026-10-11, por sdd-apply)
| Escenario cerrado | Test agregado | Archivo |
|-------------------|---------------|---------|
| packs-crud: Payload inválido → 400 ValidationPipe | `it.each` con `price:-1`, `categoryId:'no-uuid'`, `status:'invalido'` → 400 (3 casos) | `test/packs.e2e-spec.ts` L211-230 |
| packs-unlock: orden `createdAt desc` en library | spec de servicio afirma `orderBy:{createdAt:'desc'}` + preservación de orden (+3 tests) | `src/modules/users/services/users.service.spec.ts` (nuevo) |
| packs-unlock: usuario sin compras → 200 [] | spec de servicio `devuelve []` + e2e verifica `200 []` real | `users.service.spec.ts` L86 + `test/packs.e2e-spec.ts` L342 |

### Commits
| Commit | Contenido |
|--------|-----------|
| `23990bb` (U1) | feat(packs): CRUD write-path con ownership, soft-delete y hasAccess real |
| `6204524` (U3) | feat(packs): webhook Access tipo purchase + backfill + e2e |
| `985c27c` (remediación) | test(packs): cubrir 400 ValidationPipe y scenarios de library (verify remediation) |
| `86f892b` y anteriores de media | Ajenos (sesión paralela media) — no forman parte de este cambio |

- **Sin migración de schema**: `prisma/schema.prisma` sin cambios en U1/U3 (`Access.type @default("purchase")` + `@@unique([userId,packId])` y `ContentPack.status` ya existían).
- **Archivos de la sesión paralela (media) NO tocados**: `media.controller.spec.ts`, `media.e2e-spec.ts` y `multer-error.filter.ts` no aparecen en `git show --name-only` de `23990bb` ni `6204524`.

## Warnings / deuda documentada

- **WARNING preexistentes (ajenos al cambio)**: `console.error` 413 intencional en `media.service.spec.ts` (ruta 413) y warning de teardown de Jest ("worker process has failed to exit gracefully"). No bloquean; documentados en verify-report como SUGGESTION.
- **Deuda ajena**: `tsc`/lint strict no declarado como gate en este repo; sin umbral de coverage configurado (`test:cov` no gate).
- **SUGGESTION abierta**: silenciar el 413 en el spec de media si se desea (fuera de scope de este cambio).

## Specs sincronizadas (source of truth)

| Domain | Acción | Detalles |
|--------|--------|----------|
| `openspec/specs/packs-crud/spec.md` | Creada (copia directa de delta — spec completa) | 3 requisitos / 11 escenarios |
| `openspec/specs/packs-unlock/spec.md` | Creada (copia directa de delta — spec completa) | 4 requisitos / 12 escenarios |

No existían specs previos en `openspec/specs/` (solo `.gitkeep`); los deltas eran specs completas → copia directa, sin merge destructivo. Verificado con `diff`: idénticas al delta archivado.

## Contenido del archive

- `proposal.md` ✅
- `specs/packs-crud/spec.md` + `specs/packs-unlock/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (24/24 `[x]` — 20 tareas + R.1–R.4)
- `apply-progress.md` ✅
- `verify-report.md` ✅ (PASS remediado, 23/23)
- `archive-report.md` ✅ (este archivo)

Carpeta movida: `openspec/changes/packs-api-crud-unlock/` → `openspec/changes/archive/2026-10-11-packs-api-crud-unlock/`. El directorio de cambios activos ya no contiene este cambio.

## Persistencia engram

- `sdd/packs-api-crud-unlock/archive-report` (`topic_key`, type: `architecture`, project: pina-frontend, capture_prompt: false) — guardado en paralelo al archive filesystem.
- IDs de observación de artefactos intermedios: no aplican (modo hybrid con artefactos en filesystem; el reporte engram es el registro de auditoría equivalente).

## Notas de trazabilidad

- Veredicto original de verify fue `fail` por 3 escenarios sin test (2 PARTIAL + 1 UNTESTED, sin defectos); la remediación lo elevó a `pass` con `remediated: true` (2026-10-11). Este reporte refleja el estado FINAL post-remediación, no los snapshots intermedios.
- Commits de remediación creados por el orquestador (no por sdd-verify).
- Sin commits de archive: el orquestador indicó explícitamente NO hacer commit de este pase.