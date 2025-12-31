import z from "zod"

/* Base Schema */
export const OrderHistorySchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  order_status_id: z.number().positive(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* DTO Schema */
export const CreateOrderHistoryDTOSchema = OrderHistorySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

/* DTO Type */
export type CreateOrderHistoryDTO = z.infer<typeof CreateOrderHistoryDTOSchema>
