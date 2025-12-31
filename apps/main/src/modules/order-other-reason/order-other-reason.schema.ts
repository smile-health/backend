import z from "zod"

const preprocessToString = (value: unknown) =>
  typeof value === "number" ? String(value) : value

/* Base Schema */
export const OrderOtherReasonSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  order_item_stock_id: z.number().positive(),
  other_reason: z.preprocess(
    preprocessToString,
    z.string().min(1).max(255).nullish()
  ),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* DTO Schema */
export const CreateOrderOtherReasonDTOSchema = OrderOtherReasonSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

/* DTO Type */
export type CreateOrderOtherReasonDTO = z.infer<
  typeof CreateOrderOtherReasonDTOSchema
>
