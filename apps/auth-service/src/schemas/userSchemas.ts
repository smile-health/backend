import { z } from "@hono/zod-openapi";

// Define the schema for the credentials
const ClientRoleSchema = z.object({
  id: z.string().openapi({
    description: "Client ID",
    example: "smile-client"
  }),
  roles: z.array(z.string()).openapi({
    description: "List of roles for this client",
    example: ["client-role1", "client-role2"]
  })
});

const UserCredentialSchema = z.object({
  temporary: z.boolean().default(false).openapi({
    description: "Indicates if the credential is temporary",
    example: false,
  }),
  type: z
    .literal("password")
    .transform((val) => val.toLowerCase())
    .openapi({
      description: "Type of the credential (only 'password' is supported)",
      example: "password",
    }),
  value: z
    .string()
    .min(4, "Password must be at least 4 characters long")
    .openapi({
      description: "Value of the credential",
      example: "smile",
    }),
});

// Define the schema for the access
const UserAccessSchema = z.object({
  manageGroupMembership: z.boolean().optional().openapi({
    description: "Can manage group membership",
    example: true,
  }),
  view: z.boolean().optional().openapi({
    description: "Can view user details",
    example: true,
  }),
  mapRoles: z.boolean().optional().openapi({
    description: "Can map roles",
    example: true,
  }),
  impersonate: z.boolean().optional().openapi({
    description: "Can impersonate user",
    example: true,
  }),
  manage: z.boolean().optional().openapi({
    description: "Can manage user",
    example: true,
  }),
});

// Define the schema for the attributes
const UserAttributesSchema = z
  .object({
    locale: z.string().default("en").optional().openapi({
      description: "Locale of the user",
      example: "en",
    }),
    appUserId: z.string().openapi({
      description: "Application user ID",
      example: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
    }),
    programId: z
      .array(z.string())
      .default([])
      .optional()
      .openapi({
        description: "Program IDs",
        example: [
          "cec29cd1-9ac2-4f1f-8b48-ed60b525c047",
          "cec29cd1-9ac2-4f1f-8b48-ed60b525c048",
        ],
      }),
  })
  .strict()
  .openapi({
    description: "User attributes supported by the application",
    example: {
      locale: "",
      appUserId: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
      programId: ["cec29cd1-9ac2-4f1f-8b48-ed60b525c047"],
    },
  });

// Define the schema for the create user request
export const CreateUserSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username is required and must be at least 3 characters long")
      .openapi({
        description: "Username of the user",
        example: "testuser",
      }),
    firstName: z
      .string()
      .min(2, "First name is required and must be at least 2 characters long")
      .openapi({
        description: "First name of the user",
        example: "Test",
      }),
    lastName: z.string().optional().openapi({
      description: "Last name of the user",
      example: "User",
    }),
    email: z.string().email("Invalid email address").openapi({
      description: "Email address of the user",
      example: "test.user@smile",
    }),
    emailVerified: z.boolean().default(false).optional().openapi({
      description: "Indicates if the email is verified",
      example: true,
    }),
    enabled: z.boolean().default(true).optional().openapi({
      description: "Indicates if the user is enabled",
      example: true,
    }),
    credentials: z
      .array(UserCredentialSchema)
      .min(1, "At least one credential is required")
      .openapi({
        description: "List of user credentials",
        example: [
          {
            temporary: false,
            type: "password",
            value: "smile",
          },
        ],
      }),
    requiredActions: z
      .array(z.string())
      .default([])
      .optional()
      .openapi({
        description: "List of required actions",
        example: ["UPDATE_PASSWORD"],
      }),
    attributes: UserAttributesSchema.optional().openapi({
      description: "User attributes",
      example: {
        locale: "",
        appUserId: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
        programId: ["cec29cd1-9ac2-4f1f-8b48-ed60b525c047"],
      },
    }),
    roles: z
      .array(z.string())
      .default([])
      .optional()
      .openapi({
        description: "List of realm roles",
        example: ["role1", "role2"],
      }),
    clients: z
      .array(ClientRoleSchema)
      .default([])
      .optional()
      .openapi({
        description: "List of client roles",
        example: [{
          id: "smile-client",
          roles: ["client-role1", "client-role2"]
        }],
      }),
  })
  .openapi("CreateUser");

