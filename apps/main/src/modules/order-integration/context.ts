import { DB } from "@/common/infrastructure/database/types/db.js"
import { IContextVariableMap } from "@smile/lib/types/context.js"
import { Context } from "hono"

export interface AppContextVariableMap extends IContextVariableMap<DB> {
  orderId: number
  requestType: string
  validate: string
}

export type AppContext = Context<{ Variables: AppContextVariableMap }>
