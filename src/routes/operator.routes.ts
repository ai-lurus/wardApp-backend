import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as operatorService from "../services/operator.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import multer from "multer";
import { UploadService } from "../services/upload.service";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("operaciones"));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const operatorStatusEnum = z.enum(["disponible", "en_viaje", "no_disponible", "inactivo"]);

const documentTypeEnum = z.enum(["ine", "contract", "license"]);

const licenseTypeEnum = z.enum(["A", "B", "C", "D", "E"]);

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

router.get("/alerts/expiring-documents", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await operatorService.getExpiringDocumentsAlerts(req.user!.companyId);
    res.json(alerts);
  } catch (err) {
    next(err);
  }
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

const uploadDocumentSchema = z.object({
  document_type: documentTypeEnum,
  expiry_date: z.string().pipe(z.coerce.date()).optional(),
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
