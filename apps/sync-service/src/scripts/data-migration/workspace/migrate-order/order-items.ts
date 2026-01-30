import { db as mappingDB } from "@/common/infrastructure/database/index.js"
import { collect, getUniqueIdsFromFields } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import {
  getMapMaterialIds,
  getMapStockIds,
  insertTableMapping,
} from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"
import { sql } from "kysely"

const KFA_LEVEL_ID = {
  TEMPLATE: 2,
  VARIANT: 3,
}

export const migrateOrderItems = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  itemIds: number[],
  mapGlobalIds = {}
) => {
  const items = await migrationDB
    .selectFrom("order_items as oi")
    .innerJoin("master_materials as m", "m.id", "oi.master_material_id")
    .leftJoin("order_stocks as os", (join) =>
      join
        .onRef("os.order_item_id", "=", "oi.id")
        .on("os.deleted_at", "is", null)
    )
    .leftJoin("stocks as st", "st.id", "os.stock_id")
    .leftJoin("order_items_kfa as oik", "oik.id", "oi.order_item_kfa_id")
    .selectAll("oi")
    .select([
      "m.parent_id",
      "os.qrcode",
      "os.stock_id",
      "os.allocated_qty",
      "os.received_qty",
      "os.status",
      "os.fulfill_reason",
      "os.fulfill_status",
      "oik.reason_id as parent_reason_id",
      "st.activity_id as stock_activity_id",
      "oi.order_item_kfa_id",
    ])
    .select((eb) =>
      eb
        .case()
        .when("oi.order_item_kfa_id", "is not", null)
        .then(sql`oik.qty`)
        .else(sql`oi.qty`)
        .end()
        .as("ordered_qty")
    )
    .where("oi.order_id", "in", itemIds)
    .where("oi.deleted_at", "is", null)
    .execute()

  if (items.length === 0) {
    return
  }

  const mapMaterialIds = await getMapMaterialIds(
    programId,
    getUniqueIdsFromFields(items, "parent_id", "master_material_id")
  )

  // Get unique stock_activity_ids and map them to program_ids
  const stockActivityIds = collect(items, "stock_activity_id").filter(
    (id) => id != null
  )
  const activityToProgramMap =
    stockActivityIds.length > 0
      ? await mappingDB
          .selectFrom("mapping_activities as ma")
          .select(["ma.existing_activity_id", "ma.program_id"])
          .where("ma.existing_activity_id", "in", stockActivityIds)
          .execute()
          .then((rows) =>
            rows.reduce(
              (acc, row) => {
                acc[row.existing_activity_id] = row.program_id
                return acc
              },
              {} as Record<number, number>
            )
          )
      : {}

  // Group stock_ids by their corresponding program_id
  const stockIdsByProgramId = items.reduce(
    (acc, trx) => {
      const targetProgramId = trx.stock_activity_id
        ? activityToProgramMap[trx.stock_activity_id]
        : programId
      if (targetProgramId && trx.stock_id) {
        acc[targetProgramId] ??= []
        acc[targetProgramId].push(trx.stock_id)
      }
      return acc
    },
    {} as Record<number, number[]>
  )

  // Get mappings for each program_id
  const stockMappingPromises = Object.entries(stockIdsByProgramId).map(
    ([progId, stockIds]) => getMapStockIds(Number(progId), stockIds)
  )

  // Get stock mappings separately and merge them
  const stockMappings = await Promise.all(stockMappingPromises)
  const mapStockIds = stockMappings.reduce(
    (acc, mapping) => ({ ...acc, ...mapping }),
    {}
  )

  const res = await trx
    .insertInto("ws_order_item_stocks")
    .values(
      items.map((item) => ({
        order_id: mapGlobalIds[item.order_id],
        order_item_kfa_id: item.parent_id
          ? KFA_LEVEL_ID.VARIANT
          : KFA_LEVEL_ID.TEMPLATE,
        parent_material_id: mapMaterialIds[item.parent_id ?? 0] ?? null,
        material_id: mapMaterialIds[item.master_material_id ?? 0] ?? 0,
        stock_id: mapStockIds[item.stock_id ?? 0],
        order_stock_status_id: item.status ?? 0,
        qty: Number(item.ordered_qty ?? 0),
        ordered_qty: Number(item.ordered_qty ?? 0),
        allocated_qty: item.allocated_qty,
        received_qty: item.received_qty,
        confirmed_qty: item.confirmed_qty ?? 0,
        recommended_stock: item.recommended_stock,
        order_reason_id: item.parent_reason_id ?? item.reason_id,
        fulfill_reason: item.fulfill_reason,
        fulfill_status: item.fulfill_status,
        qrcode: item.qrcode,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: items.length },
    (_, i) => Number(res.insertId) + i
  )
  const mapGlobalItemIds = {}
  for (const [i, item] of items.entries()) {
    mapGlobalItemIds[item.id] = insertedIds[i]
  }
  await insertTableMapping("order_items", programId, mapGlobalItemIds)

  // insert its parent
  const parentItems = items.filter(
    (item) => !!item.parent_id && !!item.order_item_kfa_id
  )

  if (parentItems.length > 0)
    await trx
      .insertInto("ws_order_item_stocks")
      .values(
        parentItems.map((item) => ({
          order_id: mapGlobalIds[item.order_id],
          order_item_kfa_id: KFA_LEVEL_ID.TEMPLATE,
          material_id: mapMaterialIds[item.parent_id ?? 0] ?? 0,
          qty: Number(item.ordered_qty ?? 0),
          ordered_qty: Number(item.ordered_qty ?? 0),
          allocated_qty: item.allocated_qty ?? 0,
          received_qty: item.received_qty ?? 0,
          confirmed_qty: item.confirmed_qty ?? 0,
          recommended_stock: item.recommended_stock,
          order_reason_id: item.parent_reason_id ?? item.reason_id,
          fulfill_reason: item.fulfill_reason,
          fulfill_status: item.fulfill_status,
          qrcode: item.qrcode,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }))
      )
      .executeTakeFirst()

  const itemWithOtherReasons = items.filter((item) => !!item.other_reason)
  if (itemWithOtherReasons.length === 0) {
    return
  }

  await trx
    .insertInto("ws_other_reasons")
    .values(
      itemWithOtherReasons.map((item) => ({
        source_id: mapGlobalItemIds[item.id],
        source_type: "order_item",
        content: item.other_reason,
      }))
    )
    .executeTakeFirst()
}
