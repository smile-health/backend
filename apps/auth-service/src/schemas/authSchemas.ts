import { z } from "@hono/zod-openapi";

// Login Request Schema
export const LoginRequestSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .regex(/^[^@]+$/, "Username must not contain '@'")
    .openapi({
      description: "Username",
      example: "customer",
    }),
  password: z
    .string()
    .min(4, "Password must be at least 8 characters long")
    .openapi({
      description: "Password",
      example: "password",
    }),
  fcm_token: z.string().optional(),
});

// Auth Details Schema
export const AuthDetailsSchema = z
  .object({
    access_token: z.string().openapi({
      description: "Access token",
    }),
    expires_in: z.number().openapi({
      description: "Expires in",
      example: 3600,
    }),
    refresh_token: z.string().openapi({
      description: "Refresh token",
    }),
    refresh_expires_in: z.number().openapi({
      description: "Refresh expires in",
      example: 3600,
    }),
    token_type: z.string().openapi({
      description: "Token type",
    }),
    "not-before-policy": z.number().openapi({
      description: "Not before policy",
      example: 0,
    }),
    session_state: z.string().openapi({
      description: "Session state",
      example: "347f08d4-38d5-4845-bcfd-55de8e237f52",
    }),
    scope: z.string().openapi({
      description: "Scope",
      example: "openid email profile",
    }),
  })
  .openapi("AuthDetails");

// Login Response Schema
export const LoginResponseSchema = z.object({
  authDetails: AuthDetailsSchema,
});

// Define the schema for user roles
const RolesSchema = z.array(z.string()).openapi({
  description: "Roles assigned to the user",
  example: ["manage-account", "manage-account-links", "view-profile"],
});

// Define the schema for resource access
const ResourceAccessSchema = z
  .record(
    z.object({
      roles: RolesSchema,
    })
  )
  .openapi({
    description: "Resource access roles",
    example: {
      account: {
        roles: ["manage-account", "manage-account-links", "view-profile"],
      },
    },
  });

// Define the schema for realm access
const RealmAccessSchema = z
  .object({
    roles: RolesSchema,
  })
  .openapi({
    description: "Realm access roles",
    example: {
      roles: ["offline_access", "default-roles-smile", "uma_authorization"],
    },
  });

// Define the schema for user info response
export const UserInfoResponseSchema = z
  .object({
    sub: z.string().openapi({
      description: "Subject (user ID)",
      example: "7139ddd8-8645-469f-a5c3-125de8b09019",
    }),
    resource_access: ResourceAccessSchema.optional().openapi({
      description: "Resource access roles",
    }),
    email_verified: z.boolean().openapi({
      description: "Indicates if the email is verified",
      example: true,
    }),
    realm_access: RealmAccessSchema.optional().openapi({
      description: "Realm access roles",
    }),
    name: z.string().openapi({
      description: "Full name of the user",
      example: "Test User",
    }),
    preferred_username: z.string().openapi({
      description: "Preferred username",
      example: "testuser",
    }),
    appUserId: z.string().openapi({
      description: "Application user ID",
      example: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
    }),
    given_name: z.string().openapi({
      description: "Given name",
      example: "Test",
    }),
    family_name: z.string().openapi({
      description: "Family name",
      example: "User",
    }),
    email: z.string().email().openapi({
      description: "Email address",
      example: "test.user@smile.com",
    }),
    programId: z
      .array(z.string())
      .optional()
      .openapi({
        description: "Program IDs",
        example: ["cec29cd1-9ac2-4f1f-8b48-ed60b525c047"],
      }),
  })
  .openapi("UserInfo");

// Export types for these schemas
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type AuthDetails = z.infer<typeof AuthDetailsSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type UserInfo = z.infer<typeof UserInfoResponseSchema>;