// Define the schema for the create user request
export const UpdateUserSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username is required and must be at least 3 characters long")
      .openapi({
        description: "Username of the user",
        example: "testuser",
      }),
    firstName: z
      .string()
      .min(2, "First name is required and must be at least 2 characters long")
      .openapi({
        description: "First name of the user",
        example: "Test",
      }),
    lastName: z.string().optional().openapi({
      description: "Last name of the user",
      example: "User",
    }),
    email: z.string().email("Invalid email address").openapi({
      description: "Email address of the user",
      example: "test.user@smile",
    }),
    emailVerified: z.boolean().default(false).optional().openapi({
      description: "Indicates if the email is verified",
      example: true,
    }),
    enabled: z.boolean().default(true).optional().openapi({
      description: "Indicates if the user is enabled",
      example: true,
    }),
    credentials: z
      .array(UserCredentialSchema)
      .min(1, "At least one credential is required")
      .optional()
      .openapi({
        description: "List of user credentials",
        example: [
          {
            temporary: false,
            type: "password",
            value: "smile",
          },
        ],
      }),
    requiredActions: z
      .array(z.string())
      .default([])
      .optional()
      .openapi({
        description: "List of required actions",
        example: ["UPDATE_PASSWORD"],
      }),
    attributes: UserAttributesSchema.optional().openapi({
      description: "User attributes",
      example: {
        locale: "",
        appUserId: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
        programId: ["cec29cd1-9ac2-4f1f-8b48-ed60b525c047"],
      },
    }),
    roles: z
      .array(z.string())
      .default([])
      .optional()
      .openapi({
        description: "List of realm roles",
        example: ["role1", "role2"],
      }),
    clients: z
      .array(ClientRoleSchema)
      .default([])
      .optional()
      .openapi({
        description: "List of client roles",
        example: [{
          id: "smile-client",
          roles: ["client-role1", "client-role2"]
        }],
      }),
  })
  .openapi("UpdateUser");

export const CreateUserResponseSchema = z.object({
  id: z.string().openapi({
    description: "User ID",
    example: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
  }),
});

// Define the schema for user details
const RoleMappingSchema = z.object({
  clientMappings: z.record(z.string(), z.object({
    mappings: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      composite: z.boolean(),
      clientRole: z.boolean()
    }))
  })).optional(),
  realmMappings: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    composite: z.boolean()
  })).optional()
}).openapi({
  description: "User role mappings including both realm and client roles"
});

export const UserSchema = z
  .object({
    id: z.string().openapi({
      description: "User ID",
      example: "08009c1c-848f-4adc-96fa-84c7fcd69b34",
    }),
    username: z.string().openapi({
      description: "Username of the user",
      example: "testuser",
    }),
    firstName: z.string().openapi({
      description: "First name of the user",
      example: "Test",
    }),
    lastName: z.string().openapi({
      description: "Last name of the user",
      example: "User",
    }),
    email: z.string().email().openapi({
      description: "Email address of the user",
      example: "test.user@smile.com",
    }),
    emailVerified: z.boolean().openapi({
      description: "Indicates if the email is verified",
      example: true,
    }),
    attributes: UserAttributesSchema.openapi({
      description: "User attributes",
      example: {
        appUserId: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
        programId: ["cec29cd1-9ac2-4f1f-8b48-ed60b525c046"],
      },
    }),
    createdTimestamp: z.number().openapi({
      description: "Timestamp when the user was created",
      example: 1735286485855,
    }),
    enabled: z.boolean().openapi({
      description: "Indicates if the user is enabled",
      example: true,
    }),
    requiredActions: z.array(z.string()).openapi({
      description: "List of required actions",
      example: ["UPDATE_PASSWORD"],
    }),
    access: UserAccessSchema.openapi({
      description: "User access permissions",
      example: {
        manageGroupMembership: true,
        view: true,
        mapRoles: true,
        impersonate: true,
        manage: true,
      },
    }),
    roleMappings: RoleMappingSchema.optional().openapi({
      description: "User role mappings including both realm and client roles",
      example: {
        realmMappings: [{
          id: "123",
          name: "realm-role",
          composite: false
        }],
        clientMappings: {
          "smile-client": {
            mappings: [{
              id: "456",
              name: "client-role",
              composite: false,
              clientRole: true
            }]
          }
        }
      }
    }),
  })
  .openapi("User");

export type UserCredential = z.infer<typeof UserCredentialSchema>;
export type UserAccess = z.infer<typeof UserAccessSchema>;
export type UserAttributes = z.infer<typeof UserAttributesSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type User = z.infer<typeof UserSchema>;
