# wardApp Backend

SaaS API para gestión de inventarios y logística.

## Configuración de Entorno

Este proyecto utiliza `dotenv` para cargar variables de entorno y `zod` para validarlas en tiempo de ejecución.

### Configuración Local:
1. Copia el archivo `.env.example` a uno nuevo llamado `.env`.
2. Completa los valores necesarios, especialmente `DATABASE_URL` y las llaves de servicios externos si los necesitas.
3. Asegúrate de que `ALLOWED_ORIGINS` incluya la URL de tu frontend local (normalmente `http://localhost:3000`).

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
