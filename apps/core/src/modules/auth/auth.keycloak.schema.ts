import { Users } from "@/common/infrastructure/database/types/db.js"
import { Selectable, Updateable } from "kysely"
import { z } from "zod"

// Define the schema for the credentials
const UserCredentialSchema = z.object({
  temporary: z.boolean().default(false),
  type: z.literal("password").transform((val) => val.toLowerCase()),
  value: z.string().min(4, "Password must be at least 4 characters long"),
})

// Define the schema for the attributes
const UserAttributesSchema = z.strictObject({
    locale: z.string().optional(),
    appUserId: z.string().optional(),
    programId: z.array(z.string()).optional(),
  })

// Define the schema for the create user request
export const CreateUserKeycloakSchema = z.object({
  username: z
    .string()
    .min(4, "Username is required and must be at least 4 characters long"),
  firstName: z
    .string()
    .min(4, "First name is required and must be at least 4 characters long"),
  lastName: z.string().optional(),
  email: z.email("Invalid email address"),
  emailVerified: z.boolean().optional(),
  enabled: z.boolean().optional(),
  credentials: z
    .array(UserCredentialSchema)
    .min(1, "At least one credential is required"),
  requiredActions: z.array(z.string()).optional(),
  attributes: UserAttributesSchema.optional(),
  roles: z.array(z.string()).optional(),
  clients: z.array(
    z.object({
      id: z.string(),
      roles: z.array(z.string())
    })
  ).optional(),
})

export type CreateUserKeycloakRequest = z.infer<typeof CreateUserKeycloakSchema>

export type UpdateableUser = Updateable<Users>
export type SelectableUser = Selectable<Users>
