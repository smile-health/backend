import { createRoute, RouteConfig } from "@hono/zod-openapi";
import {
  ActionByIdParamSchema,
  ErrorResponseSchema,
} from "../schemas/sharedSchemas";
import {
  CreateUserResponseSchema,
  CreateUserSchema,
  UserSchema,
} from "../schemas/userSchemas";

export const getUserRoute: RouteConfig = createRoute({
  method: "get",
  path: "/users/{id}",
  summary: "Get User by ID",
  description: "Retrieve a user by their ID",
  tags: ["Users"],
  security: [{ Bearer: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      parameter: ActionByIdParamSchema,
      description: "User ID to fetch details",
      example: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
    },
  ],
  responses: {
    200: {
      description: "User retrieved successfully",
      content: {
        "application/json": {
          schema: UserSchema,
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
    403: {
      description: "Forbidden",
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

export const createUserRoute: RouteConfig = createRoute({
  method: "post",
  path: "/users",
  summary: "Create a User in Keycloak",
  description: "Create a new user",
  tags: ["Users"],
  security: [{ Bearer: [] }],
  parameters: [],
  requestBody: {
    content: {
      "application/json": {
        body: CreateUserSchema,
        example: {
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          email: "test.user@smile.com",
          // emailVerified: true,
          // enabled: true,
          credentials: [
            {
              temporary: false,
              type: "password",
              value: "smile",
            },
          ],
          // requiredActions: [],
          attributes: {
            // locale: "en",
            appUserId: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
            programId: ["cec29cd1-9ac2-4f1f-8b48-ed60b525c047"],
          },
          roles: ["role1", "role2"],
          clients: [
            {
              id: "smile",
              roles: ["client-role1", "client-role2"],
            },
          ],
        },
      },
    },
    required: true,
  },
  responses: {
    "201": {
      content: {
        "application/json": {
          schema: CreateUserResponseSchema,
        },
      },
      description: "User created successfully",
    },
    "400": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Bad request",
    },
    "401": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Unauthorized, Invalid Token",
    },
    "403": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Forbidden",
    },
    "500": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

export const updateUserRoute: RouteConfig = createRoute({
  method: "put",
  path: "/users/{id}",
  summary: "Update a User in Keycloak",
  description: "Update an existing user",
  tags: ["Users"],
  security: [{ Bearer: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      parameter: ActionByIdParamSchema,
      description: "User ID to update details",
      example: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
    },
  ],
  requestBody: {
    content: {
      "application/json": {
        body: CreateUserSchema,
        example: {
          username: "testuser",
          firstName: "Updated",
          lastName: "User",
          email: "updated.user@smile.com",
          credentials: [
            {
              temporary: false,
              type: "password",
              value: "newsmile",
            },
          ],
          attributes: {
            appUserId: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
            programId: ["cec29cd1-9ac2-4f1f-8b48-ed60b525c047"],
          },
          roles: ["role3", "role4"],
          clients: [
            {
              id: "smile",
              roles: ["client-role3", "client-role4"],
            },
          ],
        },
      },
    },
    required: true,
  },
  responses: {
    "200": {
      content: {
        "application/json": {
          schema: CreateUserResponseSchema,
        },
      },
      description: "User updated successfully",
    },
    "400": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Bad request",
    },
    "401": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Unauthorized, Invalid Token",
    },
    "403": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Forbidden",
    },
    "404": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "User not found",
    },
    "409": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Conflict, Email already in use",
    },
    "500": {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

export const deleteUserRoute: RouteConfig = createRoute({
  method: "delete",
  path: "/users/{id}",
  summary: "Delete User by ID",
  description: "Delete a user by their ID",
  tags: ["Users"],
  security: [{ Bearer: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      parameter: ActionByIdParamSchema,
      description: "User ID to delete",
      example: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
    },
  ],
  responses: {
    200: {
      description: "User deleted successfully",
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
    403: {
      description: "Forbidden",
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

export const sendUpdatePasswordEmailRoute: RouteConfig = createRoute({
  method: "put",
  path: "/users/{id}/update-password",
  summary: "Send Update Password Action Email to User",
  description: "Send a password reset email to the user with a link",
  tags: ["Users"],
  security: [{ Bearer: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      parameter: ActionByIdParamSchema,
      description: "User ID to update password for",
      example: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
    },
  ],
  responses: {
    200: {
      description: "User action email sent successfully",
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
    403: {
      description: "Forbidden",
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
