/* eslint-disable @typescript-eslint/no-explicit-any */
export type UpsertEntityCustomerIncomingMessage = {
  headers: any
  payload: {
    program_id: number
    entity_id: number
    customer_ids: number[]
    is_consumption: number
  }
}
