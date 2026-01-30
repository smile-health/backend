import {
  WsBatches,
  WsOtherReasons,
  WsPurchases,
  WsStocks,
  WsTransactionLists,
  WsTransactionReasons,
  WsTransactions,
  WsTransactionTypes,
} from "@/common/infrastructure/database/types/db.js"
import { CursorPaginationQueriesSchema } from "@smile-health/lib/types/cursor-paginate.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { IdSchema } from "@smile-health/lib/types/param.js"
import { Selectable, Updateable } from "kysely"
import z from "zod"
import { RabiesPatientDTO } from "./consumption-rabies/consumption-rabies.schema.js"

const optionalNumber = z
  .string()
  .or(z.number())
  .nullable()
  .optional()
  .transform((val) => (val ? Number(val) : null))

const BatchSchema = z.object({
  code: z.string(),
  expired_date: z.string(),
  production_date: z.string().nullable().optional(),
  manufacture_id: IdSchema.or(z.number()),
})

const MaterialSchema = z.object({
  entity_id: z.number().optional(),
  activity_id: z.number().optional(),
  material_id: IdSchema.or(z.number()),
  transaction_reason_id: IdSchema.or(z.number()),
  budget_source_id: optionalNumber,
  price: optionalNumber,
  year: optionalNumber,
  other_reason: z.string().nullable(),
  stock_id: IdSchema.or(z.number()).nullable(),
  stock_quality_id: optionalNumber,
  qty: z.number().optional(),
  close_vial: z.number().optional(),
  open_vial: z.number().optional(),
  batch: BatchSchema.nullable().optional(),
  parent_material_id: z.number().optional(),
  is_other: z.boolean().optional(),
  is_purchase: z.boolean().optional(),
  is_managed_in_batch: z.boolean().optional(),
  is_open_vial: z.boolean().optional(),
  batch_id: z.number().optional(),
  oldStockValue: z.number().optional(),
  transaction_type_id: z.number().optional(),
})

export const TransactionSchema = z.object({
  entity_id: z.number().positive(),
  activity_id: z.number().positive(),
  entity_activity_id: z.number().positive(),
  materials: z.array(MaterialSchema).nonempty().min(1),
})

const ConsumptionMaterialSchema = z.object({
  material_id: IdSchema.or(z.number()),
  stock_id: IdSchema.or(z.number()).nullable(),
  qty: z.number(),
})

export const ConsumptionSchema = z.object({
  entity_id: z.number().positive(),
  activity_id: z.number().positive(),
  customer_id: z.number().positive(),
  actual_transaction_date: z
    .preprocess(
      (val) => (typeof val === "string" ? new Date(val) : val),
      z.date()
    )
    .refine((date) => date <= new Date(), {
      message: "Date cannot be in the future",
    }),
  materials: z.array(ConsumptionMaterialSchema).nonempty().min(1),
})

const CancelationDiscardTransactionSchema = z.object({
  stock_id: IdSchema.or(z.number()).nullable(),
  transaction_reason_id: IdSchema.or(z.number()),
  transaction_ids: z
    .array(IdSchema.or(z.number()).nullable())
    .nonempty()
    .min(1),
})

const SubmitReturnOfHealthAdditionalRequest = z.object({
  listTrx: z
    .array(
      z.object({
        id: z.number(),
        returned_qty: z.number().default(0),
        change_qty: z.number().default(0),
        consumption_unit_per_distribution_unit: z.number().default(0),
        qty_in_vial: z.number().default(0),
      })
    )
    .default([]),
})

const SubmitReturnOfHealthAdditionalRequestTrx = z.object({
  prevTrxRabiesSequence: z.number().nullish(),
  isTrxRabies: z.boolean().default(false),
  openVialQty: z.number().default(0),
})

export const SubmitReturnOfHealthFacilitiesTrxSchema =
  SubmitReturnOfHealthAdditionalRequest.extend({
    entity_id: z.number().positive(),
    customer_id: z.number().positive(),
    activity_id: z.number().positive(),
    actual_transaction_date: z.string().date(),
    entity_activity_id: z.number().positive().optional(),
    transactions: z.array(
      SubmitReturnOfHealthAdditionalRequestTrx.extend({
        transaction_id: z.number().positive(),
        stock_id: z.number().positive(),
        qty: z.number().nonnegative().default(0),
        broken_qty: z.number().nonnegative().default(0),
        open_vial: z.number().nonnegative().default(0),
        close_vial: z.number().nonnegative().default(0),
        broken_open_vial: z.number().nonnegative().default(0),
        broken_close_vial: z.number().nonnegative().default(0),
        transaction_reason_id: z.number().positive().optional(),
      })
    ),
  })

