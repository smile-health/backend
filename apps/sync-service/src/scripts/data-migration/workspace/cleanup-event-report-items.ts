import { db } from "../../db.platform.js"
import { collect } from "@smile-health/lib/utils.js"
import { Transaction } from "kysely"
import { DB } from "../../types.platform.js"

import { MAP_EXISTING_TO_PLATFORM } from "../const.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const cleanupEventReportItems = async (
  batchSize: number,
  existingProgramId = 1
) => {
  const startTime = new Date()
  console.log(
    `Cleanup eventReport items started at: ${startTime.toLocaleString()}`
  )

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []

  for (const platformProgramId of platformProgramIds) {
    console.log(
      `Cleaning up eventReport items for existing program ID ${existingProgramId} to platform program ID ${platformProgramId}`
    )

    let page = 0
    while (true) {
      const eventReports = await db
        .selectFrom("ws_event_reports as er")
        .select(["er.id"])
        .where("er.program_id", "=", platformProgramId)
        .where("er.deleted_at", "is", null)
        .orderBy("er.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (eventReports.length === 0) {
        break
      }

      const eventReportIds = collect(eventReports, "id")

      await db.transaction().execute(async (trx) => {
        await doCleanup(trx, eventReportIds)
      })

      page++
      console.log(
        `Processed batch ${page} with ${eventReports.length} event reports`
      )
    }
  }

  const endTime = new Date()
  console.log(
    `Cleanup eventReport items completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  process.exit(0)
}

async function doCleanup(trx: Transaction<DB>, eventReportIds: number[]) {
  console.log(
    `Processing ${eventReportIds.length} event reports for cleanup...`
  )

  // Step 1: Find and soft delete event reports where has_order = 1 and order_id is null
  const invalidOrderReports = await trx
    .selectFrom("ws_event_reports")
    .select(["id"])
    .where("id", "in", eventReportIds)
    .where("has_order", "=", 1)
    .where("order_id", "is", null)
    .where("deleted_at", "is", null)
    .execute()

  if (invalidOrderReports.length > 0) {
    console.log(
      `Found ${invalidOrderReports.length} event reports with has_order=1 but order_id=null to soft delete`
    )

    const invalidOrderReportIds = collect(invalidOrderReports, "id")
    await trx
      .updateTable("ws_event_reports")
      .set({
        deleted_at: new Date(),
      })
      .where("id", "in", invalidOrderReportIds)
      .execute()

    console.log(
      `Soft deleted ${invalidOrderReportIds.length} event reports with invalid order references`
    )
  }

  // Step 2: Find all event report items with material_id = 0 or report_id = 0 that are not already soft deleted
  const itemsToDelete = await trx
    .selectFrom("ws_event_report_items as eri")
    .select(["eri.id", "eri.report_id"])
    .where((eb) =>
      eb.or([
        eb.and([
          eb("eri.report_id", "in", eventReportIds),
          eb("eri.material_id", "=", 0),
        ]),
        eb("eri.report_id", "=", 0),
      ])
    )
    .where("eri.deleted_at", "is", null)
    .execute()

  if (itemsToDelete.length > 0) {
    console.log(
      `Found ${itemsToDelete.length} items with material_id = 0 or report_id = 0 to soft delete`
    )

    // Soft delete items with material_id = 0 or report_id = 0
    const itemIds = collect(itemsToDelete, "id")
    await trx
      .updateTable("ws_event_report_items")
      .set({
        deleted_at: new Date(),
      })
      .where("id", "in", itemIds)
      .execute()

    console.log(`Soft deleted ${itemIds.length} event report items`)
  }

  // Step 3: Check each event report to see if all its items are now soft deleted
  const reportsToCheck = [...new Set(collect(itemsToDelete, "report_id"))]

  if (reportsToCheck.length === 0) {
    console.log(
      "No event reports need to be checked for complete item deletion"
    )
  } else {
    console.log(
      `Checking ${reportsToCheck.length} event reports for complete item deletion...`
    )

    for (const reportId of reportsToCheck) {
      // Skip if this report was already deleted in step 2
      const reportExists = await trx
        .selectFrom("ws_event_reports")
        .select(["id"])
        .where("id", "=", reportId)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      if (!reportExists) {
        continue
      }

      // Count total items for this report
      const totalItemsResult = await trx
        .selectFrom("ws_event_report_items")
        .select(trx.fn.count("id").as("total"))
        .where("report_id", "=", reportId)
        .executeTakeFirst()

      const totalItems = Number(totalItemsResult?.total || 0)

      // Count soft deleted items for this report
      const deletedItemsResult = await trx
        .selectFrom("ws_event_report_items")
        .select(trx.fn.count("id").as("deleted"))
        .where("report_id", "=", reportId)
        .where("deleted_at", "is not", null)
        .executeTakeFirst()

      const deletedItems = Number(deletedItemsResult?.deleted || 0)

      // If all items are soft deleted, soft delete the event report
      if (totalItems > 0 && totalItems === deletedItems) {
        await trx
          .updateTable("ws_event_reports")
          .set({
            deleted_at: new Date(),
          })
          .where("id", "=", reportId)
          .where("deleted_at", "is", null)
          .execute()

        console.log(
          `Soft deleted event report ${reportId} (all ${totalItems} items were deleted)`
        )
      }
    }
  }

  // Step 4: Find and soft delete event report histories with report_id = 0
  const historiesToDelete = await trx
    .selectFrom("ws_event_report_histories as erh")
    .select(["erh.id", "erh.report_id"])
    .where("erh.report_id", "=", 0)
    .where("erh.deleted_at", "is", null)
    .execute()

  if (historiesToDelete.length > 0) {
    console.log(
      `Found ${historiesToDelete.length} event report histories with report_id = 0 to soft delete`
    )

    // Soft delete histories with report_id = 0
    const historyIds = collect(historiesToDelete, "id")
    await trx
      .updateTable("ws_event_report_histories")
      .set({
        deleted_at: new Date(),
      })
      .where("id", "in", historyIds)
      .execute()

    console.log(`Soft deleted ${historyIds.length} event report histories`)
  }

  // Step 5: Check if all histories for each report are soft deleted, then soft delete parent reports
  const reportsWithHistories = await trx
    .selectFrom("ws_event_report_histories as erh")
    .select(["erh.report_id"])
    .where("erh.report_id", "in", eventReportIds)
    .where("erh.deleted_at", "is", null)
    .groupBy("erh.report_id")
    .execute()

  const reportsWithActiveHistories = collect(reportsWithHistories, "report_id")
  const reportsToCheckForHistoryDeletion = eventReportIds.filter(
    (id) => !reportsWithActiveHistories.includes(id)
  )

  if (reportsToCheckForHistoryDeletion.length > 0) {
    console.log(
      `Checking ${reportsToCheckForHistoryDeletion.length} event reports where all histories are soft deleted...`
    )

    for (const reportId of reportsToCheckForHistoryDeletion) {
      // Check if this report exists and is not already soft deleted
      const reportExists = await trx
        .selectFrom("ws_event_reports")
        .select(["id"])
        .where("id", "=", reportId)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      if (!reportExists) {
        continue
      }

      // Count total histories for this report
      const totalHistoriesResult = await trx
        .selectFrom("ws_event_report_histories")
        .select(trx.fn.count("id").as("total"))
        .where("report_id", "=", reportId)
        .executeTakeFirst()

      const totalHistories = Number(totalHistoriesResult?.total || 0)

      // If there are histories for this report, check if all are soft deleted
      if (totalHistories > 0) {
        const deletedHistoriesResult = await trx
          .selectFrom("ws_event_report_histories")
          .select(trx.fn.count("id").as("deleted"))
          .where("report_id", "=", reportId)
          .where("deleted_at", "is not", null)
          .executeTakeFirst()

        const deletedHistories = Number(deletedHistoriesResult?.deleted || 0)

        // If all histories are soft deleted, soft delete the parent event report
        if (totalHistories === deletedHistories) {
          await trx
            .updateTable("ws_event_reports")
            .set({
              deleted_at: new Date(),
            })
            .where("id", "=", reportId)
            .where("deleted_at", "is", null)
            .execute()

          console.log(
            `Soft deleted event report ${reportId} (all ${totalHistories} histories were deleted)`
          )
        }
      }
    }
  }

  console.log(
    `Cleanup completed for batch of ${eventReportIds.length} event reports`
  )
}
