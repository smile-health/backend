import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { WorkspaceRepository } from "./workspace.repository.js"
import { GetWorkspacesParams } from "./workspace.schema.js"

export class WorkspaceModule {
  constructor(private readonly repository: WorkspaceRepository) {}

  async getList(c: Context, queryParam: GetWorkspacesParams) {
    const { data, total } = await this.repository.findAll(c, queryParam)
    return new PaginatedResponse(queryParam, data, Number(total))
  }
}
