import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";

// Warden routes — mounts conversation CRUD and SSE stream endpoints.
// Contract: specs/001-warden-foundations/contracts/warden-sse.md +
// contracts/warden-api.md. Concrete endpoints land in T041 (SSE
// `POST /messages`), T042 (`GET /tools`), and T064–T066 (conversation
// CRUD for US2). The gating order is fixed across every route mounted
// here: `authMiddleware` → `checkModuleAccess('warden')`, so an
// unauthenticated caller short-circuits before we hit Prisma, and a
// caller without the `warden` module gets `WARDEN_MODULE_DISABLED` via
// `tenant.ts` before any handler runs.
//
// NOTE for T041: compression middleware MUST be disabled on the SSE
// route — gzip breaks event-stream framing. Either mount compression
// with a filter that skips `text/event-stream` or attach it per-route
// after this router.

const router = Router();

router.use(authMiddleware);
router.use(checkModuleAccess("warden"));

// Handlers are registered by later tasks — keeping this file minimal
// so T022 only wires the mount point and its gates.

export const wardenRoutes = router;
