import z from "zod"
import { IdParamsSchema } from "@smile/lib/types/param.js"

/* Base Schema */
export const OrderCommentSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  user_id: z.number().positive(),
  order_status_id: z.number().positive(),
  comment: z.string(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* Request Body Schema */
export const CreateOrderCommentRequestSchema = OrderCommentSchema.pick({
  comment: true,
})

/* DTO Schema */
export const CreateOrderCommentDTOSchema = OrderCommentSchema.omit({
  id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
  deleted_by: true,
  deleted_at: true,
})

/* Path Params Schema */
export const GetDetailOrderSchema = IdParamsSchema

/* Request Body Type */
export type CreateOrderCommentRequest = z.infer<
  typeof CreateOrderCommentRequestSchema
>

/* DTO Type */
export type CreateOrderCommentDTO = z.infer<typeof CreateOrderCommentDTOSchema>
