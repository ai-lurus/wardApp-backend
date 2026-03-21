# Ward.io Backend — Contexto para IA

## Qué es este repo
Backend del SaaS multitenant Ward.io para empresas de transporte de carga.
Stack: **Node.js 20 + Express + TypeScript + Prisma + PostgreSQL**.

---

## REGLAS CRÍTICAS — Léelas antes de tocar cualquier cosa

### 1. TODA query de negocio va dentro de `withTenant()`

```typescript
// CORRECTO
import { withTenant } from '../lib/prisma';

const materials = await withTenant(req.user.companyId, (tx) =>
  tx.material.findMany({ where: { company_id: req.user.companyId } })
);

// INCORRECTO — Rompe el aislamiento de tenants (bug de seguridad crítico)
const materials = await prisma.material.findMany({ ... });
```

El helper `withTenant` está en `src/lib/prisma.ts`. Hace dos cosas:
1. Abre una transacción
2. Ejecuta `SET LOCAL app.current_company_id = companyId` para activar RLS en Postgres

Sin él, RLS devuelve 0 filas (fail-closed) o —peor— datos de otro tenant.

**Excepciones (sin `withTenant`):** queries a la tabla `companies` desde rutas `/api/admin/*` con rol `super_admin`.

---

### 2. NUNCA hardcodear `company_id`

```typescript
// CORRECTO — siempre del JWT
const companyId = req.user.companyId;

// INCORRECTO — hardcoded
const companyId = 'algún-uuid-fijo';
```

El middleware `src/middleware/auth.ts` valida el JWT y pone `req.user.companyId`. Úsalo siempre.

---

### 3. Toda nueva tabla de negocio necesita RLS en la migración

Cada migración que crea una tabla con datos por tenant DEBE incluir:

```sql
ALTER TABLE "nueva_tabla" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "nueva_tabla"
  USING (company_id::text = current_setting('app.current_company_id', true));
```

Ver migraciones `20260309000000` y `20260309000001` como referencia exacta.

---

### 4. Módulos dinámicos — usar `checkModuleAccess` middleware

Antes de exponer un endpoint de un módulo, verificar que el tenant lo tiene activo:

```typescript
import { checkModuleAccess } from '../middleware/tenant';

router.get('/inventory/stock', auth, checkModuleAccess('inventory'), handler);
```

No exponer endpoints de módulo sin este middleware.

---

## Stack y Herramientas

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 |
| Framework | Express |
| Lenguaje | **TypeScript** (no JS) |
| ORM | Prisma |
| BD | PostgreSQL |
| Auth | JWT (`jsonwebtoken`) |
| Validación | **Zod** (no Joi, no express-validator) |
| Email | Resend |
| Pagos | Stripe |

---

## Estructura del proyecto

```
src/
├── config/          # Variables de entorno y configuración
├── lib/
│   └── prisma.ts    # PrismaClient + withTenant() — NO MODIFICAR sin revisión
├── middleware/
│   ├── auth.ts      # Valida JWT → req.user (companyId, role, userId)
│   ├── role.ts      # requireRole('admin' | 'super_admin' | ...)
│   ├── tenant.ts    # checkModuleAccess(moduleName)
│   └── errorHandler.ts
├── routes/          # Un archivo por recurso
├── services/        # Lógica de negocio
└── server.ts        # Entry point
```

---

## Patrones de código

### Estructura de un route handler

```typescript
// routes/material.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth';
import { checkModuleAccess } from '../middleware/tenant';
import { withTenant } from '../lib/prisma';

const router = Router();

const CreateMaterialSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  minStock: z.number().min(0),
});

router.post('/', auth, checkModuleAccess('inventory'), async (req, res, next) => {
  try {
    const data = CreateMaterialSchema.parse(req.body);
    const material = await withTenant(req.user.companyId, (tx) =>
      tx.material.create({
        data: { ...data, company_id: req.user.companyId },
      })
    );
    res.status(201).json({ success: true, data: material });
  } catch (err) {
    next(err);
  }
});
```

### Respuesta de API (formato estándar)

```typescript
// Éxito
res.json({ success: true, data: result });
res.json({ success: true, data: items, meta: { total, page, limit } });

// Error — el errorHandler lo hace automáticamente
next(new Error('Mensaje de error'));
```

### Validación — siempre Zod

```typescript
const Schema = z.object({ field: z.string() });
const parsed = Schema.parse(req.body); // lanza ZodError si falla
```

---

## Rutas existentes (MVP)

```
POST   /api/auth/login
GET    /api/auth/me

GET    /api/materials              → ?search, categoryId, active, page, limit
GET    /api/materials/:id
POST   /api/materials
PUT    /api/materials/:id
DELETE /api/materials/:id
GET    /api/materials/categories
POST   /api/materials/categories
PUT    /api/materials/categories/:id
DELETE /api/materials/categories/:id

POST   /api/inventory/entry
POST   /api/inventory/exit
GET    /api/inventory/movements    → ?type, materialId, page, limit
GET    /api/inventory/stock
GET    /api/inventory/alerts

GET    /api/dashboard/stats

GET    /api/admin/companies        → super_admin only
POST   /api/admin/companies
PATCH  /api/admin/companies/:id
```

---

## Convenciones

- Idioma de código: **inglés** (variables, funciones, nombres de archivo)
- UI-facing messages: **español**
- Commits: `feat(módulo): descripción` | `fix(módulo): descripción` | `chore: descripción`
- Rama principal: `main`
- **Code review obligatorio** para cambios en: `src/lib/prisma.ts`, `src/middleware/auth.ts`, queries a `companies`, cualquier nueva migración

---

## Lo que NO hacer

- No instalar nuevas librerías de validación (ya existe Zod)
- No usar `prisma.*` directo en routes para queries de negocio — pasar siempre por `withTenant`
- No crear rutas de admin sin `requireRole('super_admin')`
- No exponer stack traces en respuestas de error de producción
- No almacenar el `company_id` en ningún sitio que no sea el JWT
- No saltar el middleware `checkModuleAccess` en endpoints de módulos opcionales
