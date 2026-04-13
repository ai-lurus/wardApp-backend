import { Router } from "express";
import multer from "multer";
import { UploadService } from "../services/upload.service";
import { authMiddleware } from "../middleware/auth";
import { registry } from "../lib/openapi";
import { z } from "zod";

const router = Router();

// Configure multer to store files in memory
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        // Limit file size to 10MB
        fileSize: 10 * 1024 * 1024,
    },
});

registry.registerPath({
  method: "post",
  path: "/upload",
  summary: "Subir un archivo al almacenamiento (Cloud Storage)",
  tags: ["Upload"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.any().openapi({ type: "string", format: "binary" }),
            folder: z.string().optional().openapi({ example: "materials" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Archivo subido exitosamente",
      content: { "application/json": { schema: z.object({ url: z.string() }) } },
    },
  },
});
router.post("/", authMiddleware, upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        const folder = req.body.folder || "general";
        const filePath = await UploadService.uploadImage(req.file, folder);

        res.json({ url: filePath });
    } catch (error) {
        next(error);
    }
});

registry.registerPath({
  method: "get",
  path: "/upload/url",
  summary: "Obtener URL firmada para un archivo",
  tags: ["Upload"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      path: z.string().openapi({ description: "Ruta del archivo en el bucket" }),
    }),
  },
  responses: {
    200: {
      description: "URL firmada temporal",
      content: { "application/json": { schema: z.object({ url: z.string() }) } },
    },
  },
});
router.get("/url", authMiddleware, async (req, res, next) => {
    try {
        const path = req.query.path as string;
        if (!path) {
            res.status(400).json({ error: "No path provided" });
            return;
        }

        // Generate signed url valid for 2 hours
        const signedUrl = await UploadService.getSignedUrl(path, 120);
        res.json({ url: signedUrl });
    } catch (error) {
        next(error);
    }
});

export const uploadRoutes = router;
