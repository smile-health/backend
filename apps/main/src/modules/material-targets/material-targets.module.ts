import { Context } from "hono"
import { MaterialTargetsRepository } from "./material-targets.repository.js"
import { MaterialTargetsPaginatedRequestDTO } from "./material-targets.schema.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"

export class MaterialTargetsModule {
  constructor(
    private readonly materialTargetsRepository: MaterialTargetsRepository
  ) {}

  async list(c: Context, params: MaterialTargetsPaginatedRequestDTO) {
    const { list, total } =
      await this.materialTargetsRepository.getListMaterialTargets(c, params)

    return new PaginatedResponse(params, list, total)
  }
}
