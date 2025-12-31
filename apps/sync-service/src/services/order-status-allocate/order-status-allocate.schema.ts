/* eslint-disable @typescript-eslint/no-explicit-any */
export type OrderStatusAllocateIncomingMessage = {
  headers: any
  payload: {
    data: ListOrderStatusAllocateIncomingMessage[]
    program_id: number
  }
}

export type ListOrderStatusAllocateIncomingMessage = {
  order_id: number
  allocated_qty: number
  stock_id: number
  order_stock_status_id: number
  order_item_stock_id: number
}
