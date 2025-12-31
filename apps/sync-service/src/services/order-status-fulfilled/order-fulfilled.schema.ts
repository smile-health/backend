/* eslint-disable @typescript-eslint/no-explicit-any */
export type OrderFulfilledIncomingMessage = {
  headers: any
  payload: {
    data: Root
    program_id: number
  }
}

export interface Root {
  order_id: number
  comment: string
  fulfilled_at: string
  order_items: OrderItem[]
}

export interface OrderItem {
  id: number
  material_id: number
  order_stock_fulfill: OrderStockFulfill[]
}

export interface OrderStockFulfill {
  order_stock_ids: number[]
  stock_id: number
  batch_id: number
  status: any
  fulfill_reason: any
  other_reason: any
  received_qty: number
}
