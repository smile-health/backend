export type OrderStatusShippedIncomingMessage = {
  headers: any
  payload: {
    data: {
      id: number
      comment: string
      estimated_date: string
      taken_by_customer: number
      sales_ref: string
      order_id: number
    }
    program_id: number
  }
}
