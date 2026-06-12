import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { httpLogger } from "@smile-health/lib/logger";
import { RequestMiddleware } from "@smile-health/lib/middlewares";
import dotenv from "dotenv";
import { cors } from "hono/cors";
import { env } from "process";
import { AuthController } from "./controllers/authController";
import { UserController } from "./controllers/userController";
import { quickSetupService } from "@smile-health/lib/tracing-config";
import "./common/infrastructure/database";

dotenv.config();

const app = new OpenAPIHono();
const appPrefix = env.API_PREFIX ?? "";

quickSetupService("auth-service", app);
app.use(cors());
app.use(httpLogger);
app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

app.get("/", (c) => {
  return c.redirect(`${appPrefix}/ui`);
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// register middleware error message language
app.use("*", new RequestMiddleware().handle);

// Register routes from Controllers
AuthController.registerRoutes(app);
UserController.registerRoutes(app);

// The Swagger UI will be available at /ui
app.get(
  "/ui",
  swaggerUI({
    url: `${appPrefix}/doc`,
  }),
);

// The OpenAPI documentation will be available at /doc
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Auth Service API",
  },
  servers: [
    {
      url: `${appPrefix}`,
    },
  ],
});

const port: number = parseInt(process.env.PORT ?? "3000") || 3000;
console.log(`Auth Service is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
