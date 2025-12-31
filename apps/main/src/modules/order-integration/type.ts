import {
  IntegrationLogs,
  WsUsers,
} from "@/common/infrastructure/database/types/db.js"
import { Insertable, Selectable } from "kysely"

export interface Payload {
  order_id: number
  retry?: boolean
  id?: number
  letter_number?: number | string
  comment?: string | undefined | null
  fulfilled_at?: string
}
export interface CanValidateOrder {
  validateOrder(data: object): Promise<Result>
}

export interface CanReceiveOrder {
  receiveOrder(data: object): Promise<Result>
}

export interface CanCancelOrder {
  cancelOrder(data: object): Promise<Result>
}

export function canValidateOrder(client: unknown): client is CanValidateOrder {
  return typeof (client as CanValidateOrder).validateOrder === "function"
}

export function canReceiveOrder(client: unknown): client is CanReceiveOrder {
  return typeof (client as CanReceiveOrder).receiveOrder === "function"
}

export function canCancelOrder(client: unknown): client is CanCancelOrder {
  return typeof (client as CanCancelOrder).cancelOrder === "function"
}

export type Action = "validate" | "receive" | "cancel"

type Override<Base, Changes> = Omit<Base, keyof Changes> & Changes

export type InsertLogRequest = Override<
  Insertable<IntegrationLogs>,
  {
    request: object
    response: object
  }
>

export type RequestLog = {
  method: string
  url: string
  body: object
}

export type ResponseLog = {
  status?: number
  body: string
  error?: Error
}

export type Request = {
  user?: Selectable<WsUsers>
  payload: unknown
  order: { metadata: unknown }
  items: { qty: number; validated_qty: number; metadata: unknown }[]
}
export type Result = {
  request: RequestLog
  response: ResponseLog
}

export type ClientConfig = {
  endpoints: object
  credentials: object
}
