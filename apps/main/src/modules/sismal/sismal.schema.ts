import { z } from "zod"

// Transactions
export const SismalTransactionsQueries = z.object({
  page: z.coerce.number().int().min(1).default(1),
  paginate: z.coerce.number().int().min(1),
  activity_id: z.string().optional(),
  province_id: z.string().optional(),
  transaction_type_id: z.coerce.number().int().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  entity_tag_id: z.coerce.number().int().optional(),
})

export const SismalTransactionResponse = z.object({
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  list: z.array(
    z.object({
      entity: z.object({
        code: z.string().nullable(),
        id_satu_sehat: z.number().nullable(),
        name: z.string().nullable(),
      }),
      master_material: z.object({
        code: z.string().nullable(),
        kfa_code: z.string().nullable(),
        name: z.string().nullable(),
      }),
      transaction_reason_id: z.number().nullable(),
      stock: z.object({
        batch: z.object({
          code: z.string().nullable(),
          expired_date: z.string().datetime().nullable(),
        }),
      }),
      change_qty: z.number().nullable(),
      user_created: z.object({
        username: z.string().nullable(),
      }),
    })
  ),
})

export type SismalTransactionsQueriesType = z.infer<
  typeof SismalTransactionsQueries
>

export type SismalTransactionResponseType = z.infer<
  typeof SismalTransactionResponse
>

// Orders
export const SismalOrdersQueries = z.object({
  page: z.coerce.number().int().min(1).default(1),
  paginate: z.coerce.number().int().min(1),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  entity_tag_id: z.coerce.number().int().optional(),
  entity_province_id: z.coerce.number().int().optional(),
  activity_id: z.coerce.number().int().optional(),
  customer_id: z.coerce.number().int().optional(),
  type: z.coerce.number().int().optional(),
  status: z.coerce.number().int().optional(),
})

export const SismalOrdersResponse = z.object({
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  list: z.array(
    z.object({
      created_at: z.string().datetime().nullable(),
      id: z.number().nullable(),
      status: z.number().nullable(),
      total_order_item: z.number().nullable(),
      customer: z.object({
        code: z.string().nullable(),
        id_satu_sehat: z.number().nullable(),
        name: z.string().nullable(),
        province_id: z.number().nullable(),
        regency_id: z.number().nullable(),
      }),
      vendor: z.object({
        code: z.string().nullable(),
        id_satu_sehat: z.number().nullable(),
        name: z.string().nullable(),
      }),
      order_items: z.array(
        z.object({
          id: z.number().nullable(),
          qty: z.number().nullable(),
          master_material_id: z.number().nullable(),
          master_material: z.object({
            name: z.string().nullable(),
            unit: z.string().nullable(),
            kfa_code: z.string().nullable(),
            code: z.string().nullable(),
          }),
        })
      ),
    })
  ),
})

export type SismalOrdersQueriesType = z.infer<typeof SismalOrdersQueries>
export type SismalOrdersResponseType = z.infer<typeof SismalOrdersResponse>
