import { RouteConfigToTypedResponse } from "@hono/zod-openapi";
import { Context } from "hono";
import {
  loginRoute,
  logoutRoute,
  validateTokenRoute,
  sendForgotPasswordEmailRoute,
} from "../routes/authRoutes";
import { AuthDetails, LoginRequestSchema } from "../schemas/authSchemas";
import { AuthTokenSchema, UserNameSchema } from "../schemas/sharedSchemas";
import { ForgotPasswordRequestSchema } from "../schemas/forgotPasswordSchemas";
import appService from "../services/appService";
import logger from "../utils/logger";
import { validateRequestBody } from "../utils/validators";
import keycloakClient from "../keycloakClient";
import { generateToken, getExpiryDate, storeToken, buildResetLink } from "../services/passwordResetService";
import { buildPasswordResetEmailHtml, sendEmail } from "../services/emailService";

export const loginHandler = async (
  c: Context
): Promise<RouteConfigToTypedResponse<typeof loginRoute>> => {
  const validationResult = await validateRequestBody(c, LoginRequestSchema);

  if (!validationResult.success) {
    return c.json(validationResult.errorResponse, 400);
  }

  // Extract username and password & attempt login
  if (validationResult.data) {
    const { username, password, fcm_token } = validationResult.data;

    // Attempt login
    try {
      const deviceType = c.req.header("device-type") ?? "web";
      logger.info(
        `AuthRouteHandlers.loginHandler: Login attempt for user: '${username}' from device: '${deviceType}'`
      );
      const token: AuthDetails = await appService.login(
        username,
        password,
        deviceType
      );
      // Try to update the User Last login stats, this WONT fail the login request
      try {
        await appService.updateUserLastLogin(token.access_token, {
          fcm_token: fcm_token ?? null,
          last_login: new Date(),
          last_device: c.req.header("device-type")! ?? "web",
          language: c.req.header("Accept-Language"),
        });
        logger.info(
          `AuthRouteHandlers.loginHandler: Last Login successfully recorded for user: '${username}'`
        );
      } catch (error: any) {
        logger.warn(
          `AuthRouteHandlers.loginHandler: Unable to record login stats for user: '${username}' - ${JSON.stringify(error?.message)} - ${JSON.stringify(error?.statusCode)}`
        );
        console.error(error);
      }

      logger.info(
        `AuthRouteHandlers.loginHandler: Login successful for user: '${username}'`
      );
      return c.json({ authDetails: token }, 200);
    } catch (error: any) {
      // Handle specific error cases
      if (error.statusCode) {
        logger.warn(
          `AuthRouteHandlers.loginHandler: '${username}' - ${JSON.stringify(error?.message)} - ${JSON.stringify(error?.statusCode)}`
        );
        return c.json(
          { message: c.var.t(error.message), code: error?.statusCode },
          error?.statusCode
        );
      }
      if (error.message.includes("Unauthorized")) {
        logger.warn(
          `AuthRouteHandlers.loginHandler: Unauthorized login attempt for user: '${username}'`
        );
        return c.json({ message: error.message, code: 401 }, 401);
      }
      if (error.message.includes("Bad Request")) {
        logger.warn(
          `AuthRouteHandlers.loginHandler: Unsuccessful login attempt for user: '${username}'`
        );
        return c.json({ message: error.message, code: 400 }, 400);
      }
      if (error.message.includes("device_not_allowed")) {
        logger.warn(
          `AuthRouteHandlers.loginHandler: Device not allowed for user: '${username}'`
        );
        return c.json(
          {
            message: "Operators can only login from mobile devices",
            code: 403,
          },
          403
        );
      }
      logger.error(
        `AuthRouteHandlers.loginHandler: Internal server error during login for user: '${username}', ${error}`
      );
      return c.json({ message: "Internal server error", code: 500 }, 500);
    }
  } else {
    logger.warn(
      `AuthRouteHandlers.loginHandler: Login details are missing in request body`
    );
    return c.json(
      { message: "Invalid request body, login details are missing", code: 400 },
      400
    );
  }
};

