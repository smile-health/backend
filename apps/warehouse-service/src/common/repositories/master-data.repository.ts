import pluralize from "pluralize"
import { execQuery } from "../infrastructure/database/index.js"

export type MasterDataType =
  | "asset_type"
  | "asset_electricity"
  | "asset_classification"
  | "asset_model"
  | "asset_vendor"
  | "manufacture"
  | "asset_working_status"
  | "entity"
export interface MasterData {
  id: number
  name: string
}

export class MasterDataRepository {
  constructor() {}

  async fetchDataByIds(dataType: MasterDataType, ids?: number[]) {
    if (!ids || ids.length === 0) return []

    const tablename = `raw_${pluralize.plural(dataType)}`
    return await execQuery<MasterData[]>(
      `SELECT id, name FROM ${tablename} FINAL WHERE id IN {ids:Array(Int64)}`,
      { ids }
    )
  }

  async fetchAllData(dataType: MasterDataType) {
    const tablename = `raw_${pluralize.plural(dataType)}`
    return await execQuery<MasterData[]>(
      `SELECT id, name FROM ${tablename} FINAL WHERE deleted_at IS NULL`
    )
  }
}
