import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction, sql } from "kysely"
import { insertTableMapping } from "../../../helper.js"
import { TYPE_ID_DISPOSAL_SHIPMENT } from "./utils/disposal.constants.js"
import {
  getMapActivityIds,
  getMapEntityIds,
  getMapUserIds,
  getPlatformProgramIdByPlatformActivityId,
} from "./utils/disposal.helpers.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"
import { migrateDisposalShipmentComments } from "./disposal-shipment-comment.js"
import { migrateDisposalShipmentItems } from "./disposal-shipment-item.js"

export const migrateDisposalShipments = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programIds: number[],
  exterminationShipment
) => {
  if (exterminationShipment.length === 0) {
    console.log("No disposal shipments to migrate")
    return
  }

  const disposalComments = await migrationDB
    .selectFrom("order_comments as oc")
    .innerJoin("orders as o", "o.id", "oc.order_id")
    .select([
      "o.id",
      "o.activity_id",
      sql`oc.id`.as("order_comment_id"),
      "oc.order_id",
      "oc.comment",
      "oc.created_by",
      "oc.updated_by",
      "oc.created_at",
      "oc.updated_at",
      "oc.order_status",
    ])
    .where("oc.deleted_at", "is", null)
    .where("o.id", "in", collect(exterminationShipment, "id"))
    .orderBy("oc.id")
    .execute()

  const groupedComments = disposalComments.reduce((acc, item) => {
    if (!acc[item.order_id]) acc[item.order_id] = []
    acc[item.order_id].push(item)
    return acc
  }, {})

  // Step 2: Map to desired structure
  const commentsMappingResult = Object.values(groupedComments).map((group) => {
    const [first, ...others] = group
    return {
      first_comment: { order_id: first.order_id, comment: first.comment },
      other_comments: others,
    }
  })

  console.log(`Migrating ${exterminationShipment.length} disposal shipments`)

  // Get all necessary mappings
  const [mapActivityIds, mapCustomerIds, mapVendorIds, mapUserIds] =
    await Promise.all([
      getMapActivityIds(
        programIds,
        collect(exterminationShipment, "activity_id")?.filter(
          (item, index) =>
            collect(exterminationShipment, "activity_id").indexOf(item) ===
            index
        )
      ),
      getMapEntityIds(
        programIds,
        collect(exterminationShipment, "customer_id")?.filter(
          (item, index) =>
            collect(exterminationShipment, "customer_id").indexOf(item) ===
            index
        )
      ),
      getMapEntityIds(
        programIds,
        collect(exterminationShipment, "vendor_id")?.filter(
          (item, index) =>
            collect(exterminationShipment, "vendor_id").indexOf(item) === index
        )
      ),
      getMapUserIds(
        programIds,
        collect(exterminationShipment, "created_by", "updated_by")?.filter(
          (item, index) =>
            collect(exterminationShipment, "created_by", "updated_by").indexOf(
              item
            ) === index
        )
      ),
    ])

  const res = await trx
    .insertInto("ws_disposal_shipments")
    .values(
      exterminationShipment.map((et) => {
        // Calculate closing_qty as per the virtual attribute logic
        return {
          activity_id: mapActivityIds[et.activity_id ?? 0] ?? null,
          customer_id: mapCustomerIds[et.customer_id ?? 0] ?? 0,
          vendor_id: mapVendorIds[et.vendor_id ?? 0] ?? 0,
          status: et.status ?? null,
          type: TYPE_ID_DISPOSAL_SHIPMENT,
          no_document: et.no_document ?? null,
          comments:
            commentsMappingResult.find(
              (cmt) => cmt.first_comment.order_id === et.id
            )?.first_comment.comment ?? null,
          shipped_at: et.shipped_at ?? 0,
          fulfilled_at: et.fulfilled_at ?? 0,
          cancelled_at: et.cancelled_at ?? 0,
          created_by: mapUserIds[et.created_by ?? 0] ?? 0,
          updated_by: mapUserIds[et.updated_by ?? 0] ?? 0,
          created_at: et.created_at ?? 0,
          updated_at: et.updated_at ?? 0,
          deleted_at: et.deleted_at ?? 0,
          device_type: et.device_type ?? null,
        }
      })
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: exterminationShipment.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, et] of exterminationShipment.entries()) {
    mapGlobalIds[et.id] = insertedIds[i]
  }

  for (const et of exterminationShipment) {
    const programId = await getPlatformProgramIdByPlatformActivityId(
      mapActivityIds[et.activity_id ?? 0] as number
    )

    if (programId) {
      await insertTableMapping("extermination_shipments", programId, {
        [et.id]: mapGlobalIds[et.id],
      })
    }
  }

  console.log(
    `Successfully migrated ${exterminationShipment.length} disposal shipments`
  )
  await migrateDisposalShipmentComments(
    trx,
    programIds,
    exterminationShipment,
    commentsMappingResult?.map((cmt) => cmt.other_comments)?.flat() ?? []
  )
  await migrateDisposalShipmentItems(
    trx,
    migrationDB,
    programIds,
    exterminationShipment
  )
  return mapGlobalIds
}
