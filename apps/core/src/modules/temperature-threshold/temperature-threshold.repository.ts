import { Context } from "hono"
import { BaseRepository } from "../base.repository"
import { GetTemperatureThresholdsQueryParams } from "./temperature-threshold.schema"

export class TemperatureThresholdRepository extends BaseRepository<"temperature_thresholds"> {
  constructor() {
    super("temperature_thresholds")
  }
  async list(c: Context, params: GetTemperatureThresholdsQueryParams) {
    let query = c.var.trx
      .selectFrom("temperature_thresholds")
      .where("deleted_at", "is", null)
      .select(["id", "min_temperature", "max_temperature", "is_predefined"])

    if (params.is_predefined !== null) {
      if (params.is_predefined === 0) {
        query = query.where("is_predefined", "=", 0)
      } else if (params.is_predefined === 1) {
        query = query.where("is_predefined", "=", 1)
      } else if (params.is_predefined === 2) {
        query = query.where("is_predefined", "=", 2)
      }
    }

    const offset = (params.page - 1) * params.paginate
    const isPaginate = !!params.page && !!params.paginate

    const [list, count] = await Promise.all([
      query
        .$if(isPaginate, (qb) => qb.limit(params.paginate).offset(offset))
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return { data: list, total: Number(count.total) }
  }
}
