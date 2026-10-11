# packs-crud Specification

## Purpose

Completa la HU3.1: el backend debe permitir a un creador editar y eliminar sus propios packs de contenido, con validación de ownership y sin destruir datos (soft-delete `status='archived'`). Los listados del propietario (`GET /packs/my-packs`) deben excluir los packs archivados. No existen specs previos en `openspec/specs/`, por lo que esta es una spec completa para la capability.

## Requirements

### Requirement: PATCH /packs/:id — actualización con ownership

El sistema DEBE exponer `PATCH /api/pina/packs/:id` protegido con JWT (`AuthGuard('jwt')`) y validar el body con `UpdatePackDto`: todos los campos opcionales y al menos uno presente. Reglas por campo:

| Campo | Regla |
|-------|-------|
| `title` | string no vacío |
| `description` | string opcional |
| `price` | number >= 0.01 |
| `categoryId` | UUID |
| `mediaIds` | array de UUIDs; reemplaza el set actual |
| `status` | enum `active|hidden|archived` |

El service DEBE devolver 404 si el pack no existe o su `status='archived'`, y 403 si `pack.creatorId !== req.user.id`. Si `mediaIds` está presente, DEBE verificar que todos los medios pertenezcan al creador (misma regla que `createPack`) y devolver 403 si alguno no; superada la verificación, DEBE reemplazar el set de medios. El resultado DEBE incluir `media` y `category` actualizados.

#### Scenario: El propietario edita título y precio

- GIVEN un creador autenticado posee un pack `active`
- WHEN envía PATCH `/packs/:id` con `{ title, price }` válidos
- THEN responde 200 con el pack actualizado, incluyendo `media` y `category`

#### Scenario: No propietario intenta editar

- GIVEN un usuario autenticado que no es `creatorId` del pack
- WHEN envía PATCH `/packs/:id`
- THEN responde 403 Forbidden y el pack no cambia

#### Scenario: Pack inexistente o archivado

- GIVEN el pack no existe o tiene `status='archived'`
- WHEN envía PATCH `/packs/:id`
- THEN responde 404 Not Found

#### Scenario: Body vacío

- GIVEN un PATCH sin ningún campo del DTO
- WHEN se valida el body
- THEN responde 400 (requiere al menos un campo)

#### Scenario: mediaIds con medios ajenos al creador

- GIVEN `mediaIds` incluye al menos un medio que no pertenece al creador
- WHEN envía PATCH `/packs/:id` con `mediaIds`
- THEN responde 403 y NO modifica el pack

#### Scenario: Payload inválido

- GIVEN `price` negativo, `categoryId` no-UUID o `status` fuera del enum
- WHEN se valida el body (global ValidationPipe)
- THEN responde 400 Validation Error

### Requirement: DELETE /packs/:id — soft-delete idempotente

El sistema DEBE exponer `DELETE /api/pina/packs/:id` protegido con JWT y responder 204 No Content. El service DEBE responder 404 si el pack no existe y 403 si el usuario no es el propietario. La eliminación DEBE ser soft-delete: actualiza `status='archived'` sin borrar filas ni medios (sin hard-delete ni cascada). La operación DEBE ser idempotente: borrar un pack ya `archived` DEBE responder 204 sin error.

#### Scenario: Propietario archiva su pack

- GIVEN un creador autenticado posee un pack `active`
- WHEN envía DELETE `/packs/:id`
- THEN responde 204 y el pack queda con `status='archived'`

#### Scenario: DELETE repetido (idempotencia)

- GIVEN un pack ya `archived` del mismo propietario
- WHEN envía DELETE `/packs/:id` nuevamente
- THEN responde 204 sin duplicar ni fallar

#### Scenario: No propietario intenta borrar

- GIVEN un usuario autenticado que no es `creatorId` del pack
- WHEN envía DELETE `/packs/:id`
- THEN responde 403 Forbidden

#### Scenario: Pack inexistente

- GIVEN el pack no existe
- WHEN envía DELETE `/packs/:id`
- THEN responde 404 Not Found

### Requirement: GET /my-packs excluye packs archivados

El sistema DEBE filtrar `status != 'archived'` en `GET /api/pina/packs/my-packs` del propietario, manteniendo la proyección firmada existente (URLs resueltas).

#### Scenario: Propietario con packs activos, ocultos y archivados

- GIVEN un creador con packs `active`, `hidden` y `archived`
- WHEN llama a GET `/packs/my-packs` autenticado
- THEN responde solo los packs `active` y `hidden`, nunca `archived`