import { IContextVariableMap } from "@smile-health/lib/types/context.js"
import { FileResponse } from "@smile-health/lib/types/file.js"
import { DB } from "../common/infrastructure/database/types/db.js"

declare module "hono" {
  interface ContextVariableMap extends IContextVariableMap<DB> {
    programId: number
    language: string
    deviceId?: number
    roleId?: number
    file?: FileResponse
  }
}
