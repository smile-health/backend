import { WsTransactionLists, WsTransactions } from "../../database/types/db.js"
export interface IndexMapping {
  transactions: WsTransactions
  transaction_lists: ESTransactions
}

export type ESTransactions = WsTransactionLists.Omit<
  "material_is_managed_in_batch",
  "transaction_reason_is_other",
  "transaction_reason_is_purchase",
  "batch_status"
> & {
  material_is_managed_in_batch: boolean,
  transaction_reason_is_other: boolean,
  transaction_reason_is_purchase: boolean,
  batch_status: boolean,}
