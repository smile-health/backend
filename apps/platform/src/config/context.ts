import { IContextVariableMap } from "@smile/lib/types/context.js"
import { FileResponse } from "@smile/lib/types/file.js"
import { WorkspaceConfig } from "@smile/lib/types/jwt.js"
import { Database } from "../common/infrastructure/database/types/index.js"

declare module "hono" {
  interface ContextVariableMap extends IContextVariableMap<Database> {
    file?: FileResponse
    config?: WorkspaceConfig
    userId?: number
    workspaceId?: number
    filePath?: string
    language: string
    errors?: object
  }
}
