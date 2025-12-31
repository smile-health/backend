import { RouteConfigToTypedResponse } from "@hono/zod-openapi";
import { Context } from "hono";
import {
  createUserRoute,
  deleteUserRoute,
  getUserRoute,
  sendUpdatePasswordEmailRoute,
  updateUserRoute,
} from "../routes/userRoutes";
import { ActionByIdParamSchema } from "../schemas/sharedSchemas";
import {
  CreateUserResponse,
  CreateUserSchema,
  UpdateUserSchema,
  User,
} from "../schemas/userSchemas";
import appService from "../services/appService";
import logger from "../utils/logger";

export const createUserHandler = async (
  c: Context
): Promise<RouteConfigToTypedResponse<typeof createUserRoute>> => {
  const reqBody = await c.req.json();

  const reqValidationResult = CreateUserSchema.safeParse(reqBody);

  if (!reqValidationResult.success) {
    logger.warn(
      `UserRouteHandlers.createUserHandler: Validation failed: ${JSON.stringify(
        reqValidationResult.error.errors
      )}`
    );
    const errorResponse = {
      message: reqValidationResult.error.errors,
      code: 400,
    };
    return c.json(errorResponse, 400);
  }

  // Attempt to create the user
  if (reqValidationResult.data) {
    logger.debug(
      `UserRouteHandlers.createUserHandler: Attempting to create user: '${JSON.stringify(reqValidationResult.data)}'`
    );
    const { username, email } = reqValidationResult.data;

    // Step 1: Validate if the user already exists
    try {
      const userExists = await appService.checkUserExists(username, email);
      if (userExists.exists && userExists.id) {
        const userId: string = userExists.id;
        logger.warn(
          `UserRouteHandlers.createUserHandler: User '${username}' already exists with ID: '${userId}'`
        );

        // Attempt to delete the user if exists and then create a new one
        try {
          logger.info(
            `UserRouteHandlers.createUserHandler: Deleting existing user: '${userId}'`
          );
          await appService.deleteUser(userId);
          logger.info(
            `UserRouteHandlers.createUserHandler: Existing User deleted successfully: ${userId}`
          );
        } catch (error: unknown) {
          logger.error(
            `UserRouteHandlers.createUserHandler: Internal server error during existing user deletion: ${error}`
          );
          return c.json({ message: "Internal server error", code: 500 }, 500);
        }
      } else {
        logger.info(
          `UserRouteHandlers.createUserHandler: User '${username}' with email '${email}' doesn not exists, new user will be created`
        );
      }
    } catch (error: unknown) {
      logger.error(
        `UserRouteHandlers.createUserHandler: Internal server error during user existence check: ${error}`
      );
      return c.json({ message: "Internal server error", code: 500 }, 500);
    }

    logger.info(
      `UserRouteHandlers.createUserHandler: Creating new user: '${username}' with email: '${email}'`
    );

    // Attempt to create user
    const userData = reqValidationResult.data;
    const newUserId = await appService.createUser(userData);

    logger.info(
      `UserRouteHandlers.createUserHandler: New User created successfully with ID: '${newUserId}'`
    );

    // Return the response with the new user ID and Location header
    const newuser: CreateUserResponse = {
      id: newUserId,
    };
    const host = c.req.header()["host"];
    const locationUrl = `http://${host}/users/${newUserId}`;
    c.header("Location", locationUrl);

    return c.json(newuser, 201);
  } else {
    logger.warn(
      `UserRouteHandlers.createUserHandler: Required user details are missing in the request body`
    );
    return c.json(
      { message: "Invalid request body, user details are missing", code: 400 },
      400
    );
  }
};

