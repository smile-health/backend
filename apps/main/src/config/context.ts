import { Datamart } from "@/common/infrastructure/database/types/datamart.js"
import {
  IntegrationClients,
  WsEntities,
  WsUsers,
} from "@/common/infrastructure/database/types/db.js"
import { ElasticSearchQuery } from "@/common/infrastructure/elastic/client.js"
import { IndexMapping } from "@/common/infrastructure/elastic/types/db.js"
import { IContextVariableMap } from "@smile/lib/types/context.js"
import { FileResponse } from "@smile/lib/types/file.js"
import { WorkspaceConfig } from "@smile/lib/types/jwt.js"
import { Kysely, Selectable } from "kysely"
import { Database } from "../common/infrastructure/database/types/index.js"
declare module "hono" {
  interface ContextVariableMap extends IContextVariableMap<Database> {
    datamart: Kysely<Datamart>
    slave: Kysely<Database>
    risingwave: Kysely<any>
    file?: FileResponse
    config?: WorkspaceConfig
    userId?: number
    programId: number
    activityIds: number[]
    filePath?: string
    language: string
    errors?: object
    keycloakUUID?: string
    resource_access?: object
    roles?: string[]
    user?: Selectable<WsUsers> & { program_name: string }
    userEntity: Selectable<WsEntities>
    client: Selectable<IntegrationClients>
    roleId?: number
    entityId?: number
    elastic: ElasticSearchQuery<IndexMapping>
    deviceType: number
    activityId: number | null | undefined
    timeZone: string // IANA timezone string, e.g., "Asia/Jakarta", default "Etc/UTC"
    token: string
  }
}
