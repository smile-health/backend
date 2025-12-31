/* eslint-disable @typescript-eslint/no-explicit-any */
export type OrderStatusConfirmIncomingMessage = {
  headers: any
  payload: {
    data: ListOrderStatusConfirmIncomingMessage[]
    program_id: number
  }
}

export type ListOrderStatusConfirmIncomingMessage = {
  id: number
  comment_id?: number | null
  order_id: number
  ordered_qty: number
  material_id: number
  qty?: number | null
  confirmed_qty?: number | null
  comment?: string | null
}
