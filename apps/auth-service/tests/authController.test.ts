import { describe, it, expect, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AuthController } from "../src/controllers/authController";
import { loginRoute } from "../src/routes/authRoutes";
import { loginHandler } from "../src/route-handlers/authRouteHandlers";

describe("AuthController", () => {
  it("should register login route", async () => {
    const app = { openapi: vi.fn() } as unknown as OpenAPIHono;
    AuthController.registerRoutes(app);
    expect(app.openapi).toHaveBeenCalledTimes(1);
    expect(app.openapi).toHaveBeenCalledWith(loginRoute, loginHandler);
  });
});
