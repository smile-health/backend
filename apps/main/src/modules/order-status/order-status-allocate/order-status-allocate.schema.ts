import z from "zod"
import { IdParamsSchema } from "@smile/lib/types/param.js"

/* Base Schema */
export const OrderStatusAllocateSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  order_status_id: z.number().positive(),
  order_stock_status_id: z.number().positive().nullish(),
  order_item_kfa_id: z.number().positive().nullish(),
  stock_id: z.number().positive(),
  material_id: z.number().positive().optional(),
  allocated_qty: z.number().nonnegative(),
  allocated_by: z.number().positive(),
  is_allocated: z.number(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  allocated_at: z.date(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
  user_id: z.number().positive(),
})

/* Request Body Schema */
const nonHierarchySchema = OrderStatusAllocateSchema.pick({
  id: true,
}).extend({
  allocations: z.array(
    OrderStatusAllocateSchema.pick({
      order_stock_status_id: true,
      stock_id: true,
      allocated_qty: true,
    })
  ),
})

const AllocationSchema = z.object({
  stock_id: z.number(),
  allocated_qty: z.number(),
  order_stock_status_id: z.number().positive().nullish(),
})

const ChildTypeA = z.object({
  id: z.number(),
  allocations: z.array(AllocationSchema).optional(),
})

const ChildTypeB = z.object({
  order_item_kfa_id: z.number(),
  material_id: z.number(),
  allocated_qty: z.number(),
  recommended_stock: z.number(),
  order_reason_id: z.number().optional(),
  allocations: z.array(AllocationSchema).optional(),
})

const ChildSchema = z.union([ChildTypeA, ChildTypeB])

const hierarchySchema = z.object({
  id: z.number(),
  children: z.array(ChildSchema).optional(),
})

const OrderSchema = z.object({
  order_items: z.array(z.union([nonHierarchySchema, hierarchySchema])),
  comment: z.string().nullish(),
})

export const ChangeOrderStatusAllocateRequestSchema = OrderSchema

export const ChangeOrderItemStockAllocateRequestSchema =
  OrderStatusAllocateSchema.pick({
    id: true,
    stock_id: true,
    order_stock_status_id: true,
    order_item_kfa_id: true,
    material_id: true,
    allocated_qty: true,
    updated_by: true,
    updated_at: true,
  })

/* DTO Schema */
export const ChangeOrderItemStockAllocateDTOSchema =
  ChangeOrderItemStockAllocateRequestSchema.omit({
    id: true,
    material_id: true,
    order_item_kfa_id: true,
  })

export const AddOrderItemStockAllocateDTOSchema =
  ChangeOrderItemStockAllocateRequestSchema.omit({
    id: true,
  }).merge(
    OrderStatusAllocateSchema.pick({
      material_id: true,
      order_id: true,
      order_item_kfa_id: true,
    })
  )

export const ChangeOrderStatusAllocateDTOSchema =
  OrderStatusAllocateSchema.pick({
    order_status_id: true,
    is_allocated: true,
    updated_by: true,
    updated_at: true,
  })

export const AddOrderHistoryAllocateDTOSchema = OrderStatusAllocateSchema.pick({
  order_id: true,
  order_status_id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const UpdateOrderAuditAllocateDTOSchema = OrderStatusAllocateSchema.pick(
  {
    allocated_at: true,
    updated_at: true,
    allocated_by: true,
    updated_by: true,
  }
)

export const ChangeStockAllocateDTOSchema = OrderStatusAllocateSchema.pick({
  allocated_qty: true,
  updated_by: true,
  updated_at: true,
})

export const AddOrderCommentAllocateDTOSchema = OrderStatusAllocateSchema.pick({
  order_id: true,
  user_id: true,
  order_status_id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
}).extend({
  comment: z.string().nullish(),
})

/* Path Params Schema */
export const GetDetailOrderSchema = IdParamsSchema

/* Request Body Type */
export type ChangeOrderStatusAllocateRequest = z.infer<
  typeof ChangeOrderStatusAllocateRequestSchema
>

export type ChangeOrderItemStockAllocateRequest = z.infer<
  typeof ChangeOrderItemStockAllocateRequestSchema
>

/* DTO Type */
export type ChangeOrderItemStockAllocateDTO = z.infer<
  typeof ChangeOrderItemStockAllocateDTOSchema
>

export type AddOrderItemStockAllocateDTO = z.infer<
  typeof AddOrderItemStockAllocateDTOSchema
>

export type ChangeOrderStatusAllocateDTO = z.infer<
  typeof ChangeOrderStatusAllocateDTOSchema
>

export type AddOrderHistoryAllocateDTO = z.infer<
  typeof AddOrderHistoryAllocateDTOSchema
>

export type UpdateOrderAuditAllocateDTO = z.infer<
  typeof UpdateOrderAuditAllocateDTOSchema
>

export type ChangeStockAllocateDTO = z.infer<
  typeof ChangeStockAllocateDTOSchema
>

export type AddOrderCommentAllocateDTO = z.infer<
  typeof AddOrderCommentAllocateDTOSchema
>
