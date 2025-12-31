import { maritalStatus } from "@/common/constants/marital-status.js"
import { Context } from "hono"
import {
  MaritalStatusPaginatedRequestDTO,
  MaritalStatusSelectedColumns,
} from "./marital-status.schema"

export class MaritalStatusRepository {
  async findAll(
    c: Context,
    params: MaritalStatusPaginatedRequestDTO
  ): Promise<{ data: MaritalStatusSelectedColumns[]; total: number }> {
    let data = maritalStatus

    if (params.keyword) {
      data = data.filter((el) =>
        el.title.toLowerCase().includes(params.keyword!.toLowerCase())
      )
    }

    return {
      data: data,
      total: data.length,
    }
  }
}
