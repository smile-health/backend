import { z } from "zod";
import { Context } from "hono";
import { ErrorResponse } from "../schemas/sharedSchemas";
import logger from "./logger";

export const validateRequestBody = async <T>(
  c: Context,
  schema: z.ZodType<T>
): Promise<{ success: boolean; data?: T; errorResponse?: ErrorResponse }> => {
  const reqBody = await c.req.parseBody();
  const reqValidationResult = schema.safeParse(reqBody);

  if (!reqValidationResult.success) {
    logger.warn(
      `ValidationHelper.validateRequest: Validation failed: ${JSON.stringify(reqValidationResult.error.issues)}`
    );
    const errorResponse = {
      message: reqValidationResult.error.issues,
      code: 400,
    };
    return {
      success: false,
      errorResponse: errorResponse,
    };
  }

  return { success: true, data: reqValidationResult.data };
};
