# packs-unlock Specification

## Purpose

Completa la HU3.2 consolidando el contrato de desbloqueo: `GET /packs/:id` debe exponer `hasAccess` real con autenticación opcional; el webhook de Mercado Pago debe persistir `Access.type='purchase'` (normalizado; hoy escribe `'PACK'`) con backfill de los registros históricos; `GET /users/library` queda como única fuente de `purchasedPacks` para el frontend. No existen specs previos en `openspec/specs/`, por lo que esta es una spec completa para la capability.

## Requirements

### Requirement: GET /packs/:id — hasAccess real con auth opcional

El sistema DEBE exponer `GET /api/pina/packs/:id` con un guard de JWT opcional (nuevo `OptionalJwtAuthGuard`): si el request lleva un JWT válido, DEBE calcular `hasAccess = hasAccess(user.id, packId)` (true si el usuario es el dueño del pack o posee un registro `Access`); si no hay token, o el token es inválido o expirado, DEBE tratar el request como anónimo y devolver `hasAccess: false`. El cambio DEBE limitarse a añadir `hasAccess`: la proyección pública (media blanqueada) y el 404 para packs inexistentes DEBEN permanecer intactos; NO DEBE hardcodearse `hasAccess: false`.

#### Scenario: Usuario anónimo

- GIVEN un request GET `/packs/:id` sin token
- WHEN se procesa con auth opcional
- THEN responde 200 con el pack público y `hasAccess: false`

#### Scenario: Comprador autenticado

- GIVEN un usuario con un registro `Access` del pack
- WHEN pide GET `/packs/:id` con JWT válido
- THEN responde el pack público con `hasAccess: true`

#### Scenario: Propietario autenticado

- GIVEN el usuario es `creatorId` del pack
- WHEN pide GET `/packs/:id` con JWT válido
- THEN responde el pack público con `hasAccess: true`

#### Scenario: Usuario autenticado sin acceso

- GIVEN un usuario autenticado sin `Access` y sin ownership del pack
- WHEN pide GET `/packs/:id`
- THEN responde el pack público con `hasAccess: false`

#### Scenario: Token inválido o expirado

- GIVEN un JWT corrupto o expirado
- WHEN pide GET `/packs/:id`
- THEN se trata como anónimo: responde 200 con `hasAccess: false` (sin 401)

### Requirement: Webhook MP — Access.type normalizado a 'purchase'

En el flujo PACK del webhook (payment `status='approved'`), el sistema DEBE crear el registro `Access` con `type='purchase'`, reemplazando el valor `'PACK'` actual. DEBE preservar la idempotencia existente: antes de crear, consulta `Access` por `userId+packId` (`findFirst`) y omite la creación si ya existe. El flujo DONATION DEBE permanecer intacto (no se modifica).

#### Scenario: Pago aprobado libera el pack

- GIVEN un webhook `payment` con `status='approved'`, `userId`, `packId` y sin `Access` previo
- WHEN se procesa el flujo PACK
- THEN crea `Access` con `type='purchase'`

#### Scenario: Webhook duplicado (idempotencia)

- GIVEN ya existe un `Access` para `userId+packId`
- WHEN llega un nuevo webhook `approved` para el mismo par
- THEN no crea un segundo registro y responde `received: true`

#### Scenario: Pago no aprobado

- GIVEN `status` es `rejected` o `pending`
- WHEN se procesa el webhook
- THEN no crea `Access`

### Requirement: Backfill de datos 'PACK' → 'purchase'

El sistema DEBE incluir un script de datos (sin cambio de schema ni migración DDL) que actualice todos los registros `Access` históricos con `type='PACK'` a `type='purchase'`. El script DEBE ser idempotente y re-ejecutable, y DEBE dejar intactos los tipos `purchase`, `gift` y `subscription`.

#### Scenario: Backfill de registros históricos

- GIVEN registros `Access` con `type='PACK'`
- WHEN se ejecuta el script de backfill
- THEN esos registros quedan con `type='purchase'`

#### Scenario: Tipos existentes no afectados

- GIVEN registros con `type='purchase'|'gift'|'subscription'`
- WHEN se ejecuta el script de backfill
- THEN permanecen sin cambios

### Requirement: GET /users/library como fuente única de purchasedPacks

El sistema DEBE mantener `GET /api/pina/users/library` (JWT) como única fuente de los packs comprados del usuario para el soporte de `purchasedPacks` en el frontend; NO DEBE crearse un endpoint nuevo. El endpoint DEBE devolver los packs asociados a los registros `Access` del usuario, ordenados por fecha de acceso descendente y con proyección firmada (media resuelta). Si el usuario no tiene accesos, DEBE responder `200 []`.

#### Scenario: Usuario con packs comprados

- GIVEN un usuario con registros `Access`
- WHEN llama a GET `/users/library` con JWT válido
- THEN responde 200 con esos packs (media firmada), ordenados por acceso más reciente

#### Scenario: Usuario sin compras

- GIVEN un usuario sin registros `Access`
- WHEN llama a GET `/users/library` con JWT válido
- THEN responde 200 con lista vacía