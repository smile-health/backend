import { createRoute, RouteConfig } from "@hono/zod-openapi";
import { ErrorResponseSchema, UserNameSchema } from "../schemas/sharedSchemas";
import {
  LoginRequestSchema,
  LoginResponseSchema,
  UserInfoResponseSchema,
} from "../schemas/authSchemas";
import { ForgotPasswordRequestSchema, ForgotPasswordResponseSchema } from "../schemas/forgotPasswordSchemas";

// Define the login route
export const loginRoute: RouteConfig = createRoute({
  method: "post",
  path: "/login",
  summary: "User Login",
  description: "Authenticate user and return access token with other details",
  tags: ["Auth"],
  requestBody: {
    content: {
      "application/x-www-form-urlencoded": {
        body: LoginRequestSchema,
        example: {
          username: "customer",
          password: "smile",
        },
      },
    },
    required: true,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: LoginResponseSchema,
        },
      },
      description: "Successful login",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Bad request",
    },
    401: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Unauthorized: Invalid username or password",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

// Define the validate token route
export const validateTokenRoute: RouteConfig = createRoute({
  method: "get",
  path: "/validate-token",
  summary: "Validate Token and Get User Info",
  description: "Validate the token and retrieve user information",
  tags: ["Auth"],
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: "Token validated successfully",
      content: {
        "application/json": {
          schema: UserInfoResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Define the logout route
export const logoutRoute: RouteConfig = createRoute({
  method: "post",
  path: "/logout",
  summary: "Logout User",
  description:
    "Logout the user and invalidate all sessions associated with the user",
  tags: ["Auth"],
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: "User logged out successfully",
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Define the forgot password route
export const sendForgotPasswordEmailRoute: RouteConfig = createRoute({
  method: "post",
  path: "/forgot-password",
  summary: "Send Password Reset Email",
  description:
    "Send a password reset email with a magic link token to the user's email address",
  tags: ["Auth"],
  requestBody: {
    content: {
      "application/json": {
        body: ForgotPasswordRequestSchema,
        example: {
          email: "user@example.com",
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ForgotPasswordResponseSchema,
        },
      },
      description: "Password reset email sent successfully (if account exists)",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Bad request - invalid email",
    },
    429: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Too many requests - rate limit exceeded",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});
