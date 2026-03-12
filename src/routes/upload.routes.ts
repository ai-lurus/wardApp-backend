import { Router } from "express";
import multer from "multer";
import { UploadService } from "../services/upload.service";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Configure multer to store files in memory
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        // Limit file size to 10MB
        fileSize: 10 * 1024 * 1024,
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
