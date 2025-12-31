import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import z from "zod"

export type ListUserShipmentDTO = {
  id: number
  firstname: string | null
  lastname: string | null
}

export type LocationUserShipmentDTO =
  | {
    province_id: string | null
    regency_id: string | null
    sub_district_id: string | null
    village_id: string | null
  }
  | undefined

const preprocessToString = (value: unknown) =>
  typeof value === "number" ? String(value) : value

/* Shipment Main Schema */
export const ShipmentSchema = z.object({
  id: z.number().positive(),
  activity_id: z.number().positive(),
  customer_id: z.number().positive(),
  vendor_id: z.number().positive(),
  status: z.number().positive(),
  type: z.number().positive(),
  no_document: z.preprocess(
    preprocessToString,
    z.string().min(1).max(255).nullish()
  ),
  comments: z.preprocess(preprocessToString, z.string().max(1000).nullish()),
  shipped_at: z.date().nullish(),
  fulfilled_at: z.date().nullish(),
  cancelled_at: z.date().nullish(),
  created_by: z.number().positive(),
  updated_by: z.number().positive().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
})

/* Shipment Item Schema */
export const ShipmentItemSchema = z.object({
  id: z.number().positive(),
  disposal_shipment_id: z.number().positive(),
  material_id: z.number().positive(),
  qty: z.number(),
  confirmed_qty: z.number().nullish(),
  notes: z.string().nullish(),
  created_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
})

/* Shipment Stock Schema */
export const ShipmentStockSchema = z.object({
  id: z.number().positive(),
  disposal_shipment_item_id: z.number().positive(),
  stock_id: z.number().positive(),
  batch_id: z.number().nullish(),
  activity_id: z.number().nullish(),
  stock_qty: z.number().nullish(),
  received_qty: z.number().nullish(),
  discard_qty: z.number().nullish(),
  transaction_reason_id: z.number().nullish(),
  created_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
})

/* Shipment Comment Schema */
export const ShipmentCommentSchema = z.object({
  id: z.number().positive(),
  disposal_shipment_id: z.number().positive(),
  comment: z.string().nullish(),
  status: z.number().nullish(),
  user_id: z.number().positive(),
  created_at: z.date(),
})

/* Query Params Schema */
export const GetListShipmentSchema = z.object({
  activity_id: z.string().optional(),
  status: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  shipped_number: z.string().optional(),
  purpose: z.string().optional(),
  page: z.string().optional(),
  paginate: z.string().optional(),
  is_vendor: z.string().optional(),
  customer_id: z.string().optional(),
  entity_id: z.string().optional(),
  entity_tag_id: z.string().optional(),
  vendor_id: z.string().optional(),
  province_id: z.string().optional(),
  regency_id: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
})

/* New Schema: copy all except limit and offset, then add 'type' */
export const GetStatusCountSchema = GetListShipmentSchema
  .omit({ limit: true, offset: true })
  .extend({
    type: z.string().optional()
})

/* Request Body Schema for Create - Updated to match API spec */
export const CreateDisposalStockSchema = z.object({
  disposal_stock_id: z.number().positive(),
  transaction_reasons: z.object({
    id: z.number().positive(),
  }).optional(),
  received_qty: z.number().min(0).optional(),
  discard_qty: z.number().min(0).optional(),
})

export const CreateStockSchema = z.object({
  stock_id: z.number().positive(),
  batch: z.object({
    id: z.number().positive(),
    code: z.string(),
  }).nullable().optional(),
  activity_id: z.number().positive(),
  stock_qty: z.number().min(0),
  disposal_stocks: z.array(CreateDisposalStockSchema),
})

export const CreateShipmentItemSchema = z.object({
  material_id: z.number().positive(),
  shipment_qty: z.number().min(0),
  stocks: z.array(CreateStockSchema),
})

export const CreateShipmentRequestSchema = z.object({
  activity_id: z.number().positive(),
  vendor_id: z.number().min(1),
  customer_id: z.number().min(1),
  no_document: z.string().optional(),
  disposal_comments: z.string().optional(),
  flow_id: z.number().positive().default(1),
  is_allocated: z.number().min(0).max(1).default(1),
  type: z.number().positive().default(5),
  disposal_items: z.array(CreateShipmentItemSchema),
})

/* Accept Shipment Schema */
export const AcceptShipmentItemSchema = z.object({
  disposal_shipment_item_id: z.number().positive(),
  confirmed_qty: z.number().min(0),
  stocks: z.array(z.object({
    disposal_shipment_stock_id: z.number().positive(),
    received_qty: z.number().min(0),
  })),
})

export const AcceptShipmentRequestSchema = z.object({
  comment: z.string().nullable().optional(),
  items: z.array(AcceptShipmentItemSchema),
})

export const CommentShipmentRequestSchema = z.object({
  comment: z.string().min(1),
})

/* Cancel Shipment Schema */
export const CancelShipmentRequestSchema = z.object({
  comment: z.string().nullable().optional(),
})

/* Path Params Schema */
export const GetDetailShipmentSchema = IdParamsSchema

/* Query Params Type */
export type GetShipmentQueries = z.infer<typeof GetListShipmentSchema>
export type GetStatusCountQueries = z.infer<typeof GetStatusCountSchema>

/* Request Body Types */
export type CreateShipmentRequest = z.infer<typeof CreateShipmentRequestSchema>
export type AcceptShipmentRequest = z.infer<typeof AcceptShipmentRequestSchema>
export type CommentShipmentRequest = z.infer<typeof CommentShipmentRequestSchema>
export type CancelShipmentRequest = z.infer<typeof CancelShipmentRequestSchema>

/* Entity Types */
export type ShipmentItem = z.infer<typeof ShipmentItemSchema>
export type ShipmentStock = z.infer<typeof ShipmentStockSchema>
export type ShipmentComment = z.infer<typeof ShipmentCommentSchema>

/* Utility Types */
export type RowType = string | number | Date | null

/* Status Constants */
export const DISPOSAL_SHIPMENT_STATUS = {
  PENDING: 1,
  CONFIRMED: 2,
  ALLOCATED: 3,
  SHIPPED: 4,
  FULFILLED: 5,
  CANCELLED: 6,
} as const

export type DisposalShipmentStatus = typeof DISPOSAL_SHIPMENT_STATUS[keyof typeof DISPOSAL_SHIPMENT_STATUS]
