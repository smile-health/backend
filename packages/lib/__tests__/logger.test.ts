import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { logger, httpLogger } from "../logger";
import { Context } from "hono";
import { createMockContext } from "./helpers";

describe("Logger", () => {
  describe("logger", () => {
    test("should be a valid pino logger instance", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    test("should log messages with different levels", () => {
      const spy = jest.spyOn(console, "log");

      logger.info("test info message");
      logger.error("test error message");
      logger.warn("test warn message");
      logger.debug("test debug message");

      expect(spy).toHaveBeenCalledTimes(4);
      spy.mockRestore();
    });
  });

  describe("httpLogger middleware", () => {
    let mockContext: Context;
    let nextFunction: jest.Mock;

    beforeEach(() => {
      nextFunction = jest.fn();
      mockContext = createMockContext();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test("should log request received", async () => {
      const spy = jest.spyOn(logger, "info");

      await httpLogger(mockContext, nextFunction);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          req: expect.objectContaining({
            id: expect.any(String),
            method: expect.any(String),
            url: expect.any(String),
            query: expect.any(Object),
            headers: expect.any(Object),
          }),
          msg: "request received",
        })
      );
      spy.mockRestore();
    });

    test("should log request completed with response time", async () => {
      const spy = jest.spyOn(logger, "info");

      await httpLogger(mockContext, nextFunction);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          req: expect.objectContaining({
            id: expect.any(String),
            method: expect.any(String),
            url: expect.any(String),
            query: expect.any(Object),
            headers: expect.any(Object),
          }),
          res: expect.objectContaining({
            statusCode: expect.any(Number),
            error: expect.objectContaining({
              message: expect.any(String),
              stack: expect.any(String),
            }),
          }),
          responseTime: expect.any(Number),
          msg: "request completed",
        })
      );
      spy.mockRestore();
    });

    test("should call next function", async () => {
      await httpLogger(mockContext, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    test("should handle errors in next function", async () => {
      const error = new Error("Test error");
      nextFunction.mockRejectedValue(error);
      const spy = jest.spyOn(logger, "info");

      await expect(httpLogger(mockContext, nextFunction)).rejects.toThrow(
        error
      );
      expect(spy).toHaveBeenCalledTimes(2); // Once for request received, once for request completed
      spy.mockRestore();
    });
  });
});