export const updateUserHandler = async (
  c: Context
): Promise<RouteConfigToTypedResponse<typeof updateUserRoute>> => {
  const userId = c.req.param().id;
  const reqBody = await c.req.json();
  const reqParamValidationResult = ActionByIdParamSchema.safeParse(userId);
  const reqBodyValidationResult = UpdateUserSchema.safeParse(reqBody);

  if (!reqParamValidationResult.success) {
    logger.warn(
      `UserRouteHandlers.updateUserHandler: User Id validation failed: ${JSON.stringify(reqParamValidationResult.error.errors)}`
    );
    const errorResponse = {
      message: reqParamValidationResult.error.errors,
      code: 400,
    };
    return c.json(errorResponse, 400);
  }

  if (!reqBodyValidationResult.success) {
    logger.warn(
      `UserRouteHandlers.updateUserHandler: User data Validation failed: ${JSON.stringify(
        reqBodyValidationResult.error.errors
      )}`
    );
    const errorResponse = {
      message: reqBodyValidationResult.error.errors,
      code: 400,
    };
    return c.json(errorResponse, 400);
  }

  try {
    // Attempt to update the user
    logger.info(
      `UserRouteHandlers.updateUserHandler: Attempting to update user: '${userId}'`
    );
    const userData = reqBodyValidationResult.data;
    await appService.updateUser(userId, userData);

    logger.info(
      `UserRouteHandlers.updateUserHandler: User updated successfully with ID: '${userId}'`
    );

    // Return the response with the updated user ID
    const updatedUser: CreateUserResponse = {
      id: userId,
    };
    return c.json(updatedUser, 200);
  } catch (error: any) {
    if (error.message.includes("User update conflict")) {
      logger.warn(
        `UserRouteHandlers.updateUserHandler: Conflict, probably email already in use: ${error}`
      );
      return c.json(
        { message: `Update conflict, ${error.message}`, code: 409 },
        409
      );
    }
    if (error.message.includes("Bad request")) {
      logger.warn(
        `UserRouteHandlers.updateUserHandler: Bad request for user update: '${userId}', ${error.message}`
      );
      return c.json({ message: `${error.message}`, code: 400 }, 400);
    }
    if (error.message.includes("User not found")) {
      logger.warn(
        `UserRouteHandlers.updateUserHandler: User not found for user update: '${userId}', ${error.message}`
      );
      return c.json({ message: `User not found`, code: 404 }, 404);
    }
    logger.error(
      `UserRouteHandlers.updateUserHandler: Internal server error: ${error}`
    );
    return c.json({ message: "Internal server error", code: 500 }, 500);
  }
};

export const getUserHandler = async (
  c: Context
): Promise<RouteConfigToTypedResponse<typeof getUserRoute>> => {
  const userId = c.req.param().id;
  const reqValidationResult = ActionByIdParamSchema.safeParse(userId);

  if (!reqValidationResult.success) {
    logger.warn(
      `UserRouteHandlers.getUserHandler: Validation failed: ${JSON.stringify(reqValidationResult.error.errors)}`
    );
    const errorResponse = {
      message: reqValidationResult.error.errors,
      code: 400,
    };
    return c.json(errorResponse, 400);
  }

  if (reqValidationResult.data) {
    const id: string = reqValidationResult.data;
    logger.info(`UserRouteHandlers.getUserHandler: Retrieving user: ${id}`);

    try {
      const user: User = await appService.getUserById(id);
      logger.info(
        `UserRouteHandlers.getUserHandler: User retrieved successfully: ${id}`
      );
      return c.json(user, 200);
    } catch (error: unknown) {
      if (error.message.includes("User not found")) {
        logger.warn(
          `UserRouteHandlers.getUserHandler: User not found with ID: '${id}'`
        );
        return c.json({ message: "User not found", code: 404 }, 404);
      }
      logger.error(
        `UserRouteHandlers.getUserHandler: Internal server error during user retrieval: ${error}`
      );
      return c.json({ message: "Internal server error", code: 500 }, 500);
    }
  } else {
    logger.warn(
      `UserRouteHandlers.getUserHandler: Required user details are missing in the request parameters`
    );
    return c.json(
      { message: "Invalid request, user ID is missing", code: 400 },
      400
    );
  }
};

