# Tasks: packs-api-crud-unlock (Backend)

## Review Workload Forecast

Estimated changed lines: ~950–1150 (additions + deletions). Project `review_budget_lines` = 800; the estimate exceeds it.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | PATCH/DELETE + ownership + soft-delete + `my-packs` filter | PR 1 | `pnpm test src/modules/packs` | `pnpm start:dev` + curl PATCH/DELETE `/api/pina/packs/:id` (403/404/204) | revert `packs.{controller,service}.ts` + `update-pack.dto.ts` |
| 2 | `OptionalJwtAuthGuard` + real `hasAccess` on `GET :id` | PR 2 | `pnpm test optional-jwt` | curl `GET /packs/:id` with/without JWT (`hasAccess` true/false) | revert guard + `authenticated-request.ts` + GET handler |
| 3 | Webhook `'purchase'` + backfill script + e2e | PR 3 | `pnpm test payments backfill && pnpm test:e2e packs` | `pnpm backfill:access-type` (count before/after) | revert `payments.service.ts` line + `scripts/backfill-access-type.ts` |

## Phase 1: Foundation

- [x] 1.1 `src/common/types/authenticated-request.ts`: add `OptionalAuthenticatedRequest { user?: Creator }`.
- [x] 1.2 Create `src/modules/packs/dto/update-pack.dto.ts`: all-optional `title/description/price(Min 0.01)/categoryId(UUID)/mediaIds(UUID[])/status(IsIn active|hidden|archived)`.
- [x] 1.3 Create `src/common/guards/optional-jwt.guard.ts`: `extends AuthGuard('jwt')`, override `handleRequest` → `user ?? null` (no 401).
- [x] 1.4 RED `src/common/guards/optional-jwt.guard.spec.ts`: valid user → user; missing/expired/corrupt → null.

## Phase 2: Core CRUD (service)

- [x] 2.1 RED `src/modules/packs/packs.service.spec.ts`: `updatePack` owner-OK/403/404/archived-404/foreign-mediaIds-403/`media:{set}`; `deletePack` archive/idempotent-204/403/404; `getMyPacks` excludes archived.
- [x] 2.2 `packs.service.ts`: add `findPackRaw` (no archived filter).
- [x] 2.3 `updatePack`: exists→404 → archived→404 → owner→403 → `media.count`→403 → `media:{set}` + update (include media/category).
- [x] 2.4 `deletePack`: exists→404 → owner→403 → `update({status:'archived'})`, idempotent over archived.
- [x] 2.5 `getMyPacks` `where status:{not:'archived'}`; `getPackById` throws 404 if `status==='archived'`.

## Phase 3: HTTP Wiring

- [x] 3.1 RED `packs.controller.spec.ts`: PATCH/DELETE delegate with `req.user.id`; `GET :id` `hasAccess` true/false by `req.user`.
- [x] 3.2 `packs.controller.ts`: add `@Patch(':id')` and `@Delete(':id')` (`AuthGuard('jwt')`; DELETE `@HttpCode(204)`).
- [x] 3.3 `GET :id` → `@UseGuards(OptionalJwtAuthGuard)`; `hasAccess = req.user ? await hasAccess(req.user.id,id) : false`; remove hardcoded `false`.

## Phase 4: Unlock Persistence

- [x] 4.1 RED `src/modules/payments/payments.service.spec.ts` (fetch mocked): approved PACK creates `Access type='purchase'`; duplicate `findFirst` → skip; rejected/pending → no Access.
- [x] 4.2 `payments.service.ts` (~365): `type:'PACK'` → `type:'purchase'` (preserve DONATION flow).
- [x] 4.3 Create `scripts/backfill-access-type.ts`: `updateMany({where:{type:'PACK'},data:{type:'purchase'}})`, count before/after, re-runnable (pattern `scripts/migrate-r2.ts`).
- [x] 4.4 RED `scripts/backfill-access-type.spec.ts`: only `'PACK'` changed; `purchase`/`gift`/`subscription` untouched.
- [x] 4.5 `package.json`: add `"backfill:access-type": "ts-node scripts/backfill-access-type.ts"`.

## Phase 5: E2E + Verification

- [x] 5.1 Create `test/packs.e2e-spec.ts` (supertest): PATCH/DELETE 200/403/404/204; `GET :id` `hasAccess` anonymous/buyer/owner.
- [x] 5.2 `src/modules/packs/guards/pack-access.guard.spec.ts`: archived pack → 404.
- [x] 5.3 Run `pnpm test`, `pnpm test:e2e`, `pnpm build` green; confirm each spec scenario.
