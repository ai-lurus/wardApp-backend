# wardApp Backend

SaaS API para gestión de inventarios y logística.
Built with **Node.js 20**, **Express**, **TypeScript**, **Prisma**, and **PostgreSQL**.

## Prerequisites

Before starting, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (version 20 or higher recommended).
- [PostgreSQL](https://www.postgresql.org/) (running locally or via Docker).
- **npm** (comes with Node.js).

## Local Development Setup

Follow these steps to set up your local development environment.

### 1. Install Dependencies

Open a terminal in this folder and run:

```bash
npm install
```

### 2. Configure Environment Variables

The project requires a `.env` file for configuration. Create a copy from the example file:

```bash
cp .env.example .env
```
*(On Windows using PowerShell, you can run `Copy-Item .env.example .env`)*

Open the new `.env` file in your editor. You need to update the `DATABASE_URL` variable with your local PostgreSQL server credentials. For example:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/wardapp?schema=public"
```
*Make sure the `wardapp` database exists in your Postgres server, or replace the database name with one you have already created.*

### 3. Start PostgreSQL using Docker (Optional)

If you don't have PostgreSQL installed locally, you can easily spin up a database instance using Docker. Run the following command:

```bash
docker run --name wardapp-postgres -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=wardapp -p 5432:5432 -d postgres
```

*This command creates a background PostgreSQL container with the exact credentials recommended in the `.env.example` file.*

### 4. Migrate the Database

With your PostgreSQL database running and the `.env` correctly pointing to it, run the following command to create the required tables defined in the Prisma schema:

```bash
npm run db:migrate
```

### 5. Seed the Database (Optional)

You can populate the database with initial seed data to aid in development testing:

```bash
# To insert base dummy data
npm run db:seed

# To create a Super Admin user
npm run seed:super-admin
```

### 6. Start the Development Server

Once the database is ready, you can start the project build in watch mode (it automatically reloads on code changes):

```bash
npm run dev
```

The server will be listening by default at [http://localhost:3001](http://localhost:3001).

---

## Available Scripts

The following key commands are configured in the `package.json` file:

- `npm run dev` : Starts the development server using `tsx` to compile TypeScript on the fly.
- `npm run build` : Transpiles the project and generates the Prisma client for production.
- `npm start` : Starts the compiled server in production mode (requires running build first).
- `npm run db:studio` : Opens [Prisma Studio](https://www.prisma.io/studio) in your browser, a visual interface to explore and manipulate your database records.
- `npm run db:migrate` : Synchronizes your PostgreSQL schema with the Prisma schema file.
- `npm run test:isolation` : Runs the end-to-end multi-tenant isolation tests. See **Testing** below.

---

## Testing

The backend includes automated integration and E2E tests focusing on tenant isolation:
- `npm run test:isolation` requires a separate local testing database.

**Setup Test DB:**
1. Create a `.env.test` file (it is already tracked/provided with default values).
2. Create your `ward_test_db` locally via `psql` or docker.
3. Push your Prisma schema to your test db: `DATABASE_URL="postgresql://user:pass@localhost:5432/ward_test_db" npx prisma db push --accept-data-loss`
4. Run tests:
```bash
npm run test:isolation
```
Tests isolate all mocked data into their own DB separate from your development data.
---

## Configuración de Entorno

Este proyecto utiliza `dotenv` para cargar variables de entorno y `zod` para validarlas en tiempo de ejecución.

### Variables Críticas:
- `NODE_ENV`: Define el comportamiento del servidor (`development`, `staging`, `production`).
- `JWT_SECRET`: En producción/staging, el servidor **no iniciará** si se detecta el valor por defecto de desarrollo. Debe ser una cadena aleatoria segura.
- `DATABASE_URL`: Connection string de PostgreSQL.

### Guía de Ambientes:

| Variable | Local (Dev) | Staging | Producción |
|----------|-------------|---------|------------|
| `NODE_ENV` | `development` | `staging` | `production` |
| `PORT` | `3001` | Según host | Según host |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | URL Staging Frontend | URL Producción Frontend |

### Mantenimiento de Configuración:
La validación se encuentra en `src/config/env.ts`. Si necesitas agregar una nueva variable, agrégala al esquema de `zod` en ese archivo para garantizar que el servidor siempre cuente con los datos necesarios para operar de forma segura.
