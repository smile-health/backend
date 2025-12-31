import { describe, expect, test } from "bun:test";
import {
  BadRequestError,
  ForbiddenError,
  HTTPError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../error";

describe("Error Classes", () => {
  describe("HTTPError", () => {
    test("should create HTTP error with custom message and status code", () => {
      const error = new HTTPError("Custom Error", 500);
      expect(error.message).toBe("Custom Error");
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("HTTPError");
      expect(error.stack).toBeDefined();
    });
  });

  describe("BadRequestError", () => {
    test("should create bad request error with default message", () => {
      const error = new BadRequestError();
      expect(error.message).toBe("Bad Request");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("BadRequestError");
    });

    test("should create bad request error with custom message", () => {
      const error = new BadRequestError("Invalid input");
      expect(error.message).toBe("Invalid input");
      expect(error.statusCode).toBe(400);
    });
  });

  describe("UnauthorizedError", () => {
    test("should create unauthorized error with default message", () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe("Unauthorized");
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("UnauthorizedError");
    });

    test("should create unauthorized error with custom message", () => {
      const error = new UnauthorizedError("Invalid credentials");
      expect(error.message).toBe("Invalid credentials");
      expect(error.statusCode).toBe(401);
    });
  });

  describe("ForbiddenError", () => {
    test("should create forbidden error with default message", () => {
      const error = new ForbiddenError();
      expect(error.message).toBe("Forbidden");
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe("ForbiddenError");
    });

    test("should create forbidden error with custom message", () => {
      const error = new ForbiddenError("Access denied");
      expect(error.message).toBe("Access denied");
      expect(error.statusCode).toBe(403);
    });
  });

  describe("NotFoundError", () => {
    test("should create not found error with default message", () => {
      const error = new NotFoundError();
      expect(error.message).toBe("Not Found");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("NotFoundError");
    });

    test("should create not found error with custom message", () => {
      const error = new NotFoundError("Resource not found");
      expect(error.message).toBe("Resource not found");
      expect(error.statusCode).toBe(404);
    });
  });

  describe("ValidationError", () => {
    test("should create validation error with default message", () => {
      const error = new ValidationError();
      expect(error.message).toBe("error.message.unprocessable_data");
      expect(error.statusCode).toBe(422);
      expect(error.name).toBe("ValidationError");
    });

    test("should create validation error with custom message", () => {
      const error = new ValidationError("Invalid data format");
      expect(error.message).toBe("Invalid data format");
      expect(error.statusCode).toBe(422);
    });
  });
});
