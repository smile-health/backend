import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapEntityIds, getMapActivityIds } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateCustomerVendors = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  entityIds: number[]
) => {
  const startTime = new Date()
  console.log(
    `Migration customer vendors started at: ${startTime.toLocaleString()}`
  )
  const rows = await migrationDB
    .selectFrom("customer_vendors as cv")
    .select([
      "cv.customer_id",
      "cv.vendor_id",
      "cv.is_distribution",
      "cv.is_consumption",
      "cv.is_extermination",
      "cv.created_at",
      "cv.updated_at",
    ])
    .where("cv.deleted_at", "is", null)
    .where("cv.vendor_id", "in", entityIds)
    .execute()

  if (rows.length === 0) {
    return
  }

  const mapEntityIds = await getMapEntityIds(
    programId,
    collect(rows, "customer_id", "vendor_id")
  )

  await trx
    .insertInto("ws_customer_vendors")
    .values(
      rows.map((row) => ({
        program_id: programId,
        customer_id: mapEntityIds[row.customer_id ?? 0] ?? 0,
        vendor_id: mapEntityIds[row.vendor_id ?? 0] ?? 0,
        is_distribution: row.is_distribution,
        is_consumption: row.is_consumption,
        is_extermination: row.is_extermination,
        created_at: row.created_at ?? new Date(),
        updated_at: row.updated_at ?? new Date(),
      }))
    )
    .executeTakeFirst()

  // Get vendor activities from entity_activity_date
  const vendorActivities = await migrationDB
    .selectFrom("entity_activity_date as ead")
    .select(["ead.entity_id", "ead.activity_id"])
    .where("ead.deleted_at", "is", null)
    .where("ead.entity_id", "in", entityIds)
    .execute()

  if (vendorActivities.length > 0) {
    // Execute mapping queries sequentially to avoid transaction deadlocks
    const mapActivityIds = await getMapActivityIds(programId, collect(vendorActivities, "activity_id"))
    
    const insertedCustomerVendors = await trx
      .selectFrom("ws_customer_vendors")
      .select(["id", "customer_id", "vendor_id"])
      .where("program_id", "=", programId)
      .where(
        "vendor_id",
        "in",
        rows.map((row) => mapEntityIds[row.vendor_id ?? 0] ?? 0)
      )
      .execute()

    // Create efficient reverse mapping
    const reverseEntityMap = Object.fromEntries(
      Object.entries(mapEntityIds).map(([originalId, platformId]) => [
        platformId,
        parseInt(originalId),
      ])
    )

    // Group activities by entity_id for efficient lookup
    const activitiesByEntity = vendorActivities.reduce(
      (acc, activity) => {
        const entityId = activity.entity_id ?? 0
        if (!acc[entityId]) acc[entityId] = []
        acc[entityId].push(activity)
        return acc
      },
      {} as Record<number, typeof vendorActivities>
    )

    // Create customer vendor activities efficiently
    interface CustomerVendorActivity {
      customer_vendor_id: number
      activity_id: number
      created_at: Date
      updated_at: Date
    }

    const customerVendorActivities: CustomerVendorActivity[] = []
    const now = new Date()

    for (const customerVendor of insertedCustomerVendors) {
      const originalVendorId = reverseEntityMap[customerVendor.vendor_id]
      const activities = activitiesByEntity[originalVendorId] || []

      for (const activity of activities) {
        const mappedActivityId = mapActivityIds[activity.activity_id ?? 0]
        if (mappedActivityId) {
          customerVendorActivities.push({
            customer_vendor_id: customerVendor.id,
            activity_id: mappedActivityId,
            created_at: now,
            updated_at: now,
          })
        }
      }
    }

    if (customerVendorActivities.length > 0) {
      await trx
        .insertInto("ws_customer_vendor_activities")
        .values(customerVendorActivities)
        .executeTakeFirst()
    }
  }

  const endTime = new Date()
  const duration = formatDuration(startTime, endTime)

  console.log(
    `Migration customer vendors finished at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${duration}`)
}