export const CancelationDiscardSchema = z.object({
  entity_id: z.number().positive(),
  activity_id: z.number().positive(),
  transactions: z.array(CancelationDiscardTransactionSchema).nonempty().min(1),
})

export type BatchRequest = z.infer<typeof BatchSchema>
export type MaterialRequest = z.infer<typeof MaterialSchema>
export type TransactionRequest = z.infer<typeof TransactionSchema>
export type ConsumptionRequest = z.infer<typeof ConsumptionSchema>
export type CancelaionDiscardRequest = z.infer<typeof CancelationDiscardSchema>

export type BatchErrorRequest = {
  code?: string[]
  expired_date?: string[]
  production_date?: string[]
  manufacture_id?: string[]
}

export type PublishTrxDTO = {
  id: number
  transaction_ids?: number[]
  discard?: DiscardDTO
  rabies?: {
    is_other_sequence?: boolean
    vaccine_method?: number
    patients?: RabiesPatientDTO[]
  }
}

export type DiscardDTO =
  | {
      id: number
      qty: number
      reason_id: number | undefined
    }
  | undefined

export type MaterialErrorRequest = {
  material_id?: string[]
  transaction_reason_id?: string[]
  other_reason?: string[]
  stock_id?: string[]
  qty?: string[]
  batch?: BatchErrorRequest
}

export type TransactionErrorResponse = {
  entity_id?: string[]
  activity_id?: string[]
  materials?: Record<string, MaterialErrorRequest>
}

export type ListPatientsDTO = {
  protocol_id: number | null
  protocol_name: string | null
  is_kipi: number | null
  is_medical_history: number | null
  is_diagnose_before: number | null
  birth_date: string | null
  gender: number | null
  transaction_id: number | null
  return_transaction_id: number | null
  phone_number: string | null
  identity_type: number | null
  identity_number: string
  vaccine_sequence_id: number | null
  vaccine_sequence_name: string | null
  vaccine_method_id: number | null
  vaccine_method_name: string | null
  vaccine_type_id: number | null
  vaccine_type_name: string | null
}

export type ListPatientDetailConsumption = {
  identity_type: number | null
  identity_number: string
  phone_number: string | null
  protocol: string | null
  gender: number | null
  birth_date: string | null
  is_diagnose_before: number | null
  vaccine_type: {
    id: number
    title: string | null
  } | null
  vaccine_method: {
    id: number
    title: string | null
  } | null
  vaccine_sequence: {
    id: number
    title: string | null
  } | null
}

export type TrxReturnedQty = {
  id: number
  returned_qty: number
  change_qty: number
  consumption_unit_per_distribution_unit: number
  qty_in_vial: number
}

export type ListTrxPatientRabies = {
  patient_id: number | null
  transaction_id: number | null
}

export type TrxSubmitReturnOfHealth = {
  transaction_id: number
  stock_id: number
  qty: number
  broken_qty: number
  open_vial: number
  close_vial: number
  broken_open_vial: number
  broken_close_vial: number
  transaction_reason_id?: number | undefined
  prevTrxRabiesSequence?: number | null
  isTrxRabies: boolean
  openVialQty: number
}

export type UpdateTrxReturnedHealthFacilities = {
  transaction_id: number
  stock_id: number
  qty: number
  broken_qty: number
  open_vial: number
  close_vial: number
  broken_open_vial: number
  broken_close_vial: number
  transaction_reason_id?: number | undefined
  prevTrxRabiesSequence?: number | null
  isTrxRabies: boolean
  openVialQty: number
}

export type CreateBatchyDTO = Selectable<Omit<WsBatches, "id">>
export type BatchyDTO = Selectable<WsBatches>

export type CreateStockDTO = Selectable<Omit<WsStocks, "id">>
export type StockDTO = Selectable<WsStocks>

export type CreateTransactionDTO = Selectable<Omit<WsTransactions, "id">>
export type TransactionDTO = Selectable<WsTransactions>

export type CreatePurchaseDTO = Selectable<Omit<WsPurchases, "id">>
export type PurchaseDTO = Selectable<WsPurchases>

export type CreateTransactionOtherReasonsDTO = Selectable<
  Omit<WsOtherReasons, "id">
>
export type TransactionOtherReasonsDTO = Selectable<WsOtherReasons>

/*
 * Use Case - Request
 */
export const TransactionTypePaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    is_enable: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }

        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Type must be an integer." })
        .nonnegative({ message: "Type must be a positive number." })
        .optional()
    ),
  })

