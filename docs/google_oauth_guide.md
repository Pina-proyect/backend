# Guía para Registrar la Aplicación en la Google Cloud Developer Console

Para habilitar el inicio de sesión y registro de un solo clic con Google en **Pina**, es necesario obtener las credenciales de OAuth 2.0 (Client ID y Client Secret) de Google Cloud. A continuación, se detallan los pasos necesarios:

---

## Paso 1: Crear un Proyecto en Google Cloud Console

1.  Ingresa a la [Consola de Google Cloud Console](https://console.cloud.google.com/).
2.  Inicia sesión con tu cuenta de Google.
3.  En la esquina superior izquierda, junto al logo de Google Cloud, haz clic en el menú desplegable de proyectos y selecciona **"New Project" (Nuevo Proyecto)**.
4.  Asigna un nombre al proyecto (ej. `Pina App`) y haz clic en **"Create" (Crear)**.

---

## Paso 2: Configurar la Pantalla de Consentimiento de OAuth (OAuth Consent Screen)

Antes de crear las credenciales, Google requiere definir la información que verán los usuarios al autorizar su cuenta.

1.  En el menú lateral izquierdo, ve a **APIs & Services (APIs y servicios)** > **OAuth consent screen (Pantalla de consentimiento de OAuth)**.
2.  Selecciona el tipo de usuario **External (Externo)** y haz clic en **Create**.
3.  Completa los campos obligatorios de la aplicación:
    *   **App name (Nombre de la aplicación)**: `Pina`
    *   **User support email (Correo de asistencia del usuario)**: Selecciona tu correo electrónico.
    *   **Developer contact information (Información de contacto del desarrollador)**: Escribe tu correo electrónico.
4.  Haz clic en **Save and Continue (Guardar y continuar)**.
5.  En la sección de **Scopes (Permisos)**, haz clic en **Add or Remove Scopes** y selecciona:
    *   `.../auth/userinfo.email` (Para obtener el correo del usuario).
    *   `.../auth/userinfo.profile` (Para obtener el nombre completo y la foto de perfil).
6.  Haz clic en **Save and Continue**.
7.  En **Test Users (Usuarios de prueba)**, añade tu propio correo electrónico y los correos que usarás para hacer pruebas. (En el estado "Testing", solo estos usuarios podrán iniciar sesión).
8.  Haz clic en **Save and Continue** y luego en **Back to Dashboard**.

---

## Paso 3: Crear las Credenciales OAuth 2.0

1.  En el menú lateral izquierdo, haz clic en **Credentials (Credenciales)**.
2.  Haz clic en el botón superior **+ Create Credentials (+ Crear credenciales)** y selecciona **OAuth client ID (ID de cliente de OAuth)**.
3.  En **Application type (Tipo de aplicación)**, selecciona **Web application (Aplicación web)**.
4.  Asigna un nombre descriptivo (ej. `Pina Web Client`).
5.  En **Authorized JavaScript origins (Orígenes de JavaScript autorizados)**, añade las URL donde corre el frontend:
    *   `http://localhost:3000`
    *   `http://localhost:4011`
6.  En **Authorized redirect URIs (URI de redirección autorizados)**, añade el endpoint de callback de tu backend local (que redirecciona las peticiones):
    *   `http://localhost:4000/pina/auth/google/callback`
    *   Si usas proxies del front, añade también: `http://localhost:4011/api/pina/auth/google/callback`
7.  Haz clic en **Create (Crear)**.
8.  Aparecerá un modal con tu **Client ID** y **Client Secret**. Cópialos de inmediato.

---

## Paso 4: Configurar los Archivos de Entorno (.env)

Abre tu editor y configura las variables correspondientes en los proyectos:

### En el Backend (`backend-nest/.env`):
```bash
GOOGLE_CLIENT_ID="TU_CLIENT_ID_COPIADO"
GOOGLE_CLIENT_SECRET="TU_CLIENT_SECRET_COPIADO"
GOOGLE_CALLBACK_URL="http://localhost:4000/pina/auth/google/callback"
```

### En el Frontend (`frontend-next/.env.local`):
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID="TU_CLIENT_ID_COPIADO"
```

Una vez configuradas estas variables, reinicia los servidores de desarrollo local (`yarn start:dev` y `yarn dev`) para aplicar los cambios y habilitar el login con un solo clic.
