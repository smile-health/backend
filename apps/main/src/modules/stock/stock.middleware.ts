import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { Context } from "hono"
import { GetStocksQueries } from "./stock.schema.js"

export class StockMiddleware {
  constructor() {}

  // force some filter by its role so it cannot access other resources
  public prefillFilterByRole = async (c: Context, data: GetStocksQueries) => {
    const { roleId, userEntity } = c.var
    if (roleId === USER_ROLE.OPERATOR) {
      data.entity_id = userEntity.id
    }

    if (
      roleId === USER_ROLE.MANAGER &&
      userEntity.type === ENTITY_TYPE.PROVINSI
    ) {
      data.province_id = Number(userEntity.province_id)
    }

    if (roleId === USER_ROLE.MANAGER && userEntity.type === ENTITY_TYPE.KOTA) {
      data.regency_id = Number(userEntity.regency_id)
    }

    return data
  }
}