export const TransactionReasonPaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    transaction_type_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }

        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Type must be an integer." })
        .nonnegative({ message: "Type must be a positive number." })
        .optional()
    ),
    // status adalah from params query 0,1
    status: z.preprocess((value) => {
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = parseInt(value, 10)
        return isNaN(parsed) ? undefined : parsed
      }

      return typeof value === "number" ? value : undefined
    }, z.number().min(0).max(1).optional()),
  })

export const TransactionListPaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    activity_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Activity ID must be an integer." })
        .nonnegative({ message: "Activity ID must be a positive number." })
        .optional()
    ),

    material_type_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Material type ID must be an integer." })
        .nonnegative({ message: "Material type ID must be a positive number." })
        .optional()
    ),

    material_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Material ID must be an integer." })
        .nonnegative({ message: "Material ID must be a positive number." })
        .optional()
    ),

    start_date: z.preprocess(
      (value) => {
        if (typeof value === "string") {
          return value.trim() === ""
            ? value
            : new Date(value.replace("+", " ")).toISOString()
        }
        return value
      },
      z
        .union([
          z.string().min(0),
          z.string().datetime({ message: "Invalid start date format." }),
        ])
        .optional()
    ),

    end_date: z.preprocess(
      (value) => {
        if (typeof value === "string") {
          return value.trim() === ""
            ? value
            : new Date(value.replace("+", " ")).toISOString()
        }
        return value
      },
      z
        .union([
          z.string().min(0),
          z.string().datetime({ message: "Invalid start date format." }),
        ])
        .optional()
    ),

    transaction_type_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Transaction type ID must be an integer." })
        .nonnegative({
          message: "Transaction type ID must be a positive number.",
        })
        .optional()
    ),

    transaction_reason_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Transaction reason ID must be an integer." })
        .nonnegative({
          message: "Transaction reason ID must be a positive number.",
        })
        .optional()
    ),

    is_order: z.preprocess((value) => {
      if (typeof value === "string") {
        return value === "1" || value === "0" ? value : undefined
      }
      return undefined
    }, z.string().optional()),

    order_type: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Order type must be an integer." })
        .nonnegative({ message: "Order type must be a positive number." })
        .optional()
    ),

    entity_tag_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Entity tag ID must be an integer." })
        .nonnegative({ message: "Entity tag ID must be a positive number." })
        .optional()
    ),

    primary_vendor_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Primary vendor ID must be an integer." })
        .nonnegative({
          message: "Primary vendor ID must be a positive number.",
        })
        .optional()
    ),

    province_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Province ID must be an integer." })
        .nonnegative({ message: "Province ID must be a positive number." })
        .optional()
    ),

    regency_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Regency ID must be an integer." })
        .nonnegative({ message: "Regency ID must be a positive number." })
        .optional()
    ),

    customer_tag_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Customer tag ID must be an integer." })
        .nonnegative({ message: "Customer tag ID must be a positive number." })
        .optional()
    ),

    entity_for_consumption: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Entity consumption ID must be an integer." })
        .nonnegative({
          message: "Entity consumption ID must be a positive number.",
        })
        .optional()
    ),

    entity_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Entity ID must be an integer." })
        .nonnegative({ message: "Entity ID must be a positive number." })
        .optional()
    ),

    entity_user_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Entity user ID must be an integer." })
        .nonnegative({ message: "Entity user ID must be a positive number." })
        .optional()
    ),
    parent_material_id: z.preprocess((value) => {
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = parseInt(value, 10)
        return isNaN(parsed) ? undefined : parsed
      }
      return typeof value === "number" ? value : undefined
    }, z.number().nonnegative().optional()),
  })

