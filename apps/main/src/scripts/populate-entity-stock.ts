import { db } from "@/common/infrastructure/database/index.js"
import {
  WsEntityMaterialActivities,
  WsStocks,
} from "@/common/infrastructure/database/types/db.js"
import { collect } from "@smile-health/lib/utils.js"
import { Selectable } from "kysely"

export const populateEntityStock = async (
  entityIdsStr: string,
  materialIdsStr: string,
  programId = 1
) => {
  console.info("populating start...")

  const entityIds = entityIdsStr.split(",").map(Number)

  await db.transaction().execute(async (trx) => {
    const activities = await trx
      .selectFrom("ws_activities")
      .select("id")
      .where("program_id", "=", programId)
      .limit(10)
      .execute()

    const activityIds = collect(activities, "id")

    const materials = await trx
      .selectFrom("ws_materials")
      .select("id")
      .where("id", "in", materialIdsStr.split(",").map(Number))
      .execute()

    const materialIds = materials.map((m) => m.id)

    const emas: Selectable<WsEntityMaterialActivities>[] = []
    const stocks: Selectable<WsStocks>[] = []

    for (const entityId of entityIds) {
      for (const activityId of activityIds) {
        for (const materialId of materialIds) {
          emas.push({
            entity_id: entityId,
            activity_id: activityId,
            material_id: materialId,
            id: 0,
            created_at: new Date(),
            deleted_at: null,
            updated_at: new Date(),
            consumption_rate: null,
            max: 100,
            min: 1,
            retailer_price: null,
            tax: null,
          })

          stocks.push({
            entity_id: entityId,
            activity_id: activityId,
            material_id: materialId,
            id: 0,
            created_at: new Date(),
            created_by: null,
            deleted_at: null,
            deleted_by: null,
            updated_at: new Date(),
            updated_by: null,
            allocated_qty: null,
            batch_id: null,
            budget_source_id: null,
            entity_material_activity_id: null,
            exterminated_qty: null,
            in_transit_qty: null,
            open_vial_qty: null,
            parent_material_id: null,
            price: null,
            qty: 1000,
            stock_quality_id: null,
            total_price: null,
            year: null,
          })
        }
      }
    }

    await trx.insertInto("ws_entity_material_activities").values(emas).execute()
    await trx.insertInto("ws_stocks").values(stocks).execute()
  })
  console.info("migration finish")
}
