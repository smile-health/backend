/* eslint-disable @typescript-eslint/no-explicit-any */
export type ActivityIncomingMessage = {
  headers: any
  payload: {
    id: number
    program_id: number
    name: string
    is_ordered_sales: number
    is_ordered_purchase: number
  }
}
