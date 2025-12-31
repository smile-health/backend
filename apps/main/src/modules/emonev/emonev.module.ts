import { Context } from "hono"
import {
  EmonevProvinceParams,
  EmonevRegencyParams,
  EmonevRepository,
} from "./emonev.repository.js"
import {
  GetEmonevProvinceQueries,
  GetEmonevRegencyQueries,
} from "./emonev.schema.js"

export class EmonevModule {
  constructor(private readonly repository: EmonevRepository) {}

  async getProvince(c: Context, params: GetEmonevProvinceQueries) {
    const date_cutoff =
      params.date_cutoff ?? new Date().toISOString().slice(0, 10)

    const { year, code } = params

    const finalParams: EmonevProvinceParams = {
      year,
      code,
      date_cutoff,
    }

    const result = await this.repository.getProvinceData(c, finalParams)

    return result
  }

  async getRegency(c: Context, params: GetEmonevRegencyQueries) {
    const date_cutoff =
      params.date_cutoff ?? new Date().toISOString().slice(0, 10)

    const { year, code } = params

    const finalParams: EmonevRegencyParams = {
      year,
      code,
      date_cutoff,
    }

    const result = await this.repository.getRegencyData(c, finalParams)

    return result
  }
}
