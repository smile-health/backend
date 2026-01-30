import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { EntityVendorRepository } from "./entity-vendor.repository.js"
import { GetEntitiesVendorsQueries } from "./entity-vendor.schema.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { IS_RELOCATION } from "@/common/constants/order.js"

export class EntityVendorModule {
  constructor(private readonly entityVendorRepo: EntityVendorRepository) {}

  async list(c: Context, params: GetEntitiesVendorsQueries, id: number) {
    let listEntity: {
      address: string | null
      id: number
      name: string | null
      location: string
      activity: string
    }[] = []

    if (
      params.is_relocation === IS_RELOCATION.TRUE &&
      params.activity_id &&
      (c.var.roleId === USER_ROLE.OPERATOR ||
        c.var.roleId === USER_ROLE.MANAGER ||
        c.var.roleId === USER_ROLE.ADMIN)
    ) {
      listEntity = await this.entityVendorRepo.getListEntityVendorSameLevel(
        c,
        c.var.userEntity?.id,
        params,
        c.get("programId"),
        c.var.userEntity?.country ?? "ID",
        Number(c.var.userEntity?.province_id),
        Number(c.var.userEntity?.regency_id),
        Number(c.var.userEntity?.sub_district_id)
      )
    } else if (
      params.is_relocation === IS_RELOCATION.TRUE &&
      params.activity_id
    ) {
      const entity = await this.entityVendorRepo.getEntityById(
        c,
        id,
        c.get("programId")
      )

      listEntity = await this.entityVendorRepo.getListEntityVendorSameLevel(
        c,
        id,
        params,
        c.get("programId"),
        entity?.country ?? "ID",
        Number(entity?.province_id),
        Number(entity?.regency_id),
        Number(entity?.sub_district_id)
      )
    } else {
      listEntity = await this.entityVendorRepo.getListEntityVendor(
        c,
        id,
        params,
        c.get("programId")
      )
    }

    const parsedListEntity = listEntity.map((entity) => {
      return {
        id: `${entity.id}`,
        name: entity.name ?? "-",
        address: entity.address ?? "-",
        location: entity.location ?? "-",
        activity: entity.activity ?? "-",
      }
    })

    return new PaginatedResponse(params, parsedListEntity, listEntity.length)
  }
}
