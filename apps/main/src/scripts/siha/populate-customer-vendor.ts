import { db } from "@/common/infrastructure/database/index.js"

export const populateCustomerVendor = async (
  activityIds: number[],
  vendorCode: number,
  customerCodes: number[]
) => {
  console.info("seed start...")

  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  await db.transaction().execute(async (trx) => {
    // validate activity
    const activities = await trx
      .selectFrom("ws_activities")
      .where("id", "in", activityIds)
      .selectAll()
      .execute()

    if (
      activities.length !== activityIds.length ||
      !activities[0]?.program_id
    ) {
      console.error("some activity not found")
      process.exit(1)
    }
    const programId = activities[0].program_id

    const vendor = await trx
      .selectFrom("ws_entities")
      .select("id")
      .where("id_satu_sehat", "=", vendorCode)
      .where("program_id", "=", programId)
      .executeTakeFirstOrThrow()

    const customers = await trx
      .selectFrom("ws_entities")
      .select("id")
      .where("id_satu_sehat", "in", customerCodes)
      .where("program_id", "=", programId)
      .execute()

    const res = await trx
      .insertInto("ws_customer_vendors")
      .values(
        customers.map((customer) => ({
          customer_id: customer.id,
          vendor_id: vendor.id,
          is_distribution: 1,
          is_consumption: 0,
          is_extermination: 0,
          program_id: programId,
        }))
      )
      .onDuplicateKeyUpdate({
        is_distribution: 1,
        updated_at: new Date(),
      })
      .executeTakeFirst()

    const insertedIds = Array.from(
      { length: customers.length },
      (_, i) => Number(res.insertId) + i
    )

    await trx
      .insertInto("ws_customer_vendor_activities")
      .values(
        activityIds.flatMap((activityId) =>
          insertedIds.map((id) => ({
            customer_vendor_id: id,
            activity_id: activityId,
          }))
        )
      )
      .execute()
  })

  console.log("migration finished")
  process.exit(0)
}
