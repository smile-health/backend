import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapUserIds, insertTableMapping } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateOrderComments = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  orderIds: number[],
  mapPlatformOrderIds = {}
) => {
  const comments = await migrationDB
    .selectFrom("order_comments as c")
    .selectAll("c")
    .where("order_id", "in", orderIds)
    .where("deleted_at", "is", null)
    .execute()

  if (comments.length === 0) {
    return
  }

  const orderCommentIds = collect(comments, "id")

  const mapUserIds = await getMapUserIds(
    programId,
    collect(comments, "user_id")
  )

  const res = await trx
    .insertInto("ws_order_comments")
    .values(
      comments.map((comment) => ({
        order_id: mapPlatformOrderIds[comment.order_id],
        order_status_id: comment.order_status ?? 0,
        user_id: mapUserIds[comment.user_id] ?? 0,
        comment: comment.comment,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: orderCommentIds.length },
    (_, i) => Number(res.insertId) + i
  )
  const mapPlatformOrderCommentIds = {}
  for (const [i, comment] of comments.entries()) {
    mapPlatformOrderCommentIds[comment.id] = insertedIds[i]
  }

  await insertTableMapping(
    "order_comments",
    programId,
    mapPlatformOrderCommentIds
  )
}
