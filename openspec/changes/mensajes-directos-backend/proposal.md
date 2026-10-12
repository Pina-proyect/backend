# Proposal: mensajes-directos-backend (HU6.3)

> **TAREA DELEGADA** — asignada por el orquestador del worktree frontend (2026-10-12). Backend: `backend-nest/backend-dev` (rama `etrigan16/backend-dev`). Siguiente fase: `sdd-spec` (o `sdd-continue`).

## Intent
Habilitar **mensajes directos** entre creadora y seguidores/donantes (HU6.3 del MAPA). Conversación asíncrona con autorización y lectura/no-leído.

## Problem
- HU6.3 está pendiente (`backlog.md` §8); no existe módulo de mensajería en el backend.
- El frontend no tiene pantalla de mensajes.

## Scope
**In**:
1. Modelo `Conversation` + `Message`: participantes, `threadType` (creator↔donor/visitor), contenido, leído/no leído, timestamps.
2. Endpoints: `POST /messages` (crear thread o responder), `GET /messages/conversations`, `GET /messages/:conversationId/messages`, `PATCH /messages/:id/read`, contador `unread-count`.
3. Autorización estricta: solo participantes de la conversación (creadora o el remitente/contacto), sin exponer privacidad.
4. Inicialmente **polling** (sin WebSocket) salvo que ya exista infra reutilizable; si no, documentar para una fase posterior.
5. Tests Jest unit + e2e.

**Out**: WebSocket/tiempo real, adjuntos, notificaciones push, UI frontend (después del contrato).

## Acceptance Criteria
1. Solo participantes acceden a su conversación (403/404 correctos).
2. No-leído incrementa `unread-count` y `PATCH read` lo resetea correctamente.
3. Listado de conversaciones ordenado por última actividad.
4. `pnpm test`, `pnpm test:e2e`, `pnpm build` verdes.

## Dependencies
- MAPA HU6.3 (`documentacion/docs-dev/MAPA DE ÉPICAS...md`).
- Patrones de módulos: `backend-dev/openspec/specs/`.

## Rollback
Revert del commit; sin DDL destructiva (DDL additive).