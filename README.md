# 📦 PINA Backend

Backend del proyecto **PINA**, construido con [NestJS](https://nestjs.com/), [Prisma](https://www.prisma.io/) como ORM y [PostgreSQL](https://www.postgresql.org/) en entorno Docker para facilitar el desarrollo colaborativo y consistente.

---

## 🚀 Requisitos

- [Node.js](https://nodejs.org/) v18+ (recomendado)
- [Yarn](https://classic.yarnpkg.com/en/) v1.22+
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

---

## ⚙️ Instalación del proyecto

```bash
git clone https://github.com/tu-usuario/pina-backend.git
cd pina-backend
yarn install
```

# 🐘 Base de datos con Docker

Este proyecto usa **PostgreSQL** vía **Docker**.

## 🔧 Levantar la base de datos

```bash
yarn db:up
```

Esto utiliza docker-compose.yml para levantar un contenedor con PostgreSQL 15 en localhost:5432.

## 🔌 Conexión

La conexión se define en el archivo `.env`:

```bash
DATABASE_URL="postgresql://postgres:*****s@localhost:5432/pina_dev"
```

## 🧬 Ejecutar migraciones

```bash
yarn migrate
```

## 📜 Comandos disponibles

| Comando            | Descripción                                 |
| ------------------ | ------------------------------------------- |
| `yarn start`       | Inicia la app en modo producción (`dist/`)  |
| `yarn start:dev`   | Inicia el servidor en modo desarrollo       |
| `yarn start:debug` | Inicia en modo debug (útil para VSCode)     |
| `yarn build`       | Compila el proyecto en `/dist`              |
| `yarn format`      | Formatea el código con Prettier             |
| `yarn lint`        | Lint con ESLint y autofix                   |
| `yarn test`        | Ejecuta los tests unitarios                 |
| `yarn test:watch`  | Ejecuta los tests en modo watcher           |
| `yarn test:cov`    | Reporte de cobertura con Jest               |
| `yarn test:e2e`    | Ejecuta los tests end-to-end                |
| `yarn db:up`       | Levanta la base PostgreSQL en Docker        |
| `yarn db:down`     | Apaga y elimina el contenedor de PostgreSQL |
| `yarn migrate`     | Aplica migraciones de Prisma                |

## 🧪 Testing

Este proyecto usa Jest para pruebas unitarias y e2e.

- Archivos de prueba terminan en .spec.ts

- Las pruebas e2e están ubicadas en test/
