import { genders } from "@/common/constants/gender"
import { Context } from "hono"
import {
  GenderPaginatedRequestDTO,
  GenderSelectedColumns,
} from "./gender.schema"

export class GenderRepository {
  async findAll(
    c: Context,
    params: GenderPaginatedRequestDTO
  ): Promise<{ data: GenderSelectedColumns[]; total: number }> {
    let data = genders

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
