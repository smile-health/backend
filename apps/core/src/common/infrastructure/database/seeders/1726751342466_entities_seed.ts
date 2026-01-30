import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const entities = [
    {
      id: 37,
      code: "1031151",
      name: "PUSKESMAS BOGOR SELATAN",
      type: 3,
      status: 1,
      entity_tag_id: 10,
      address: "Jl. Testing, Gang Testing No 2021",
      country: "ID",
      province_id: "32",
      regency_id: "3271",
      sub_district_id: "327101",
      village_id: null,
      postal_code: "12440",
      lat: "",
      lng: "10680824",
      is_puskesmas: 0,
      is_vendor: 0,
      id_satu_sehat: 1000052467,
      created_by: null,
      updated_by: 519687,
      integration_type: null,
      external_properties: null,
      parent_id: null,
    },
  ]

  for (const entity of entities) {
    await db
      .insertInto("entities")
      .values(entity)
      .onDuplicateKeyUpdate({
        code: entity.code,
        name: entity.name,
        type: entity.type,
        status: entity.status,
        entity_tag_id: entity.entity_tag_id,
        address: entity.address,
        country: entity.country,
        province_id: entity.province_id,
        regency_id: entity.regency_id,
        sub_district_id: entity.sub_district_id,
        village_id: entity.village_id,
        postal_code: entity.postal_code,
        lat: entity.lat,
        lng: entity.lng,
        is_puskesmas: entity.is_puskesmas,
        is_vendor: entity.is_vendor,
        id_satu_sehat: entity.id_satu_sehat,
        updated_by: entity.updated_by,
      })
      .execute()
  }
}
