import { Router } from "express";
import { z, ZodError } from "zod";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { prisma, withTenant } from "../lib/prisma";
import { runStream } from "../services/warden/stream.service";
import { list } from "../services/warden/tools/registry";
import {
  listConversations,
  getConversationDetail,
} from "../services/warden/conversations.service";

// Side-effect import — triggers register() calls for all 5 tool files.
// Must appear before any request reaches the tool registry.
import "../services/warden/tools/index";

const router = Router();

router.use(authMiddleware);
router.use(checkModuleAccess("warden"));

const PostMessageSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  text: z.string().min(1).max(16000),
  moduleHint: z.string().optional(),
});

/**
 * POST /api/warden/messages
 *
 * Opens an SSE stream for a Warden turn. Creates a new conversation when
 * `conversationId` is absent. Compression middleware must be disabled on
 * this route — gzip breaks event-stream framing.
 */
router.post("/messages", async (req, res, next) => {
  let body: z.infer<typeof PostMessageSchema>;
  try {
    body = PostMessageSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          code: "WARDEN_VALIDATION",
          message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
      });
      return;
    }
    next(err);
    return;
  }

  try {
    const { companyId, userId } = req.user!;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { active_modules: true },
    });
    const activeModules: string[] = company?.active_modules ?? [];

    await runStream({
      req,
      res,
      companyId,
      userId,
      conversationId: body.conversationId ?? null,
      text: body.text,
      moduleHint: body.moduleHint,
      activeModules,
    });
  } catch (err) {
    if (!res.headersSent) next(err);
    // If SSE headers were already sent, runStream handled the error internally.
  }
});

/**
 * GET /api/warden/tools
 *
 * Returns the list of tools visible to this tenant, filtered by active
 * modules. Used by the frontend to surface available capabilities.
 */
router.get("/tools", async (req, res, next) => {
  try {
    const { companyId } = req.user!;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { active_modules: true },
    });
    const activeModules: string[] = company?.active_modules ?? [];

    const tools = list({ activeModules });
    res.json({
      tools: tools.map((t) => ({
        name: t.name,
        module: t.module,
        description: t.description,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/warden/conversations
 *
 * Lists conversations for the authenticated tenant, newest first.
 * Supports cursor-based pagination via ?cursor=<id>&limit=<n>.
 */
router.get("/conversations", async (req, res, next) => {
  try {
    const { companyId } = req.user!;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;
    const result = await withTenant(companyId, (tx) =>
      listConversations(tx, { companyId, limit, cursor })
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/warden/conversations/:id
 *
 * Returns a single conversation with all its messages and cards.
 */
router.get("/conversations/:id", async (req, res, next) => {
  try {
    const { companyId } = req.user!;
    const conversation = await withTenant(companyId, (tx) =>
      getConversationDetail(tx, { conversationId: req.params.id, companyId })
    );
    if (!conversation) {
      res.status(404).json({
        error: { code: "WARDEN_NOT_FOUND", message: "Conversación no encontrada." },
      });
      return;
    }
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

export const wardenRoutes = router;
