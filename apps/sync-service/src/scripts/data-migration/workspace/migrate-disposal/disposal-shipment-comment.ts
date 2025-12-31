import { collect } from "@smile/lib/utils.js"
import { Transaction } from "kysely"
import { insertTableMapping } from "../../../helper.js"
import {
  getMapActivityIds,
  getMapUserIds,
  getPlatformProgramIdByPlatformActivityId,
  getMapExterminationShipmentIds,
} from "./utils/disposal.helpers.js"
import { DB } from "../../../types.platform.js"

export const migrateDisposalShipmentComments = async (
  trx: Transaction<DB>,
  programIds: number[],
  exterminationShipment,
  disposalComments
) => {
  if (exterminationShipment.length === 0) {
    console.log("No disposal shipment comments to migrate")
    return
  }

  console.log(`Migrating ${disposalComments.length} disposal shipment comments`)

  // Get all necessary mappings
  const [mapActivityIds, mapDisposalShipmentIds, mapUserIds] =
    await Promise.all([
      getMapActivityIds(
        programIds,
        collect(exterminationShipment, "activity_id")?.filter(
          (item, index) =>
            collect(exterminationShipment, "activity_id").indexOf(item) ===
            index
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
        collect(exterminationShipment, "created_by", "updated_by")?.filter(
          (item, index) =>
            collect(exterminationShipment, "created_by", "updated_by").indexOf(
              item
            ) === index
        )
      ),
    ])

  const res = await trx
    .insertInto("ws_disposal_shipment_comments")
    .values(
      disposalComments.map((cmt) => ({
        disposal_shipment_id: mapDisposalShipmentIds[cmt.order_id] ?? 0,
        comment: cmt.comment,
        status: cmt.order_status,
        user_id: mapUserIds[cmt.created_by ?? 0] ?? 0,
        created_at: cmt.created_at ?? new Date().getTime(),
        updated_at: cmt.updated_at ?? new Date().getTime(),
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: disposalComments.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, et] of disposalComments.entries()) {
    mapGlobalIds[et.id] = insertedIds[i]
  }
  for (const cmt of disposalComments) {
    const programId = await getPlatformProgramIdByPlatformActivityId(
      mapActivityIds[cmt.activity_id ?? 0] as number
    )
    if (programId) {
      await insertTableMapping("extermination_shipment_comments", programId, {
        [cmt.order_comment_id]: mapGlobalIds[cmt.id],
      })
    }
  }

  console.log(
    `Successfully migrated ${disposalComments.length} disposal shipment comments`
  )
}