export const TransactionListCursorPaginatedRequestSchema =
  CursorPaginationQueriesSchema.extend({
    activity_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Activity ID must be an integer." })
        .nonnegative({ message: "Activity ID must be a positive number." })
        .optional()
    ),

    material_type_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Material type ID must be an integer." })
        .nonnegative({ message: "Material type ID must be a positive number." })
        .optional()
    ),

    material_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Material ID must be an integer." })
        .nonnegative({ message: "Material ID must be a positive number." })
        .optional()
    ),

    start_date: z.preprocess(
      (value) => {
        if (typeof value === "string") {
          return value.trim() === ""
            ? value
            : new Date(value.replace("+", " ")).toISOString()
        }
        return value
      },
      z
        .union([
          z.string().min(0),
          z.string().datetime({ message: "Invalid start date format." }),
        ])
        .optional()
    ),

    end_date: z.preprocess(
      (value) => {
        if (typeof value === "string") {
          return value.trim() === ""
            ? value
            : new Date(value.replace("+", " ")).toISOString()
        }
        return value
      },
      z
        .union([
          z.string().min(0),
          z.string().datetime({ message: "Invalid start date format." }),
        ])
        .optional()
    ),

    transaction_type_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Transaction type ID must be an integer." })
        .nonnegative({
          message: "Transaction type ID must be a positive number.",
        })
        .optional()
    ),

    transaction_reason_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Transaction reason ID must be an integer." })
        .nonnegative({
          message: "Transaction reason ID must be a positive number.",
        })
        .optional()
    ),

    is_order: z.preprocess((value) => {
      if (typeof value === "string") {
        return value === "1" || value === "0" ? value : undefined
      }
      return undefined
    }, z.string().optional()),

    order_type: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Order type must be an integer." })
        .nonnegative({ message: "Order type must be a positive number." })
        .optional()
    ),

    entity_tag_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Entity tag ID must be an integer." })
        .nonnegative({ message: "Entity tag ID must be a positive number." })
        .optional()
    ),

    primary_vendor_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Primary vendor ID must be an integer." })
        .nonnegative({
          message: "Primary vendor ID must be a positive number.",
        })
        .optional()
    ),

    province_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Province ID must be an integer." })
        .nonnegative({ message: "Province ID must be a positive number." })
        .optional()
    ),

    regency_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Regency ID must be an integer." })
        .nonnegative({ message: "Regency ID must be a positive number." })
        .optional()
    ),

    customer_tag_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Customer tag ID must be an integer." })
        .nonnegative({ message: "Customer tag ID must be a positive number." })
        .optional()
    ),

    entity_for_consumption: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Entity consumption ID must be an integer." })
        .nonnegative({
          message: "Entity consumption ID must be a positive number.",
        })
        .optional()
    ),

    entity_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Entity ID must be an integer." })
        .nonnegative({ message: "Entity ID must be a positive number." })
        .optional()
    ),

    entity_user_id: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }
        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Entity user ID must be an integer." })
        .nonnegative({ message: "Entity user ID must be a positive number." })
        .optional()
    ),
    parent_material_id: z.preprocess((value) => {
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = parseInt(value, 10)
        return isNaN(parsed) ? undefined : parsed
      }
      return typeof value === "number" ? value : undefined
    }, z.number().nonnegative().optional()),
  })

export const TransactionListDiscardRequestSchema =
  PaginationQueriesSchema.extend({
    entity_id: optionalNumber,
    activity_id: optionalNumber,
    start_date: z.string(),
    end_date: z.string(),
    material_type_id: optionalNumber,
    material_id: optionalNumber,
    transaction_reason_id: optionalNumber,
  })

export const TransactionListConsumptionSchema = PaginationQueriesSchema.extend({
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  customer_id: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  activity_id: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  material_id: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  material_type_id: z
    .string()
    .transform((val) => Number(val))
    .optional(),
})

export type TransactionListDiscardRequestDTO = z.infer<
  typeof TransactionListDiscardRequestSchema
>
/*
 * DTO - Request
 */
export type TransactionTypePaginatedRequestDTO = z.infer<
  typeof TransactionTypePaginatedRequestSchema
> & {
  isPaginate?: boolean
  language?: string
}

export type TransactionReasonPaginatedRequestDTO = z.infer<
  typeof TransactionReasonPaginatedRequestSchema
> & {
  isPaginate?: boolean
  language?: string
  programId?: number
}

export type TransactionListPaginatedRequestDTO = z.infer<
  typeof TransactionListPaginatedRequestSchema
> & {
  isPaginate?: boolean
  language?: string
  programId?: number
  timezone?: string
}

export type TransactionListCursorPaginatedRequestDTO = z.infer<
  typeof TransactionListCursorPaginatedRequestSchema
> & {
  language?: string
  programId?: number
  timezone?: string
}

export type SubmitReturnOfHealthFacilitiesRequest = z.infer<
  typeof SubmitReturnOfHealthFacilitiesTrxSchema
>

export interface AppMobileTransactionTypesDTO
  extends Selectable<Pick<WsTransactionTypes, "id" | "title">> {
  transaction_reasons: Selectable<
    Pick<WsTransactionReasons, "id" | "title" | "is_other" | "is_purchase">
  >[]
}

export type UpsertTransactionListDTO = Updateable<WsTransactionLists> & {
  discard?: DiscardDTO
}

export type GetTransactionListConsumptionQueries = z.infer<
  typeof TransactionListConsumptionSchema
>
