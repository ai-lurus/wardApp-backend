import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRoutes } from "./routes/auth.routes";
import { materialRoutes } from "./routes/material.routes";
import { inventoryRoutes } from "./routes/inventory.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { userRoutes } from "./routes/user.routes";
import { warehouseRoutes } from "./routes/warehouse.routes";
import { adminRoutes } from "./routes/admin.routes";
import { billingRoutes } from "./routes/billing.routes";
import { uploadRoutes } from "./routes/upload.routes";
import { unitRoutes } from "./routes/unit.routes";

const app = express();

// Middleware
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(","),
    credentials: true,
  })
);

// Stripe webhook needs raw body
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/units", unitRoutes);

// Error handler
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