export const validateTokenHandler = async (
  c: Context
): Promise<RouteConfigToTypedResponse<typeof validateTokenRoute>> => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    logger.warn(
      `AuthRouteHandlers.validateTokenHandler: Validation failed: Authorization header is missing`
    );
    return c.json(
      { message: "Authorization header is missing", code: 400 },
      400
    );
  }

  const reqValidationResult = AuthTokenSchema.safeParse(token);

  if (!reqValidationResult.success) {
    logger.warn(
      `AuthRouteHandlers.validateTokenHandler: Auth Token Validation failed: ${JSON.stringify(reqValidationResult.error.errors)}`
    );
    const errorResponse = {
      message: reqValidationResult.error.errors,
      code: 400,
    };
    return c.json(errorResponse, 400);
  }

  try {
    const userInfo = await appService.validateToken(token);
    logger.info(
      `UserRouteHandlers.validateTokenHandler: Token validated successfully for user: ${userInfo.sub}`
    );
    return c.json({ userInfo: userInfo }, 200);
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      logger.warn(
        `UserRouteHandlers.validateTokenHandler: Token validation failed: ${error}`
      );
      return c.json(
        { message: "Unauthorized: Invalid or expired token", code: 401 },
        401
      );
    }
    logger.error(`Failed to validate token: ${error}`);
    return c.json({ message: "Failed to validate token", code: 500 }, 500);
  }
};

export const logoutHandler = async (
  c: Context
): Promise<RouteConfigToTypedResponse<typeof logoutRoute>> => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    logger.warn(
      `AuthRouteHandlers.logoutHandler: Validation failed: Authorization header is missing`
    );
    return c.json(
      { message: "Authorization header is missing", code: 400 },
      400
    );
  }

  const reqValidationResult = AuthTokenSchema.safeParse(token);

  if (!reqValidationResult.success) {
    logger.warn(
      `AuthRouteHandlers.logoutHandler: Auth Token Validation failed: ${JSON.stringify(reqValidationResult.error.errors)}`
    );
    const errorResponse = {
      message: reqValidationResult.error.errors,
      code: 400,
    };
    return c.json(errorResponse, 400);
  }

  try {
    await appService.logoutUser(token);
    logger.info(
      `AuthRouteHandlers.logoutHandler: User logged out successfully`
    );
    return c.json({}, 200); // Return an empty object with the status code 204
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      logger.warn(
        `UserRouteHandlers.logoutHandler: Token validation failed: ${error}`
      );
      return c.json(
        { message: "Unauthorized: Invalid or expired token", code: 401 },
        401
      );
    }
    if (error.message.includes("User not found")) {
      logger.warn(
        `UserRouteHandlers.logoutHandler: User not found with token: ${error}`
      );
      return c.json({ message: "User not found", code: 404 }, 404);
    }
    logger.error(
      `AuthRouteHandlers.logoutHandler: Failed to log out user: ${error}`
    );
    return c.json({ message: "Failed to log out user", code: 500 }, 500);
  }
};

export const resetPasswordEmailHandler = async (
  c: Context
): Promise<RouteConfigToTypedResponse<typeof sendForgotPasswordEmailRoute>> => {
  const reqBody = await c.req.json();
  const reqValidationResult = ForgotPasswordRequestSchema.safeParse(reqBody);

  if (!reqValidationResult.success) {
    logger.warn(
      `AuthRouteHandlers.resetPasswordEmailHandler: Request Validation failed: ${JSON.stringify(reqValidationResult.error.errors)}`
    );
    const errorResponse = {
      message: reqValidationResult.error.errors,
      code: 400,
    };
    return c.json(errorResponse, 400);
  }

  const { email } = reqValidationResult.data;
  logger.info(
    `AuthRouteHandlers.resetPasswordEmailHandler: Processing forgot password request for email: '${email}'`
  );

  // Always return a generic success message to prevent email enumeration
  const genericMessage = "If an account with that email exists, a password reset link has been sent.";

  try {
    // Look up the user by email in Keycloak
    const user = await keycloakClient.findUserByEmail(email);

    if (!user || !user.exists) {
      // Return generic success even if user not found (anti-enumeration)
      logger.info(
        `AuthRouteHandlers.resetPasswordEmailHandler: No user found for email: '${email}', returning generic response`
      );
      return c.json({ message: genericMessage }, 200);
    }

    // User exists — generate a reset token
    const token = generateToken();
    const expiresAt = getExpiryDate();

    // Store the token in the database
    await storeToken(user.id!, email, token, expiresAt);

    // Build the reset link and send the email
    const resetLink = buildResetLink(token);
    const emailHtml = buildPasswordResetEmailHtml(resetLink);

    await sendEmail({
      to: email,
      subject: "Password Reset Request — SMILE Platform",
      html: emailHtml,
    });

    logger.info(
      `AuthRouteHandlers.resetPasswordEmailHandler: Password reset email sent to: '${email}' for user: '${user.id}'`
    );

    return c.json({ message: genericMessage }, 200);
  } catch (error: any) {
    logger.error(
      `AuthRouteHandlers.resetPasswordEmailHandler: Failed to process forgot password request for '${email}': ${error}`
    );
    // Still return generic success to prevent email enumeration
    return c.json({ message: genericMessage }, 200);
  }
};
