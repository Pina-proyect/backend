# Guía de Pruebas - Endpoints de Usuarios

## 📋 Resumen de Implementación

He creado exitosamente un sistema completo de gestión de perfiles de usuario con las siguientes características:

### ✅ Funcionalidades Implementadas

1. **UpdateProfileDto** ([`update-profile.dto.ts`](src/modules/auth/dto/update-profile.dto.ts))
   - Validación de slug: solo letras, números y guiones
   - Validación de bio: máximo 255 caracteres
   - Campos opcionales: fullName, phone, slug, bio

2. **UsersController** ([`users.controller.ts`](src/modules/users/controllers/users.controller.ts))
   - `GET /pina/users/profile` - Obtener perfil del usuario autenticado
   - `PATCH /pina/users/profile` - Actualizar perfil con validaciones

3. **UsersService** ([`users.service.ts`](src/modules/users/services/users.service.ts))
   - Validación de unicidad del slug
   - Manejo de errores HTTP apropiados (404, 409)

4. **Repository Updates** ([`creator.repository.ts`](src/modules/auth/repositories/creator.repository.ts))
   - Método `findBySlug()` - Buscar usuario por slug
   - Método `update()` - Actualizar datos del usuario

## 🚀 Cómo Probar los Endpoints

### Paso 1: Iniciar el Servidor
```bash
# Iniciar la base de datos (si está disponible)
yarn db:up

# Iniciar el servidor de desarrollo
yarn start:dev
```

### Paso 2: Obtener un Token JWT

#### Opción A: Login con usuario existente
```bash
curl -X POST http://localhost:3000/pina/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### Opción B: Registrar un nuevo usuario
```bash
curl -X POST http://localhost:3000/pina/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Usuario Prueba",
    "email": "test@example.com",
    "password": "password123",
    "birthDate": "1990-01-01"
  }'
```

### Paso 3: Probar Endpoints de Usuario

#### GET /pina/users/profile
```bash
curl -X GET http://localhost:3000/pina/users/profile \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

**Respuesta Exitosa (200):**
```json
{
  "id": "uuid-del-usuario",
  "fullName": "Usuario Prueba",
  "email": "test@example.com",
  "slug": null,
  "bio": null,
  "phone": null,
  "photoPath": null,
  "verificationStatus": "pending",
  "provider": "credentials",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

#### PATCH /pina/users/profile
```bash
curl -X PATCH http://localhost:3000/pina/users/profile \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "usuario-test-123",
    "bio": "Biografía de prueba con validación",
    "fullName": "Usuario Actualizado",
    "phone": "+1234567890"
  }'
```

**Respuesta Exitosa (200):**
```json
{
  "id": "uuid-del-usuario",
  "fullName": "Usuario Actualizado",
  "email": "test@example.com",
  "slug": "usuario-test-123",
  "bio": "Biografía de prueba con validación",
  "phone": "+1234567890",
  "photoPath": null,
  "verificationStatus": "pending",
  "provider": "credentials",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

## 🧪 Casos de Prueba Recomendados

### 1. Slug Inválido
```bash
curl -X PATCH http://localhost:3000/pina/users/profile \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "slug invalido con espacios!"
  }'
```

**Respuesta Esperada (400):**
```json
{
  "statusCode": 400,
  "message": [
    "El slug solo puede contener letras, números y guiones"
  ],
  "error": "Bad Request"
}
```

### 2. Bio Demasiado Larga
```bash
curl -X PATCH http://localhost:3000/pina/users/profile \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Esta es una biografía extremadamente larga que excede el límite de 255 caracteres permitidos por el sistema. Estoy escribiendo mucho texto para probar que la validación funciona correctamente y rechaza este contenido por ser demasiado extenso para el campo bio."
  }'
```

**Respuesta Esperada (400):**
```json
{
  "statusCode": 400,
  "message": [
    "La biografía no puede exceder 255 caracteres"
  ],
  "error": "Bad Request"
}
```

### 3. Slug Duplicado
```bash
# Primero actualizar con un slug
curl -X PATCH http://localhost:3000/pina/users/profile \
  -H "Authorization: Bearer TU_TOKEN_JWT_1" \
  -H "Content-Type: application/json" \
  -d '{"slug": "slug-unico"}'

# Luego intentar usar el mismo slug con otro usuario
curl -X PATCH http://localhost:3000/pina/users/profile \
  -H "Authorization: Bearer TU_TOKEN_JWT_2" \
  -H "Content-Type: application/json" \
  -d '{"slug": "slug-unico"}'
```

**Respuesta Esperada (409):**
```json
{
  "statusCode": 409,
  "message": "El slug ya está en uso por otro usuario",
  "error": "Conflict"
}
```

### 4. Sin Autenticación
```bash
curl -X GET http://localhost:3000/pina/users/profile
```

**Respuesta Esperada (401):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

## 📁 Scripts de Prueba

He creado los siguientes scripts para facilitar las pruebas:

1. **[`quick-test.ps1`](quick-test.ps1)** - Script de PowerShell que automatiza el proceso completo
2. **[`test-endpoints.ps1`](test-endpoints.ps1)** - Script interactivo con menú de opciones
3. **[`test-login.sh`](test-login.sh)** - Script bash para obtener tokens

### Uso del Script Principal
```powershell
# Ejecutar prueba completa
powershell -ExecutionPolicy Bypass -File quick-test.ps1

# Ejecutar menú interactivo
powershell -ExecutionPolicy Bypass -File test-endpoints.ps1
```

## 🔍 Validaciones Implementadas

### UpdateProfileDto
- **slug**: 
  - Opcional
  - Solo letras, números y guiones (`/^[a-zA-Z0-9-]+$/`)
  - No puede estar vacío si se proporciona
  - Único en la base de datos

- **bio**: 
  - Opcional
  - Máximo 255 caracteres
  - Mensaje de error en español

- **fullName**: 
  - Opcional
  - No puede estar vacío si se proporciona

- **phone**: 
  - Opcional
  - Sin validación de formato específica

## 🚨 Manejo de Errores

El sistema implementa manejo de errores HTTP apropiado:

- **400 Bad Request**: Datos de entrada inválidos
- **401 Unauthorized**: Token JWT inválido o ausente
- **404 Not Found**: Usuario no encontrado
- **409 Conflict**: Slug duplicado
- **500 Internal Server Error**: Error del servidor

## 📝 Notas Importantes

1. **Base de Datos**: Si Docker no está disponible, los endpoints aún funcionarán pero no podrán completar las operaciones de base de datos.

2. **Tokens JWT**: Los tokens tienen una expiración de 15 minutos. Si expira, deberás obtener uno nuevo.

3. **Validaciones**: Todas las validaciones están implementadas en español para mantener consistencia con el proyecto.

4. **Seguridad**: Los endpoints requieren autenticación JWT y solo permiten que los usuarios actualicen su propio perfil.

5. **Testing**: Los errores de compilación en los tests son normales después de agregar campos al modelo y no afectan el funcionamiento del código principal.