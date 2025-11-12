# 📖 Reglas de Proyecto PINA (Resumen para el repositorio)

Este documento resume las reglas y lineamientos del proyecto PINA para facilitar el trabajo colaborativo dentro de este repositorio. El documento de referencia operativo existe a nivel workspace (*.trae/rules/project_rules.md*), pero aquí dejamos una versión resumida para consulta rápida de todo el equipo.

## 1. Stack Tecnológico

- Frontend: `Next.js (App Router)`.
- UI: `Shadcn/UI` + `Tailwind CSS`. Única librería UI permitida.
- Backend: `Nest.js`.
- Base de datos: `PostgreSQL` gestionado con `Prisma`.
- Caché/Colas: `Redis`.
- Despliegue: `Docker` hacia `GCP` (Cloud Run/GKE).
- Testing: `Jest / Vitest`. Tests unitarios obligatorios para lógica de negocio.

## 2. Principios de Arquitectura

1. Microservicios (Usuarios, Contenido, Pagos), desplegables de forma independiente.
2. Comunicación vía APIs REST exclusivamente.
3. Seguridad con JWT (Access y Refresh) generados por `AuthModule`.
4. Flujos asíncronos para operaciones lentas (KYC, procesamiento de video), usando colas (Redis) cuando aplique.

## 3. Frontend (Next.js)

- Componentes: usar `Shadcn/UI`.
- Estilos: `Tailwind CSS` (no CSS tradicional ni CSS-in-JS).
- Estado global: `Zustand` (p.ej. patrón `auth.store.ts`).
- Formularios: `React Hook Form` + `Zod` (p.ej. patrón `session/model/session.ts`).

## 4. Backend (Nest.js)

- Generación de código con CLI de Nest (`nest g mo`, `nest g s`, `nest g co`).
- ORM: Prisma Client inyectado vía `PrismaService` (no SQL crudo).
- Validación: `class-validator` + `class-transformer` en DTOs de entrada.
- Seguridad: seguir `PassportModule` y `JwtModule` definidos por arquitectura.

## 5. Integraciones Clave

### 5.1 Subida de Archivos (GCS)

- No subir archivos desde el Frontend al Backend.
- Flujo correcto:
  1. Frontend solicita URL firmada al Backend.
  2. Backend (Nest) genera Signed URL de GCS.
  3. Frontend sube directo a GCS (PUT).
  4. Frontend notifica éxito; Backend persiste ruta/URL final en BD (Prisma).

### 5.2 Pagos (Mercado Pago)

- No manejar datos de tarjeta.
- Flujo correcto:
  1. Frontend solicita creación de pago.
  2. Backend genera Preferencia de Pago y devuelve URL de checkout.
  3. Frontend redirige al checkout de Mercado Pago.
  4. Backend expone webhook `/api/pagos/webhook` para confirmar pago asíncrono.

### 5.3 KYC (Verificación de Identidad)

- Backend implementa `KycProviderService` (proveedor externo: Didi, Veriff, etc.).
- Frontend sube imágenes (selfie, DNI) usando flujo de GCS (ver 5.1).

## 6. Buenas Prácticas

- `Yarn` como gestor de paquetes y en documentación/comandos.
- Mantener `.env` fuera del control de versiones; usar `.env.example` para variables requeridas.
- Tests unitarios y e2e con Jest; mantener mapeos de alias coherentes.
- Seguridad: no exponer secretos; usar GitHub Secrets en CI/CD; protección de ramas.

---

Para detalles completos, consultar el documento de reglas a nivel workspace o la documentación del Arquitecto del proyecto.