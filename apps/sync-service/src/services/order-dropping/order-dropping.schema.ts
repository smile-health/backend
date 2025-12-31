/* eslint-disable @typescript-eslint/no-explicit-any */
export type OrderDroppingIncomingMessage = {
  headers: any
  payload: {
    id: number
    customer_code: string
    vendor_code: string
    activity_id: number
    is_alocated?: null | number
    is_manual?: null | number
    required_date?: null | string
    order_items: OrderItemDroppingIncomingMessage[]
    order_comment?: null | string
    order_comment_id?: null | number
    program_id: number
    order_status_id: number
    order_type_id: number
    po_number?: null | string
    do_number?: null | string
    delivery_type_id?: null | number
    batchCodeMapping?: { [key: string]: string }[]
  }
}

export type OrderItemDroppingIncomingMessage = {
  id: number
  material_id: number
  material_code: string
  material_managed_by_batch: number
  stocks: {
    id?: null | number
    qty: number
    activity_id: number
    batch: {
      code: string
      production_date: string // or `Date`
      expired_date: string // or `Date`
      manufacture: {
        id: number
        name: string
        address: string
      }
    }
    budget_source?: {
      id: number
      name: number
    } | null
    budget_year: null | string
    total_price?: null | number
  }[]
}
