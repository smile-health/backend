import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { EntityVendorRepository } from "./entity-vendor.repository.js"
import { GetEntitiesVendorsQueries } from "./entity-vendor.schema.js"

export class EntityVendorModule {
  constructor(private entityVendorRepo: EntityVendorRepository) { }

  async list(c: Context, params: GetEntitiesVendorsQueries, id: number) {
    const [listEntity, totalEntityVendor] = await Promise.all([
      this.entityVendorRepo.getListEntityVendor(c, id, params),
      this.entityVendorRepo.getTotalCountEntityVendor(c, id, params),
    ])

    const parsedListEntity = listEntity.map((entity) => {
      return {
        id: `${entity.id}`,
        name: entity.name || "-",
        address: entity.address || "-",
        location: entity.location || "-",
        activity: entity.activity || "-",
      }
    })

    return new PaginatedResponse(params, parsedListEntity, totalEntityVendor)
  }
}
