import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as materialService from "../services/material.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { registry } from "../lib/openapi";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("inventario"));

// Schemas para OpenAPI
const CategorySchema = registry.register(
  "Category",
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    company_id: z.string().uuid(),
  })
);

const MaterialSchema = registry.register(
  "Material",
  z.object({
    id: z.string().uuid(),
    sku: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    unit: z.string().nullable(),
    reference_price: z.number().nullable(),
    min_stock: z.number(),
    current_stock: z.number(),
    active: z.boolean(),
    category_id: z.string().uuid(),
    location: z.string().nullable(),
    image_url: z.string().nullable(),
    zone_id: z.string().uuid().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
);

// Documentación de rutas
registry.registerPath({
  method: "get",
  path: "/materials/categories",
  summary: "Listar categorías de materiales",
  tags: ["Materials"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Lista de categorías",
      content: { "application/json": { schema: z.array(CategorySchema) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/materials/categories",
  summary: "Crear una nueva categoría",
  tags: ["Materials"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1),
            description: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Categoría creada",
      content: { "application/json": { schema: CategorySchema } },
    },
  },
});

// GET /api/materials/categories
router.get(
  "/categories",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await materialService.listCategories(req.user!.companyId);
      res.json(categories);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/materials/categories
const createCategorySchema = z.object({
  name: z.string().min(1, "El nombre de la categoría es requerido"),
  description: z.string().optional(),
});

router.post(
  "/categories",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createCategorySchema.parse(req.body);
      const category = await materialService.createCategory(
        req.user!.companyId,
        body.name,
        body.description
      );
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

// PUT /api/materials/categories/:id
const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

router.put(
  "/categories/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateCategorySchema.parse(req.body);
      const category = await materialService.updateCategory(
        req.params.id,
        req.user!.companyId,
        body.name,
        body.description
      );
      res.json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

// DELETE /api/materials/categories/:id
router.delete(
  "/categories/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await materialService.deleteCategory(req.params.id, req.user!.companyId);
      res.json({ message: "Category deleted" });
    } catch (err) {
      next(err);
    }
  }
);

registry.registerPath({
  method: "get",
  path: "/materials",
  summary: "Listar materiales con filtros",
  tags: ["Materials"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      category_id: z.string().uuid().optional(),
      active: z.string().optional(),
      search: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Lista de materiales paginada",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(MaterialSchema),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
  },
});

// GET /api/materials
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category_id, active, search, page, limit } = req.query;
      const result = await materialService.listMaterials({
        companyId: req.user!.companyId,
        category_id: category_id as string,
        active: active !== undefined ? active === "true" : undefined,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

registry.registerPath({
  method: "get",
  path: "/materials/{id}",
  summary: "Obtener detalle de un material",
  tags: ["Materials"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Detalle del material",
      content: { "application/json": { schema: MaterialSchema } },
    },
    404: { description: "Material no encontrado" },
  },
});

// GET /api/materials/:id
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const material = await materialService.getMaterial(req.params.id, req.user!.companyId);
      res.json(material);
    } catch (err) {
      next(err);
    }
  }
);


registry.registerPath({
  method: "post",
  path: "/materials",
  summary: "Crear un nuevo material",
  tags: ["Materials"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1),
            sku: z.string().optional(),
            location: z.string().optional(),
            zone_id: z.string().uuid().nullable().optional(),
            category_id: z.string().uuid(),
            unit: z.string().optional(),
            reference_price: z.number().optional(),
            min_stock: z.number().optional(),
            current_stock: z.number().optional(),
            image_url: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Material creado",
      content: { "application/json": { schema: MaterialSchema } },
    },
  },
});

// POST /api/materials
const createMaterialSchema = z.object({
  name: z.string().min(1, "El nombre del material es requerido"),
  sku: z.string().max(20).optional(),
  location: z.string().optional(),
  zone_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().min(1, "El ID de la categoría es requerido"),
  unit: z.string().optional(),
  reference_price: z.number().positive().optional(),
  min_stock: z.number().int().min(0).optional(),
  current_stock: z.number().int().min(0).optional(),
  image_url: z.string().optional(),
});

router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createMaterialSchema.parse(req.body);
      const material = await materialService.createMaterial({
        companyId: req.user!.companyId,
        ...body,
      });
      res.status(201).json(material);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

registry.registerPath({
  method: "put",
  path: "/materials/{id}",
  summary: "Actualizar un material",
  tags: ["Materials"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional(),
            sku: z.string().optional(),
            location: z.string().optional(),
            zone_id: z.string().uuid().nullable().optional(),
            category_id: z.string().uuid().optional(),
            unit: z.string().optional(),
            reference_price: z.number().optional(),
            min_stock: z.number().optional(),
            active: z.boolean().optional(),
            image_url: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Material actualizado",
      content: { "application/json": { schema: MaterialSchema } },
    },
  },
});

// PUT /api/materials/:id
const updateMaterialSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().max(20).optional(),
  location: z.string().optional(),
  zone_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().optional(),
  unit: z.string().optional(),
  reference_price: z.number().positive().optional(),
  min_stock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  image_url: z.string().optional(),
});

router.put(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateMaterialSchema.parse(req.body);
      const material = await materialService.updateMaterial(
        req.params.id,
        req.user!.companyId,
        body
      );
      res.json(material);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

registry.registerPath({
  method: "delete",
  path: "/materials/{id}",
  summary: "Desactivar un material",
  tags: ["Materials"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Material desactivado con éxito",
      content: { "application/json": { schema: z.object({ message: z.string() }) } },
    },
  },
});

export { router as materialRoutes };
