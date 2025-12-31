import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { loginHandler } from "../src/route-handlers/authRouteHandlers";
import { Context } from "hono";
import appService from "../src/services/appService";

vi.mock("../src/services/appService");
vi.mock("../src/utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Auth Controller", () => {
  let context: Context;

  beforeEach(() => {
    context = {
      req: {
        parseBody: vi
          .fn()
          .mockResolvedValue({ username: "testuser", password: "testpass" }),
      },
      json: vi.fn(),
    } as unknown as Context;
  });

  it("should return token on successful login", async () => {
    (appService.login as Mock).mockResolvedValue({
      access_token: "fake-token",
    });

    await loginHandler(context);

    expect(context.json).toHaveBeenCalledWith(
      {
        authDetails: { access_token: "fake-token" },
      },
      200
    );
  });

  it("should return error on failed login", async () => {
    (appService.login as Mock).mockRejectedValue(
      new Error("Failed to get token from Keycloak")
    );

    await loginHandler(context);

    expect(context.json).toHaveBeenCalledWith(
      { message: "Internal server error", code: 500 },
      500
    );
  });

  it("should return unauthorized error on invalid credentials", async () => {
    (appService.login as Mock).mockRejectedValue(
      new Error("Unauthorized: Invalid username or password")
    );

    await loginHandler(context);

    expect(context.json).toHaveBeenCalledWith(
      { message: "Unauthorized: Invalid username or password", code: 401 },
      401
    );
  });

  it("should validate request body", async () => {
    context.req.parseBody = vi
      .fn()
      .mockResolvedValue({ username: "usr", password: "pwd" });

    await loginHandler(context);

    expect(context.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.any(Array),
        code: 400,
      }),
      400
    );
  });

  it("should prevent operators from logging in via web", async () => {
    context.req.header = vi.fn().mockImplementation((headerName) => {
      if (headerName === "device-type") return "web";
      return undefined;
    });

    (appService.login as Mock).mockRejectedValue({
      message: "auth.allowed_mobile",
      statusCode: 403,
    });

    await loginHandler(context);

    expect(context.json).toHaveBeenCalledWith(
      { message: "Operators can only login from mobile devices", code: 403 },
      403
    );
  });
});
