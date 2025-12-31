import { AssetInfo } from "./wms/wms.schema"

export type RequestLog = {
  method: string
  url: string
  body?: object
}

export type ResponseLog = {
  status?: number
  body: string | unknown
  error?: Error
}

export type Result = {
  request: RequestLog
  response: ResponseLog
}

export type ClientConfig = {
  endpoints: object
  client_uuid: string // keycloak client uuid
  client_role_id: number
  use_ssl: boolean
}

export interface Client {
  getId(): number
  getKey(): string
  getUUID(): string // get keycloak client uuid
  getRoleId(): number // get smile role id
}

export interface CanGetRoles {
  getRoles(): Promise<Result>
}

export interface CanSyncAsset {
  syncAsset(token: string, payload: AssetInfo): Promise<Result>
}

export function canGetRoles(client: unknown): client is CanGetRoles {
  return typeof (client as CanGetRoles).getRoles === "function"
}

export function canSyncAsset(client: unknown): client is CanSyncAsset {
  return typeof (client as CanSyncAsset).syncAsset === "function"
}
