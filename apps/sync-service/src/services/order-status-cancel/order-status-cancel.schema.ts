/* eslint-disable @typescript-eslint/no-explicit-any */

export type DataOrderCancelIncomingMessage = {
  order_id: number
  cancel_reason: string
  reason_text: string
  comment: string
}

export type OrderCancelIncomingMessage = {
  headers: any
  payload: {
    data: DataOrderCancelIncomingMessage
    program_id: number
  }
}
