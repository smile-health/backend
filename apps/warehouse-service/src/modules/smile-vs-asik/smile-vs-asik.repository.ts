import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import {
  SmileVsAsikQueryParams,
  SmileDataDTO,
  AsikDataDTO,
  LastUpdatedDTO,
} from "./smile-vs-asik.schema.js"
import { SmileVsAsikQuery } from "./smile-vs-asik.query.js"

export class SmileVsAsikRepository {
  constructor(private readonly smileVsAsikQuery: SmileVsAsikQuery) {}

  async fetchSmileData(
    c: Context,
    queryParams: SmileVsAsikQueryParams
  ): Promise<SmileDataDTO[]> {
    const query = this.smileVsAsikQuery.buildSmileQtyQuery(c, queryParams)

    const result = await execQuery<SmileDataDTO[]>(query, {
      ...queryParams,
    })

    return result
  }

  async fetchAsikData(
    c: Context,
    queryParams: SmileVsAsikQueryParams
  ): Promise<AsikDataDTO[]> {
    const query = this.smileVsAsikQuery.buildAsikQtyQuery(c, queryParams)

    const result = await execQuery<AsikDataDTO[]>(query, {
      ...queryParams,
    })

    return result
  }

  async fetchLastUpdated(): Promise<LastUpdatedDTO | null> {
    const query = this.smileVsAsikQuery.buildLastUpdatedQuery()
    const result = await execQuery<LastUpdatedDTO[]>(query)
    return result[0] || null
  }
}
