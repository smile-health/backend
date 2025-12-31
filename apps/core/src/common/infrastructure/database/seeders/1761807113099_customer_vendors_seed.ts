import type { Kysely } from "kysely"
import { ENTITY_TAG, ENTITY_TYPE } from "../../../constants/entity.js"
import { Database } from "../types"

// Create customer vendor view with base data from program
// Used for notification in asset vendor

export async function seed(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createView("customer_vendors")
    .orReplace()
    .as(
      db
        .selectFrom("ws_entities as c")
        .innerJoin("ws_customer_vendors as cv", "cv.customer_id", "c.id")
        .innerJoin("ws_entities as v", "v.id", "cv.vendor_id")
        .select([
          "v.global_id as id",
          "v.name",
          "v.province_id",
          "v.regency_id",
          "v.entity_tag_id",
          "c.global_id as customer_id",
        ])
        .where("cv.is_distribution", "=", 1)
        .where((eb) =>
          eb.or([
            eb.and([
              eb("c.type", "=", ENTITY_TYPE.PROVINCE),
              eb("v.entity_tag_id", "=", ENTITY_TAG.MINISTRY_OF_HEALTH),
            ]),
            eb.and([
              eb("c.type", "=", ENTITY_TYPE.CITY),
              eb("v.entity_tag_id", "=", ENTITY_TAG.PROVINCE_HEALTH_OFFICE),
            ]),
            eb.and([
              eb("c.type", "=", ENTITY_TYPE.HEALTH_FACILITY),
              eb(
                "v.entity_tag_id",
                "=",
                ENTITY_TAG.CITY_DISTRICT_HEALTH_OFFICE
              ),
            ]),
          ])
        )
        .distinct()
    )
    .execute()
}
