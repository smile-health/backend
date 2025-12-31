import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { BatchRepository } from "./batch.repository.js"
import { GetListBatchQueries } from "./batch.schema.js"

export class BatchModule {
  constructor(private readonly repository: BatchRepository) {}

  async list(c: Context, param: GetListBatchQueries) {
    const programId = c.var.programId
    const { list, total } = await this.repository.findListBatch(
      c,
      param,
      programId
    )
    return new PaginatedResponse(param, list, total)
  }
}
