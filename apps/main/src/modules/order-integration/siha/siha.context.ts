import { ChangeOrderStatusCancelRequest } from "@/modules/order-status/order-status-cancel/order-status-cancel.schema.js"
import { ChangeOrderStatusConfirmRequest } from "@/modules/order-status/order-status-confirm/order-status-confirm.schema.js"
import { CreateOrderRequest } from "@/modules/order/order.schema.js"
import { Context } from "hono"
import { AppContextVariableMap } from "../context.js"

export interface SihaContextVariableMap extends AppContextVariableMap {
  createRequest: CreateOrderRequest
  confirmRequest: ChangeOrderStatusConfirmRequest
  cancelRequest: ChangeOrderStatusCancelRequest
}

export type SihaContext = Context<{ Variables: SihaContextVariableMap }>
