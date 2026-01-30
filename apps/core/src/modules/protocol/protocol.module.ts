import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { ProtocolRepository } from "./protocol.repository.js"
import { GetProtocolQueries } from "./protocol.schema.js"

export class ProtocolModule {
  constructor(private readonly protocolRepo: ProtocolRepository) { }

  async list(c: Context, param: GetProtocolQueries) {
    const {data, total} = await this.protocolRepo.findAll(c, param)
    return new PaginatedResponse(param, data, total)
  }
}
