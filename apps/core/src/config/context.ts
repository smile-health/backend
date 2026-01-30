import { UserDto } from "@/modules/account/account.schema.js"
import { Client } from "@/modules/integration/integration.schema.js"
import { IContextVariableMap } from "@smile-health/lib/types/context.js"
import { FileResponse } from "@smile-health/lib/types/file.js"
import { DB } from "../common/infrastructure/database/types/db.js"

declare module "hono" {
  interface ContextVariableMap extends IContextVariableMap<DB> {
    accountID: number
    entityId: number | null
    role: number
    user: UserDto
    file: FileResponse
    language: string
    filePath?: string
    errors?: object
    role_label?: string
    resource_access?: Map<string, { roles: string[] }>
    roles?: string[]
    mapWsUserId: object
    client?: Client
    token: string
  }
}
