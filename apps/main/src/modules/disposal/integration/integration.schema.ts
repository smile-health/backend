export type ClientConfig = {
  endpoints: object
  use_ssl: boolean
}

export interface Client {
  getClientId(): number
}

export interface CanGetRoles {
  getRoles()
}

export function canGetRoles(client: unknown): client is CanGetRoles {
  return typeof (client as CanGetRoles).getRoles === "function"
}

export interface CanCreateBast {
  createBast(token: string, payload: object)
}

export function canCreateBast(client: unknown): client is CanCreateBast {
  return typeof (client as CanCreateBast).createBast === "function"
}

export interface CanGetBast {
  getBast(token: string, payload: object)
}

export function canGetBast(client: unknown): client is CanGetBast {
  return typeof (client as CanGetBast).getBast === "function"
}

export interface CanCancelBast {
  cancelBast(payload: object)
}

export function canCancelBast(client: unknown): client is CanCancelBast {
  return typeof (client as CanCancelBast).cancelBast === "function"
}
