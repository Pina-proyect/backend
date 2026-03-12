## Objetivo
Crear una interfaz UI mínima servida por Nest para probar endpoints clave del backend Pina sin agregar dependencias nuevas.

## Alcance
- Ruta `GET /pina/ui` que devuelve una página HTML con controles para:
  - `GET /pina/health`
  - `POST /pina/auth/login`
  - `GET /pina/auth/google` (redirección 302)
  - `POST /pina/auth/refresh` (usa cookie HttpOnly del mismo origen)

## Estructura de Código
- `src/modules/ui/ui.controller.ts`: Renderiza HTML estático con `fetch` al backend.
- `src/modules/ui/ui.module.ts`: Declara el controlador.
- `src/app.module.ts`: Importa `UiModule`.

## HTML y JS (resumen)
- Estilos básicos integrados.
- Form de login con `email` y `password` → POST `/pina/auth/login` (`credentials: 'same-origin'`).
- Botón de refresh → POST `/pina/auth/refresh` usando cookie.
- Botón health → GET `/pina/health`.
- Link OAuth → `/pina/auth/google`.

## Validación
- `yarn start` y abrir `http://localhost:3000/pina/ui`.
- Verificar respuestas:
  - Health → 200 con JSON.
  - Login → JSON con tokens; cookie `refresh_token` HttpOnly set.
  - OAuth → 302 si faltan credenciales; funcional con `.env` completo.
  - Refresh → nuevos tokens.

## Tests
- Mantener unit y e2e existentes en verde.
- (Opcional) Añadir e2e simple para `GET /pina/ui` (200 y `text/html`).

## Seguridad
- UI solo para desarrollo, no exponer en producción.
- No loggear tokens ni secretos.
- Cookies `HttpOnly`, `SameSite: 'lax'`, `secure` en producción ya aplicadas.

## Próximo Paso
Si confirmas, creo `UiModule` y `UiController`, los integro en `AppModule`, arranco y valido endpoints desde la nueva UI.