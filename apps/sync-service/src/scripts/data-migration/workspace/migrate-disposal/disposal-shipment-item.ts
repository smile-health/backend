import { collect } from "@smile-health/lib/utils.js"
import { Transaction, sql, Kysely } from "kysely"
import { insertTableMapping } from "../../../helper.js"
import {
  getMapActivityIds,
  getMapUserIds,
  getPlatformProgramIdByPlatformActivityId,
  getMapExterminationShipmentIds,
  getMapMaterialIds,
} from "./utils/disposal.helpers.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"
import { migrateDisposalShipmentStocks } from "./disposal-shipment-stock.js"

export const migrateDisposalShipmentItems = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programIds: number[],
  exterminationShipment
) => {
  if (exterminationShipment.length === 0) {
    console.log("No disposal shipment items to migrate")
    return
  }

  const exterminationShipmentItems = await migrationDB
    .selectFrom("order_items as oit")
    .leftJoin("orders as o", "o.id", "oit.order_id")
    .select([
      "o.id",
      "o.activity_id",
      sql`oit.id`.as("order_item_id"),
      "oit.order_id",
      "oit.confirmed_qty",
      "oit.qty",
      "oit.master_material_id",
      "oit.created_by",
      "oit.updated_by",
      "oit.created_at",
      "oit.updated_at",
    ])
    .where("oit.deleted_at", "is", null)
    .where("o.id", "in", collect(exterminationShipment, "id"))
    .orderBy("oit.id")
    .execute()

  console.log(
    `Migrating ${exterminationShipmentItems.length} disposal shipment items`
  )

  // Get all necessary mappings
  const [mapActivityIds, mapMaterialIds, mapDisposalShipmentIds, mapUserIds] =
    await Promise.all([
      getMapActivityIds(
        programIds,
        collect(exterminationShipment, "activity_id")?.filter(
          (item, index) =>
            collect(exterminationShipment, "activity_id").indexOf(item) ===
            index
        )
      ),
      getMapMaterialIds(
        programIds,
        collect(exterminationShipmentItems, "master_material_id")?.filter(
          (item, index) =>
            collect(exterminationShipmentItems, "master_material_id").indexOf(
              item
            ) === index
        )
      ),
      getMapExterminationShipmentIds(
        programIds,
        collect(exterminationShipment, "id")?.filter(
          (item, index) =>
            collect(exterminationShipment, "id").indexOf(item) === index
        )
      ),
      getMapUserIds(
        programIds,
        collect(exterminationShipmentItems, "created_by", "updated_by")?.filter(
          (item, index) =>
            collect(
              exterminationShipmentItems,
              "created_by",
              "updated_by"
            ).indexOf(item) === index
        )
      ),
    ])

  const res = await trx
    .insertInto("ws_disposal_shipment_items")
    .values(
      exterminationShipmentItems.map((itm) => ({
        disposal_shipment_id: mapDisposalShipmentIds[itm.order_id],
        material_id: mapMaterialIds[itm.master_material_id ?? 0],
        qty: itm.qty,
        confirmed_qty: itm.confirmed_qty,
        notes: "",
        created_by: mapUserIds[itm.created_by ?? 0],
        created_at: itm.created_at ?? new Date().getTime(),
        updated_at: itm.updated_at ?? new Date().getTime(),
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: exterminationShipmentItems.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, et] of exterminationShipmentItems.entries()) {
    mapGlobalIds[et.id] = insertedIds[i]
  }

  for (const cmt of exterminationShipmentItems) {
    const programId = await getPlatformProgramIdByPlatformActivityId(
      mapActivityIds[cmt.activity_id ?? 0] as number
    )

    if (programId) {
      await insertTableMapping("extermination_shipment_items", programId, {
        [cmt.order_item_id]: mapGlobalIds[cmt.id],
      })
    }
  }

  console.log(
    `Successfully migrated ${exterminationShipmentItems.length} disposal shipment items`
  )

  // Migrate disposal shipment stocks
  migrateDisposalShipmentStocks(
    trx,
    migrationDB,
    programIds,
    exterminationShipmentItems
  )
}
