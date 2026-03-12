#!/bin/bash

echo "=== PRUEBA DE ENDPOINTS DE USUARIOS ==="
echo ""

# Variables
BASE_URL="http://localhost:3000/pina"
TOKEN="" # Se actualizará después de obtener un token válido

echo "1. Primero necesitamos obtener un token JWT válido"
echo "   Opción A: Registro de usuario"
echo "   Opción B: Login con usuario existente"
echo "   Opción C: OAuth con Google"
echo ""

# Función para probar GET /users/profile
test_get_profile() {
    echo "=== Probando GET /users/profile ==="
    if [ -n "$TOKEN" ]; then
        curl -X GET "$BASE_URL/users/profile" \
             -H "Authorization: Bearer $TOKEN" \
             -H "Content-Type: application/json" \
             -w "\nHTTP Status: %{http_code}\n"
    else
        echo "❌ Token no disponible. Por favor obtén un token primero."
    fi
    echo ""
}

# Función para probar PATCH /users/profile
test_update_profile() {
    echo "=== Probando PATCH /users/profile ==="
    if [ -n "$TOKEN" ]; then
        curl -X PATCH "$BASE_URL/users/profile" \
             -H "Authorization: Bearer $TOKEN" \
             -H "Content-Type: application/json" \
             -d '{
               "slug": "usuario-test-123",
               "bio": "Biografía de prueba con validación",
               "fullName": "Usuario de Prueba",
               "phone": "+1234567890"
             }' \
             -w "\nHTTP Status: %{http_code}\n"
    else
        echo "❌ Token no disponible. Por favor obtén un token primero."
    fi
    echo ""
}

# Función para probar actualización con slug inválido
test_invalid_slug() {
    echo "=== Probando PATCH /users/profile con slug inválido ==="
    if [ -n "$TOKEN" ]; then
        curl -X PATCH "$BASE_URL/users/profile" \
             -H "Authorization: Bearer $TOKEN" \
             -H "Content-Type: application/json" \
             -d '{
               "slug": "slug invalido con espacios!",
               "bio": "Biografía de prueba"
             }' \
             -w "\nHTTP Status: %{http_code}\n"
    else
        echo "❌ Token no disponible. Por favor obtén un token primero."
    fi
    echo ""
}

# Función para probar actualización con bio muy larga
test_long_bio() {
    echo "=== Probando PATCH /users/profile con bio muy larga ==="
    if [ -n "$TOKEN" ]; then
        curl -X PATCH "$BASE_URL/users/profile" \
             -H "Authorization: Bearer $TOKEN" \
             -H "Content-Type: application/json" \
             -d '{
               "bio": "Esta es una biografía extremadamente larga que excede el límite de 255 caracteres permitidos por el sistema. Estoy escribiendo mucho texto para probar que la validación funciona correctamente y rechaza este contenido por ser demasiado extenso para el campo bio."
             }' \
             -w "\nHTTP Status: %{http_code}\n"
    else
        echo "❌ Token no disponible. Por favor obtén un token primero."
    fi
    echo ""
}

# Menú de opciones
echo "Selecciona una opción:"
echo "1. Probar GET /users/profile (requiere token)"
echo "2. Probar PATCH /users/profile (requiere token)"
echo "3. Probar PATCH con slug inválido (requiere token)"
echo "4. Probar PATCH con bio muy larga (requiere token)"
echo "5. Salir"
echo ""

read -p "Ingresa tu opción (1-5): " opcion

case $opcion in
    1) test_get_profile ;;
    2) test_update_profile ;;
    3) test_invalid_slug ;;
    4) test_long_bio ;;
    5) echo "Saliendo..."; exit 0 ;;
    *) echo "Opción inválida"; exit 1 ;;
esac