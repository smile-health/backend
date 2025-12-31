import { Users } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { Selectable } from "kysely"
import z from "zod"

export const UserSchema = z.object({
  id: z.number(),
  username: z.string().optional(),
  email: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  gender: z.number().optional(),
  mobile_phone: z.string().optional(),
  address: z.string().optional(),
  role: z.number().optional(),
  global_id: z.number().optional(),
  entity_id: z.number().optional(),
  status: z.number().optional(),
})

export const SyncUserSchema = z.object({
  user: UserSchema,
  workspace_ids: z.number().array(),
})

export const GetUserQueriesSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
  entity_id: z
    .string()
    .transform((v) => parseInt(v))
    .refine((v) => !isNaN(v), { message: "Invalid type" })
    .optional(),
})

export const DetailSchema = z.object({
  id: z
    .string({ required_error: "Id is required" })
    .transform((v) => parseInt(v))
    .refine((v) => !isNaN(v), { message: "Invalid type" }),
})

export type SyncUserRequest = z.infer<typeof SyncUserSchema>

export interface EntityResponse {
  type: number
  address: string | null
  id: number
  name: string | null
  tag: string | null
  location: string
}
export interface UserResponse extends Omit<Selectable<Users>, "password"> {
  role_label?: string
  gender_label?: string
  entity?: EntityResponse
}

export interface GetUserQueries extends z.infer<typeof GetUserQueriesSchema> {
  isPaginate?: boolean
}

export type DetailRequest = z.infer<typeof DetailSchema>
