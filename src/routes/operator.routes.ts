import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as operatorService from "../services/operator.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { registry } from "../lib/openapi";
import multer from "multer";
import { UploadService } from "../services/upload.service";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("operaciones"));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Schemas para OpenAPI
const operatorStatusEnum = z.enum(["disponible", "en_viaje", "no_disponible", "inactivo"]).openapi("OperatorStatus");

const documentTypeEnum = z.enum(["ine", "contract", "license"]).openapi("OperatorDocumentType");

const licenseTypeEnum = z.enum(["A", "B", "C", "D", "E"]).openapi("OperatorLicenseType");

const OperatorDocumentSchema = registry.register(
  "OperatorDocument",
  z.object({
    id: z.string().uuid(),
    operator_id: z.string().uuid(),
    document_type: documentTypeEnum,
    file_url: z.string(),
    signed_url: z.string().nullable().optional(),
    expiry_date: z.date().nullable(),
    created_at: z.date(),
    created_by: z.string().uuid().nullable(),
  })
);

const OperatorSchema = registry.register(
  "Operator",
  z.object({
    id: z.string().uuid(),
    company_id: z.string().uuid(),
    name: z.string(),
    license_number: z.string(),
    license_type: licenseTypeEnum,
    license_expiry: z.date(),
    status: operatorStatusEnum,
    phone: z.string().nullable(),
    email: z.string().nullable(),
    created_at: z.date(),
    created_by: z.string().uuid().nullable(),
    updated_at: z.date(),
    documents: z.array(OperatorDocumentSchema).optional(),
  })
);

const idParamSchema = z.object({
  id: z.string().uuid("El ID debe ser un UUID válido"),
});

const getOperatorsQuerySchema = z.object({
  status: operatorStatusEnum.optional(),
  available_only: z.string().optional().transform((v) => v === "true"),
});

const createOperatorSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  license_number: z.string().min(1, "El número de licencia es requerido"),
  license_type: licenseTypeEnum,
  license_expiry: z.string().pipe(z.coerce.date()),
  status: operatorStatusEnum.optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

const updateOperatorSchema = createOperatorSchema.partial();

const updateStatusSchema = z.object({
  status: operatorStatusEnum,
});

const uploadDocumentSchema = z.object({
  document_type: documentTypeEnum,
  expiry_date: z.string().pipe(z.coerce.date()).optional(),
});

// Documentación de rutas
registry.registerPath({
  method: "get",
  path: "/operators/alerts/expiring-documents",
  summary: "Alertas de documentos por vencer",
  tags: ["Operators"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Lista de documentos de operadores que vencen en los próximos 30 días",
      content: {
        "application/json": {
          schema: z.array(OperatorDocumentSchema),
        },
      },
    },
  },
});

router.get("/alerts/expiring-documents", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await operatorService.getExpiringDocumentsAlerts(req.user!.companyId);
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

registry.registerPath({
  method: "get",
  path: "/operators",
  summary: "Listar operadores",
  tags: ["Operators"],
  security: [{ bearerAuth: [] }],
  request: {
    query: getOperatorsQuerySchema,
  },
  responses: {
    200: {
      description: "Lista de operadores",
      content: {
        "application/json": {
          schema: z.array(OperatorSchema),
        },
      },
    },
  },
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, available_only } = getOperatorsQuerySchema.parse(req.query);
    const operators = await operatorService.getOperators(req.user!.companyId, {
      status,
      available_only,
    });
    res.json(operators);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e: any) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/operators/{id}",
  summary: "Obtener detalle de operador",
  tags: ["Operators"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Detalle del operador con URLs de documentos",
      content: {
        "application/json": {
          schema: OperatorSchema,
        },
      },
    },
    404: { description: "Operador no encontrado" },
  },
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const operator = await operatorService.getOperatorById(req.user!.companyId, id);
    if (!operator) {
      throw new AppError(404, "Operador no encontrado");
    }

    // Convert file_url to signed urls
    const operatorWithUrls = {
      ...operator,
      documents: await Promise.all(operator.documents.map(async (doc) => {
        try {
          const url = await UploadService.getSignedUrl(doc.file_url);
          return { ...doc, signed_url: url };
        } catch (e) {
          return { ...doc, signed_url: null };
        }
      }))
    };

    res.json(operatorWithUrls);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e: any) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/operators",
  summary: "Crear operador",
  tags: ["Operators"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createOperatorSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Operador creado",
      content: {
        "application/json": {
          schema: OperatorSchema,
        },
      },
    },
  },
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createOperatorSchema.parse(req.body);
    const operator = await operatorService.createOperator(req.user!.companyId, body);
    res.status(201).json(operator);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e: any) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "put",
  path: "/operators/{id}",
  summary: "Actualizar operador",
  tags: ["Operators"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateOperatorSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Operador actualizado",
      content: {
        "application/json": {
          schema: OperatorSchema,
        },
      },
    },
  },
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateOperatorSchema.parse(req.body);
    const operator = await operatorService.updateOperator(req.user!.companyId, id, body);
    res.json(operator);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e: any) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/operators/{id}/status",
  summary: "Actualizar estatus de operador",
  tags: ["Operators"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Estatus actualizado",
      content: {
        "application/json": {
          schema: OperatorSchema,
        },
      },
    },
  },
});

router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { status } = updateStatusSchema.parse(req.body);
    const operator = await operatorService.updateOperatorStatus(req.user!.companyId, id, status);
    res.json(operator);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e: any) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/operators/{id}",
  summary: "Eliminar operador (Lógico)",
  tags: ["Operators"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
  },
  responses: {
    204: { description: "Operador eliminado" },
  },
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await operatorService.deleteOperator(req.user!.companyId, id);
    res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e: any) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/operators/{id}/documents",
  summary: "Subir documento de operador",
  tags: ["Operators"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            document_type: documentTypeEnum,
            expiry_date: z.string().optional(),
            file: z.string().openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Documento subido",
      content: {
        "application/json": {
          schema: OperatorDocumentSchema,
        },
      },
    },
  },
});

router.post("/:id/documents", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = uploadDocumentSchema.parse(req.body);

    if (!req.file) {
      throw new AppError(400, "No se proporcionó un archivo");
    }

    const fileUrl = await UploadService.uploadDocument(req.file, "operator_documents");

    const document = await operatorService.addDocument(req.user!.companyId, id, {
      document_type: body.document_type,
      file_url: fileUrl,
      expiry_date: body.expiry_date,
    });

    res.status(201).json(document);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e: any) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/operators/{id}/documents/{docId}",
  summary: "Eliminar documento de operador (Lógico)",
  tags: ["Operators"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
      docId: z.string().uuid(),
    }),
  },
  responses: {
    204: { description: "Documento eliminado" },
  },
});

router.delete("/:id/documents/:docId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { docId } = z.object({ docId: z.string().uuid() }).parse({ docId: req.params.docId });

    await operatorService.removeDocument(req.user!.companyId, id, docId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e: any) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

export { router as operatorRoutes };
