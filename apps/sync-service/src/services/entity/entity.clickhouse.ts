import {
  executeUpdateQuery,
  slave,
} from "@/common/infrastructure/database/slave.js"
import { EntityDTO, EntityIncomingMessage } from "./entity.schema.js"

export class EntityClickhouse {
  async create(msg: EntityIncomingMessage) {
    for (const entity of msg.payload) {
      await slave.insertInto("ws_entities").values(entity).execute()
    }
  }

  async update(msg: EntityIncomingMessage) {
    await Promise.all(
      msg.payload.map(async (entity) => {
        this.doUpdateEntity(entity)
      })
    )
    console.log("Success sync to clickhouse")
  }

  async doUpdateEntity(payload: EntityDTO) {
    const compiledQuery = slave
      .updateTable("ws_entities")
      .set({
        name: payload.name,
        code: payload.code,
        type: payload.type,
        entity_tag_id: payload.entity_tag_id,
        is_vendor: payload.is_vendor,
        is_puskesmas: payload.is_puskesmas,
        province_id: payload.province_id,
        regency_id: payload.regency_id,
        sub_district_id: payload.sub_district_id,
        village_id: payload.village_id,
        postal_code: payload.postal_code,
        address: payload.address,
        lat: payload.lat,
        lng: payload.lng,
        status: payload.status,
      })
      .where("id", "=", payload.id)
      .compile()

    await executeUpdateQuery(compiledQuery)
  }
}
