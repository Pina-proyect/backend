# Script de prueba para endpoints de usuarios

$BASE_URL = "http://localhost:3000/pina"
$TOKEN = "" # Token JWT se obtendrá después

function Test-GetProfile {
    Write-Host "=== Probando GET /users/profile ===" -ForegroundColor Green
    if ($TOKEN) {
        try {
            $response = Invoke-RestMethod -Uri "$BASE_URL/users/profile" `
                -Method GET `
                -Headers @{
                    "Authorization" = "Bearer $TOKEN"
                    "Content-Type" = "application/json"
                }
            Write-Host "✅ Respuesta exitosa:" -ForegroundColor Green
            $response | ConvertTo-Json -Depth 10
        }
        catch {
            Write-Host "❌ Error:" -ForegroundColor Red
            Write-Host $_.Exception.Message
            if ($_.Exception.Response) {
                $statusCode = $_.Exception.Response.StatusCode.value__
                Write-Host "HTTP Status: $statusCode"
            }
        }
    } else {
        Write-Host "❌ Token no disponible. Por favor obtén un token primero." -ForegroundColor Yellow
    }
    Write-Host ""
}

function Test-UpdateProfile {
    param(
        [string]$slug = "usuario-test-123",
        [string]$bio = "Biografía de prueba con validación",
        [string]$fullName = "Usuario de Prueba",
        [string]$phone = "+1234567890"
    )
    
    Write-Host "=== Probando PATCH /users/profile ===" -ForegroundColor Green
    if ($TOKEN) {
        $body = @{
            slug = $slug
            bio = $bio
            fullName = $fullName
            phone = $phone
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$BASE_URL/users/profile" `
                -Method PATCH `
                -Headers @{
                    "Authorization" = "Bearer $TOKEN"
                    "Content-Type" = "application/json"
                } `
                -Body $body
            Write-Host "✅ Perfil actualizado exitosamente:" -ForegroundColor Green
            $response | ConvertTo-Json -Depth 10
        }
        catch {
            Write-Host "❌ Error:" -ForegroundColor Red
            Write-Host $_.Exception.Message
            if ($_.Exception.Response) {
                $statusCode = $_.Exception.Response.StatusCode.value__
                Write-Host "HTTP Status: $statusCode"
            }
        }
    } else {
        Write-Host "❌ Token no disponible. Por favor obtén un token primero." -ForegroundColor Yellow
    }
    Write-Host ""
}

function Test-InvalidSlug {
    Write-Host "=== Probando PATCH con slug inválido ===" -ForegroundColor Yellow
    if ($TOKEN) {
        $body = @{
            slug = "slug invalido con espacios!"
            bio = "Biografía de prueba"
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$BASE_URL/users/profile" `
                -Method PATCH `
                -Headers @{
                    "Authorization" = "Bearer $TOKEN"
                    "Content-Type" = "application/json"
                } `
                -Body $body
            Write-Host "⚠️  Respuesta inesperada (debería fallar):" -ForegroundColor Yellow
            $response | ConvertTo-Json -Depth 10
        }
        catch {
            Write-Host "✅ Validación funcionando correctamente:" -ForegroundColor Green
            Write-Host "Error esperado:" $_.Exception.Message
            if ($_.Exception.Response) {
                $statusCode = $_.Exception.Response.StatusCode.value__
                Write-Host "HTTP Status: $statusCode"
            }
        }
    } else {
        Write-Host "❌ Token no disponible." -ForegroundColor Yellow
    }
    Write-Host ""
}

function Test-LongBio {
    Write-Host "=== Probando PATCH con bio muy larga ===" -ForegroundColor Yellow
    if ($TOKEN) {
        $longBio = "Esta es una biografía extremadamente larga que excede el límite de 255 caracteres permitidos por el sistema. Estoy escribiendo mucho texto para probar que la validación funciona correctamente y rechaza este contenido por ser demasiado extenso para el campo bio."
        
        $body = @{
            bio = $longBio
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$BASE_URL/users/profile" `
                -Method PATCH `
                -Headers @{
                    "Authorization" = "Bearer $TOKEN"
                    "Content-Type" = "application/json"
                } `
                -Body $body
            Write-Host "⚠️  Respuesta inesperada (debería fallar):" -ForegroundColor Yellow
            $response | ConvertTo-Json -Depth 10
        }
        catch {
            Write-Host "✅ Validación funcionando correctamente:" -ForegroundColor Green
            Write-Host "Error esperado:" $_.Exception.Message
            if ($_.Exception.Response) {
                $statusCode = $_.Exception.Response.StatusCode.value__
                Write-Host "HTTP Status: $statusCode"
            }
        }
    } else {
        Write-Host "❌ Token no disponible." -ForegroundColor Yellow
    }
    Write-Host ""
}

# Menú principal
Write-Host "=== PRUEBA DE ENDPOINTS DE USUARIOS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Instrucciones:" -ForegroundColor White
Write-Host "1. Primero necesitas obtener un token JWT válido" -ForegroundColor Yellow
Write-Host "2. Puedes obtenerlo mediante:" -ForegroundColor Yellow
Write-Host "   - Registro: POST /pina/auth/register" -ForegroundColor Gray
Write-Host "   - Login: POST /pina/auth/login" -ForegroundColor Gray
Write-Host "   - OAuth: GET /pina/auth/google" -ForegroundColor Gray
Write-Host ""

# Si no hay token, pedir uno
if (-not $TOKEN) {
    Write-Host "¿Tienes un token JWT? (s/n): " -NoNewline -ForegroundColor Green
    $respuesta = Read-Host
    
    if ($respuesta -eq "s" -or $respuesta -eq "S") {
        $TOKEN = Read-Host "Ingresa el token JWT"
    } else {
        Write-Host "Por favor obtén un token primero y luego ejecuta este script nuevamente." -ForegroundColor Red
        exit 1
    }
}

# Menú de opciones
Write-Host ""
Write-Host "Selecciona una opción:" -ForegroundColor Cyan
Write-Host "1. Probar GET /users/profile" -ForegroundColor White
Write-Host "2. Probar PATCH /users/profile (actualización válida)" -ForegroundColor White
Write-Host "3. Probar PATCH con slug inválido" -ForegroundColor White
Write-Host "4. Probar PATCH con bio muy larga" -ForegroundColor White
Write-Host "5. Salir" -ForegroundColor White
Write-Host ""

$opcion = Read-Host "Ingresa tu opción (1-5)"

switch ($opcion) {
    "1" { Test-GetProfile }
    "2" { Test-UpdateProfile }
    "3" { Test-InvalidSlug }
    "4" { Test-LongBio }
    "5" { Write-Host "Saliendo..." -ForegroundColor Green; exit 0 }
    default { Write-Host "Opción inválida" -ForegroundColor Red; exit 1 }
}