import { WsEntityMaterialActivities } from "@/scripts/types.platform.js"
import { Selectable } from "kysely"

/* eslint-disable @typescript-eslint/no-explicit-any */
export type UpsertEntityMaterialIncomingMessage = {
  headers: any
  payload: {
    program_id: number
    is_hierarchy: boolean
  } & Selectable<WsEntityMaterialActivities>
}

export type DeleteEntityMaterialIncomingMessage = {
  headers: any
  payload: {
    program_id: number
    is_hierarchy: boolean
    id: number
  }
}
