import { Context } from "hono"
import { TemperatureThresholdRepository } from "./temperature-threshold.repository"
import { GetTemperatureThresholdsQueryParams } from "./temperature-threshold.schema"
import { PaginatedResponse } from "@smile-health/lib/types/paginate"

export class TemperatureThresholdModule {
  constructor(private readonly repository: TemperatureThresholdRepository) {}

  async list(c: Context, params: GetTemperatureThresholdsQueryParams) {
    const { data, total } = await this.repository.list(c, params)

    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    return new PaginatedResponse(params, data, total)
  }
}
