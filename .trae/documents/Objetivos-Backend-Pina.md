# Objetivos de Construcción - Backend Pina

## Visión General
El backend de Pina está diseñado para proporcionar una API RESTful robusta y segura que sirva como capa de servicios para la plataforma frontend. La arquitectura está basada en NestJS con TypeScript, PostgreSQL con Prisma ORM, y sigue principios de diseño modular y escalable.

## Objetivos Principales

### 1. Arquitectura y Estructura
- **Modularidad**: Implementar una arquitectura modular donde cada dominio de negocio tenga su propio módulo
- **Escalabilidad**: Diseñar el sistema para soportar crecimiento horizontal y vertical
- **Mantenibilidad**: Código limpio, bien documentado y fácil de mantener
- **Testing**: Cobertura completa con tests unitarios y de integración

### 2. Seguridad y Autenticación
- **JWT Authentication**: Implementar autenticación basada en tokens JWT con refresh tokens
- **OAuth Integration**: Soporte para autenticación con Google OAuth 2.0
- **Encriptación**: Password hashing con bcrypt (10 rounds mínimo)
- **Validación**: Validación exhaustiva de entrada de datos con DTOs
- **CORS**: Configuración apropiada de CORS para el frontend

### 3. Gestión de Usuarios
- **Registro de Creadores**: Sistema de registro para creadores de contenido
- **Perfil de Usuario**: Gestión completa del perfil incluyendo KYC (Know Your Customer)
- **Verificación de Identidad**: Integración con servicios de verificación de identidad
- **Gestión de Roles**: Sistema de roles y permisos escalable

### 4. API RESTful
- **Endpoints Consistentes**: Todos los endpoints siguen RESTful conventions
- **Versionado**: Prefijo global `/pina` para todos los endpoints
- **Respuestas Estandarizadas**: Formato consistente de respuestas HTTP
- **Documentación**: Documentación automática con Swagger/OpenAPI

### 5. Base de Datos
- **PostgreSQL**: Base de datos relacional robusta y escalable
- **Prisma ORM**: Mapeo objeto-relacional moderno y type-safe
- **Migraciones**: Sistema de migraciones controlado por versiones
- **Índices**: Optimización de consultas con índices apropiados

### 6. Servicios de Backend
- **Autenticación**: Login, logout, refresh tokens, OAuth
- **Gestión de Usuarios**: CRUD completo de usuarios
- **KYC**: Verificación de identidad y documentación
- **Health Check**: Endpoint de salud del sistema
- **UI de Desarrollo**: Interfaz provisional para testing de endpoints

## Estructura de Módulos

```
src/
├── modules/
│   ├── auth/           # Autenticación y autorización
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── dto/
│   │   ├── strategies/
│   │   └── repositories/
│   ├── health/         # Health checks
│   ├── ui/            # Interfaz de desarrollo
│   └── users/         # Gestión de usuarios (futuro)
├── prisma/            # Configuración y servicios de Prisma
├── shared/            # Utilidades y tipos compartidos
└── main.ts           # Punto de entrada
```

## Endpoints Principales

### Autenticación
- `POST /pina/auth/login` - Inicio de sesión
- `POST /pina/auth/register` - Registro de creador
- `GET /pina/auth/google` - Inicio de OAuth con Google
- `GET /pina/auth/google/callback` - Callback de Google OAuth
- `POST /pina/auth/refresh` - Refrescar token de acceso

### Gestión de Usuarios
- `GET /pina/users/profile` - Obtener perfil del usuario
- `PUT /pina/users/profile` - Actualizar perfil
- `POST /pina/users/kyc` - Enviar documentación KYC

### Utilidades
- `GET /pina/health` - Estado del servicio
- `GET /pina/ui` - Interfaz de desarrollo

## Integración con Frontend

### CORS Configuration
```typescript
// Configuración para desarrollo
FRONTEND_URL=http://localhost:4011

// Headers CORS
Access-Control-Allow-Origin: http://localhost:4011
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Flujo de Autenticación
1. **Login Tradicional**: Usuario envía credenciales → Backend valida → Retorna access token y setea refresh token cookie
2. **OAuth Google**: Usuario click en login con Google → Redirección → Callback → Tokens generados
3. **Refresh Token**: Frontend solicita nuevo access token usando cookie HttpOnly

### Manejo de Errores
- **400 Bad Request**: Datos de entrada inválidos
- **401 Unauthorized**: Credenciales inválidas o token expirado
- **403 Forbidden**: Sin permisos suficientes
- **404 Not Found**: Recurso no encontrado
- **500 Internal Server Error**: Error del servidor

## Seguridad

### Tokens JWT
- **Access Token**: 15 minutos de expiración
- **Refresh Token**: 7 días de expiración, almacenado en cookie HttpOnly
- **Secret Key**: Variable de entorno JWT_SECRET fuerte y única

### Protección de Datos
- **Password Hashing**: bcrypt con 10 rounds mínimo
- **Validación de Entrada**: DTOs con class-validator
- **Rate Limiting**: Implementar límites de peticiones
- **HTTPS**: Solo en producción con certificados SSL

## Testing

### Tests Unitarios
- **Cobertura Mínima**: 80% del código
- **Framework**: Jest con NestJS testing utilities
- **Mocking**: Mock de dependencias externas

### Tests de Integración
- **E2E Tests**: Flujos completos de usuario
- **Database Tests**: Operaciones con base de datos de prueba
- **API Tests**: Validación de endpoints y respuestas

## Monitoreo y Observabilidad

### Logging
- **Estructurado**: Logs en formato JSON
- **Niveles**: ERROR, WARN, INFO, DEBUG
- **Contexto**: Incluir userId, requestId, timestamp

### Métricas
- **Health Checks**: Endpoint para verificar estado
- **Performance**: Tiempo de respuesta de endpoints
- **Errores**: Tasa de errores por endpoint

## Flujo de Desarrollo

### Entorno Local
1. **Base de Datos**: PostgreSQL con Docker Compose
2. **Migraciones**: Aplicar con `yarn migrate`
3. **Desarrollo**: `yarn start:dev` con hot-reload
4. **Testing**: `yarn test` y `yarn test:e2e`

### Pipeline CI/CD
- **Linting**: ESLint con configuración TypeScript
- **Testing**: Tests unitarios y de integración
- **Build**: Compilación TypeScript a JavaScript
- **Deploy**: Despliegue automatizado

## Próximos Pasos

### Fase 1 - MVP (Actual)
- ✅ Autenticación básica y OAuth
- ✅ UI de desarrollo para testing
- ✅ Health checks y monitoreo básico

### Fase 2 - Gestión de Usuarios
- 🔄 CRUD completo de usuarios
- 🔄 Sistema de roles y permisos
- 🔄 Integración completa KYC

### Fase 3 - Funcionalidades Avanzadas
- 📋 Gestión de contenido
- 📋 Sistema de pagos
- 📋 Notificaciones
- 📋 Analytics y reporting

## Recomendaciones

### Performance
- Implementar caché con Redis para sesiones frecuentes
- Usar índices de base de datos para queries comunes
- Considerar paginación para listados grandes

### Escalabilidad
- Diseñar para microservicios si el crecimiento lo requiere
- Implementar colas de mensajes para operaciones pesadas
- Considerar sharding de base de datos para datos masivos

### Seguridad Adicional
- Implementar 2FA (Two-Factor Authentication)
- Añadir límites de intentos de login
- Implementar auditoría de acciones críticas
- Considerar encriptación de datos sensibles en reposo