export const deleteUserHandler = async (
  c: Context
): Promise<RouteConfigToTypedResponse<typeof deleteUserRoute>> => {
  const userId = c.req.param().id;
  const reqValidationResult = ActionByIdParamSchema.safeParse(userId);

  if (!reqValidationResult.success) {
    logger.warn(
      `UserRouteHandlers.deleteUserHandler: Validation failed: ${JSON.stringify(reqValidationResult.error.errors)}`
    );
    const errorResponse = {
      message: reqValidationResult.error.errors,
      code: 400,
    };
    return c.json(errorResponse, 400);
  }

  if (reqValidationResult.data) {
    logger.info(
      `UserRouteHandlers.deleteUserHandler: Attempting to delete user: '${JSON.stringify(reqValidationResult.data)}'`
    );
    const id: string = reqValidationResult.data;
    try {
      await appService.deleteUser(id);
      logger.info(
        `UserRouteHandlers.deleteUserHandler: User deleted successfully: '${id}'`
      );
      return c.json({}, 200);
    } catch (error: any) {
      if (error.message.includes("User not found")) {
        logger.warn(
          `UserRouteHandlers.deleteUserHandler: User not found with ID: '${id}'`
        );
        return c.json({ message: "User not found", code: 404 }, 404);
      }
      logger.error(
        `UserRouteHandlers.deleteUserHandler: Internal server error during user deletion: ${error}`
      );
      return c.json({ message: "Internal server error", code: 500 }, 500);
    }
  } else {
    logger.warn(
      `UserRouteHandlers.deleteUserHandler: Required user details are missing in the request parameters`
    );
    return c.json(
      { message: "Invalid request, user ID is missing", code: 400 },
      400
    );
  }
};

export const updatePasswordEmailHandler = async (
  c: Context
): Promise<RouteConfigToTypedResponse<typeof sendUpdatePasswordEmailRoute>> => {
  const userId = c.req.param().id;
  const reqValidationResult = ActionByIdParamSchema.safeParse(userId);

  if (!reqValidationResult.success) {
    logger.warn(
      `UserRouteHandlers.updatePasswordEmailHandler: Validation failed: ${JSON.stringify(reqValidationResult.error.errors)}`
    );
    const errorResponse = {
      message: reqValidationResult.error.errors,
      code: 400,
    };
    return c.json(errorResponse, 400);
  }

  if (reqValidationResult.data) {
    logger.info(
      `UserRouteHandlers.updatePasswordEmailHandler: Attempting to send update password emaul to user: '${JSON.stringify(reqValidationResult.data)}'`
    );
    const id: string = reqValidationResult.data;
    try {
      await appService.sendUpdatePwdActionEmailToUser(userId);
      logger.info(
        `UserRouteHandlers.updatePasswordEmailHandler: Password reset email sent to user: '${id}'`
      );
      return c.json({}, 200);
    } catch (error: any) {
      if (error.message.includes("User not found")) {
        logger.warn(
          `UserRouteHandlers.updatePasswordEmailHandler: User not found for password update: '${userId}', Error: ${error.message}`
        );
        return c.json({ message: `User not found`, code: 404 }, 404);
      }
      if (error.message.includes("Bad or invalid request")) {
        logger.warn(
          `UserRouteHandlers.updatePasswordEmailHandler: Bad request for user password update: '${userId}', Error: ${error.message}`
        );
        return c.json({ message: `${error.message}`, code: 400 }, 400);
      }
      logger.error(
        `UserRouteHandlers.updatePasswordEmailHandler: Internal server error: ${error}`
      );
      return c.json(
        {
          message:
            "Internal server error, Failed to send reset password email to user",
          code: 500,
        },
        500
      );
    }
  } else {
    logger.warn(
      `UserRouteHandlers.updatePasswordEmailHandler: Required user details are missing in the request parameters`
    );
    return c.json(
      { message: "Invalid request, user ID is missing", code: 400 },
      400
    );
  }
};
