/* eslint-disable @typescript-eslint/no-empty-object-type */
import {
  UserChangelogs,
  WsUsers,
} from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
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
  status: z.coerce
    .number()
    .int()
    .nonnegative()
    .refine((v) => !isNaN(v))
    .nullish(),
  entity_id: z
    .string()
    .transform((v) => parseInt(v))
    .refine((v) => !isNaN(v), { message: "Invalid type" })
    .optional(),
  role: z.coerce.number().nullish(),
  province_id: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_PROVINCE_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  regency_id: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_REGENCY_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  start_date: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  end_date: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
})

export const DetailSchema = z.object({
  id: z
    .string({ required_error: "Id is required" })
    .transform((v) => parseInt(v))
    .refine((v) => !isNaN(v), { message: "Invalid type" }),
})

export const UpdateStatusRequestSchema = z.object({
  status: z.union([z.literal(0), z.literal(1)]),
})
export type UpdateStatusRequest = z.infer<typeof UpdateStatusRequestSchema>

export type SyncUserRequest = z.infer<typeof SyncUserSchema>

export interface EntityResponse {
  type: number
  address: string | null
  id: number
  name: string | null
  tag: string | null
  location: string
}
export interface UserResponse extends Omit<Selectable<WsUsers>, "password"> {
  role_label?: string
  gender_label?: string
  entity?: EntityResponse
}

export interface GetUserQueries extends z.infer<typeof GetUserQueriesSchema> {
  isPaginate?: boolean
}

export type DetailRequest = z.infer<typeof DetailSchema>

export interface UserChangeLogsResponse extends Selectable<UserChangelogs> {}
