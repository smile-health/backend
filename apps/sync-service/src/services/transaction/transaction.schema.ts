import { WsTransactionLists } from "@/scripts/types.platform.js"
import { Selectable } from "kysely"

export type trxMessages = Selectable<WsTransactionLists> & {
  transaction_ids: number[] | undefined
  discard?: {
    id: number
    qty: number
    reason_id: number | null
  }
  rabies?: {
    is_other_sequence?: boolean
    vaccine_method?: number
    patients?: {
      identity_type: number
      identity_number: string
      phone_number: string | null
      vaccine_sequence: number
      other_sequences?: {
        actual_transaction_date: Date
        vaccine_sequence: number
      }[]
    }[]
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type CreateTransactionIncomingMessage = {
  headers: any
  payload: trxMessages[]
}

// map platform transaction type to existing transaction type
export const MAP_TRANSACTION_TYPE = {
  1: {
    10: 2, // Consumption
    11: 9, // Cancellation Discard
  },
  2: {
    10: 2, // Consumption
  },
}

// map platform rabies vaccine seq to existing vaccine seq
export const MAP_RABIES_SEQUENCE = {
  1: 6,
  2: 7,
  3: 6,
  4: 7,
  5: 1,
  6: 2,
  7: 3,
  8: 1,
  9: 8,
  10: 2,
  11: 4,
  12: 5,
  13: 4,
  14: 5,
}
