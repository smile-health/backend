/* eslint-disable @typescript-eslint/no-explicit-any */
export type OrderIncomingMessage = {
  headers: any
  payload: {
    id: number
    customer_id: number
    vendor_id: number
    activity_id: number
    required_date?: null | string
    order_items: OrderItemIncomingMessage[]
    order_comment?: null | string
    order_comment_id?: null | number
    program_id: number
    order_status_id: number
    order_type_id: number
  }
}

export type OrderItemIncomingMessage = {
  id: number
  ordered_qty: number
  material_id: number
  recommended_stock?: number | null
  order_reason_id?: number | null
  other_reason?: null | string
  order_stock_status_id?: number | null
}
