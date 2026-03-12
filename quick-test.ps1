# Prueba rápida de endpoints

$BASE_URL = "http://localhost:3000/pina"

Write-Host "=== PRUEBA RÁPIDA DE ENDPOINTS ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar si el servidor está corriendo
Write-Host "1. Verificando si el servidor está corriendo..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method GET
    Write-Host "✅ Servidor está corriendo:" -ForegroundColor Green
    $health | ConvertTo-Json
} catch {
    Write-Host "❌ Servidor no está disponible en $BASE_URL" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Intentar login con credenciales de prueba
Write-Host "2. Probando login con credenciales de prueba..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "test@example.com"
        password = "password123"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    Write-Host "✅ Login exitoso" -ForegroundColor Green
    
    # Extraer token
    $token = $loginResponse.accessToken
    Write-Host "Token obtenido: $($token.Substring(0, 20))..." -ForegroundColor Green
    
    # Guardar token para pruebas posteriores
    $global:TOKEN = $token
    
} catch {
    Write-Host "❌ Login falló (esto es normal si el usuario no existe)" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Intentar registro
    Write-Host "3. Intentando registro de usuario de prueba..." -ForegroundColor Yellow
    try {
        $registerBody = @{
            fullName = "Usuario Prueba"
            email = "test@example.com"
            password = "password123"
            birthDate = "1990-01-01"
        } | ConvertTo-Json
        
        $registerResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/register" -Method POST -Body $registerBody -ContentType "application/json"
        Write-Host "✅ Registro exitoso" -ForegroundColor Green
        
        # Intentar login nuevamente
        $loginResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
        $global:TOKEN = $loginResponse.accessToken
        Write-Host "✅ Login después de registro exitoso" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Registro también falló" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# 4. Si tenemos token, probar endpoints de usuario
if ($global:TOKEN) {
    Write-Host "4. Probando GET /users/profile..." -ForegroundColor Yellow
    try {
        $profile = Invoke-RestMethod -Uri "$BASE_URL/users/profile" -Method GET -Headers @{
            "Authorization" = "Bearer $($global:TOKEN)"
        }
        Write-Host "✅ GET /users/profile exitoso" -ForegroundColor Green
        Write-Host "Perfil:" -ForegroundColor White
        $profile | ConvertTo-Json
        
        Write-Host ""
        Write-Host "5. Probando PATCH /users/profile..." -ForegroundColor Yellow
        
        $updateBody = @{
            slug = "usuario-test-123"
            bio = "Biografía de prueba con validación"
            fullName = "Usuario Actualizado"
            phone = "+1234567890"
        } | ConvertTo-Json
        
        $updatedProfile = Invoke-RestMethod -Uri "$BASE_URL/users/profile" -Method PATCH -Body $updateBody -ContentType "application/json" -Headers @{
            "Authorization" = "Bearer $($global:TOKEN)"
        }
        Write-Host "✅ PATCH /users/profile exitoso" -ForegroundColor Green
        Write-Host "Perfil actualizado:" -ForegroundColor White
        $updatedProfile | ConvertTo-Json
        
    } catch {
        Write-Host "❌ Error en endpoints de usuario" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  No hay token disponible para probar endpoints de usuario" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== PRUEBA COMPLETADA ===" -ForegroundColor Cyan