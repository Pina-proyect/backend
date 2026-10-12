# Proposal: perfil-backend-contract

> **TAREA DELEGADA** — asignada por el orquestador del worktree frontend (2026-10-12).
> En el worktree frontend solo se hace frontend; este cambio lo debe realizar el agente/sesión del worktree BACKEND (`backend-nest/backend-dev`, rama `etrigan16/backend-dev`).
> Estado: PROPUESTA LISTA → siguiente fase: `sdd-spec` (o `sdd-continue`).

## Intent

Exponer en el backend los datos REALES de redes sociales y ubicación que el modelo `Creator` ya guarda, pero que el endpoint público NO sirve (hoy solo devuelve booleanos `instagram`/`tiktok`/`youtube` y nada de `country`). Esto lleva HU2.1 (perfil público con links/bio reales) al 100% y sienta la base para HU2.3 (apariencia/privacidad).

## Problem

- `GET /api/pina/users/profile/:slug` devuelve SOLO booleanos de presencia (`instagram`, `tiktok`, `youtube`) y NO expone URLs ni `country`.
- El frontend del cambio archivado `perfil-social-privacy` (frontend-dev) tuvo que **degradar** a badges de presencia NO clickeables y omitir "Localidad", porque el dato real no llega desde el backend.
- Dependencia documentada en:
  - `frontend-dev/openspec/specs/public-creator-profile/spec.md` (capability con requirements de fallback defensivo).
  - `frontend-dev/openspec/changes/archive/2026-10-11-perfil-social-privacy/verify-report.md` (WARNING: "el endpoint no expone country ni URLs sociales reales → requiere un cambio backend propio").
  - `documentacion/docs-dev/docs/baseline-canonico-pina.md` §3 (resolución canónica: fronteras backend pendientes).

## Scope

### In
1. Exponer `country?` (string) en `GET /users/profile/:slug` y en el perfil propio (`GET /auth/me` y/o `GET /users/profile`), null-safe.
2. Exponer `socialLinks?` con las **URLs reales** (p. ej. `[{ platform: 'instagram'|'tiktok'|'youtube', url: string }]` o mapa por plataforma), normalizado y con orden estable, derivado del campo que ya guarda `Creator` (JSON socialLinks / socialUrls del onboarding).
3. Mantener **backward compatibility**: los booleanos actuales (`instagram/tiktok/youtube`) siguen disponibles (se pueden derivar) para no romper consumidores existentes.
4. Respetar privacidad por default: sin token no se filtran campos privados; solo lo público del perfil.
5. Tests Jest unit + e2e cubriendo: con datos, sin datos (ausente/null, no falla), anónimo vs autenticado.

### Out
- HU2.3 (apariencia/privacidad settings) — change posterior separado.
- UI frontend (ya implementada y consume el contrato con fallback defensivo; solo necesita el contrato para activar URLs/ubicación reales).

## Approach (sugerencia — decisión del backend)
Extender el serializer/mapper del perfil público (`users` module) para incluir `country` y `socialLinks` normalizados desde el modelo `Creator`, con null-safe y orden de plataformas estable. Mantener proyecciones separadas si ya existen (pública vs privada).

## Acceptance Criteria
1. `GET /users/profile/:slug` devuelve `country` (o ausente) y `socialLinks` con URLs reales cuando existen.
2. Sin datos → campos ausentes/null (no falla, no inventa).
3. Backward-compatible: booleanos de presencia siguen funcionando.
4. `pnpm test`, `pnpm test:e2e` y `pnpm build` verdes en `backend-nest/backend-dev`.
5. e2e verifica que el perfil ANÓNIMO no filtra datos no públicos.

## Dependencies
- Frontend (ya listo): capability `public-creator-profile` en `frontend-dev/openspec/specs/` — consume el contrato con fallback; al activarse el contrato, mostrará URLs/ubicación reales (sin requerir cambio frontend adicional, o uno mínimo de wiring).
- Patrones backend a seguir: `backend-dev/openspec/specs/packs-crud/spec.md` y `packs-unlock/spec.md` (módulos, DTOs, e2e con stack DB+Redis).

## Rollback
Revert del commit del cambio; sin migración de schema (el dato ya existe en `Creator`).