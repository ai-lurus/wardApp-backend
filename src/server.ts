import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import swaggerUi from "swagger-ui-express";
import { generateSwaggerSpec } from "./config/swagger";
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
import { wardenRoutes } from "./routes/warden.routes";
import { operatorRoutes } from "./routes/operator.routes";
import { tollboothRoutes } from "./routes/tollbooth.routes";
import { routeRoutes } from "./routes/route.routes";

console.log("ENV CHECK:", {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL
});

const app = express();

// Middleware
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  })
);

app.options("*", cors({
  origin: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
  credentials: true,
}));

// Stripe webhook needs raw body
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Swagger Documentation
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(generateSwaggerSpec()));

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
app.use("/api/warden", wardenRoutes);
app.use("/api/operators", operatorRoutes);
app.use("/api/tollbooths", tollboothRoutes);
app.use("/api/routes", routeRoutes);

// Error handler
app.use(errorHandler);

// In local dev, start the server. In Vercel, export the app instead.
if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "test") {
  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
}

export default app;
