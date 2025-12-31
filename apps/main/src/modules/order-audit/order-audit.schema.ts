import z from "zod"

/* Base Schema */
export const OrderAuditSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  released_date: z.date().nullish(),
  required_date: z.coerce.date().nullish(),
  estimated_date: z.date().nullish(),
  actual_shipment_date: z.date().nullish(),
  confirmed_by: z.number().positive().nullish(),
  shipped_by: z.number().positive().nullish(),
  fulfilled_by: z.number().positive().nullish(),
  cancelled_by: z.number().positive().nullish(),
  allocated_by: z.number().positive().nullish(),
  confirmed_at: z.date().nullish(),
  shipped_at: z.date().nullish(),
  fulfilled_at: z.date().nullish(),
  cancelled_at: z.date().nullish(),
  allocated_at: z.date().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* DTO Schema */
export const CreateOrderAuditDTOSchema = OrderAuditSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

/* DTO Type */
export type CreateOrderAuditDTO = z.infer<typeof CreateOrderAuditDTOSchema>
