import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AuthController } from "../src/controllers/authController";
import { UserController } from "../src/controllers/userController";
import { appService } from "../src/services/appService";

describe("Auth Service API Tests", () => {
  let app: OpenAPIHono;

  beforeAll(() => {
    app = new OpenAPIHono();
    AuthController.registerRoutes(app);
    UserController.registerRoutes(app);
  });

  describe("Auth Endpoints", () => {
    it("should handle login successfully", async () => {
      const mockLoginData = {
        username: "testuser",
        password: "testpass",
      };

      const response = await app.request("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockLoginData),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("authDetails");
      expect(data.authDetails).toHaveProperty("access_token");
    });

    it("should validate token successfully", async () => {
      const mockToken = "valid-token";

      const response = await app.request("/auth/validate", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("userInfo");
    });

    it("should handle logout successfully", async () => {
      const mockToken = "valid-token";

      const response = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe("User Endpoints", () => {
    it("should create user successfully", async () => {
      const mockUserData = {
        username: "newuser",
        email: "newuser@example.com",
        password: "password123",
      };

      const response = await app.request("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockUserData),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty("id");
    });

    it("should get user successfully", async () => {
      const userId = "test-user-id";

      const response = await app.request(`/users/${userId}`, {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("username");
      expect(data).toHaveProperty("email");
    });

    it("should update user successfully", async () => {
      const userId = "test-user-id";
      const mockUpdateData = {
        email: "updated@example.com",
      };

      const response = await app.request(`/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockUpdateData),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("id");
    });

    it("should delete user successfully", async () => {
      const userId = "test-user-id";

      const response = await app.request(`/users/${userId}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(200);
    });
  });
});
