export type OrderItemIncomingMessage = {
  headers: any
  payload: {
    order_items: OrderItem[]
    program_id: number
  }
}

export type OrderItem = {
  id: number
  order_id: number
  order_item_kfa_id: number
  material_id: number
  stock_id: number
  order_stock_status_id: number
  qty: number | null
  ordered_qty: number | null
  allocated_qty: number | null
  confirmed_qty: number | null
  received_qty: number | null
  recommended_stock?: number
  order_reason_id?: number
  fulfill_reason: number | null
  fulfill_status: number | null
  qrcode: string | null
  code?: string
}
