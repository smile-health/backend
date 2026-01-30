import { DB, Entities } from "@/common/infrastructure/database/types/db"
import { IContextVariableMap } from "@smile-health/lib/types/context"
import { Context } from "hono"
import { Selectable } from "kysely"

export interface EntityContextVariableMap extends IContextVariableMap<DB> {
  entity: Selectable<Entities>
}

export type EntityContext = Context<{ Variables: EntityContextVariableMap }>
