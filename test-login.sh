#!/bin/bash

echo "=== PRUEBA DE LOGIN PARA OBTENER TOKEN ==="
echo ""

# Variables
BASE_URL="http://localhost:3000/pina"

# Intentar login con credenciales de prueba
echo "Intentando login con credenciales de prueba..."
curl -X POST "$BASE_URL/auth/login" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "password123"
     }' \
     -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "Si el login falla, puedes probar con el registro:"
echo "curl -X POST $BASE_URL/auth/register \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{"
echo "       \"fullName\": \"Usuario Prueba\","
echo "       \"email\": \"test@example.com\","
echo "       \"password\": \"password123\","
echo "       \"birthDate\": \"1990-01-01\""
echo "     }'"