import { Context } from "hono"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { DisposalMethodsRepository } from "./disposal-methods.repository.js"
import {
  GetDisposalMethodsQueryParam,
  DisposalMethodResponse,
} from "./disposal-methods.schema.js"

export class DisposalMethodsModule {
  constructor(
    private readonly disposalMethodsRepo: DisposalMethodsRepository
  ) {}

  async list(c: Context, param: GetDisposalMethodsQueryParam) {
    const [listDisposalMethods, totalDisposalMethods] = await Promise.all([
      this.disposalMethodsRepo.getListDisposalMethods(c, param),
      this.disposalMethodsRepo.getTotalCountDisposalMethods(c, param),
    ])

    const mappedDisposalMethods: DisposalMethodResponse[] =
      listDisposalMethods.map((method) => ({
        id: method.id,
        title: c.var.t(`disposal_method.${method.title}`),
      }))

    return new PaginatedResponse(
      param,
      mappedDisposalMethods,
      totalDisposalMethods
    )
  }
}
