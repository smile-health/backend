import { db } from "../../../db.platform.js"
import { sql } from "kysely"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export async function updateTransactionEntityActivityIdRaw(batchSize: number) {
  const startTime = new Date()
  console.info(
    `Raw SQL Entity activity ID update migration started at: ${startTime.toLocaleString()}`
  )

  try {
    const totalResult = await db
      .selectFrom("ws_transactions")
      .select(db.fn.count("id").as("total"))
      .where("entity_activity_id", "is", null)
      .executeTakeFirst()

    const totalTransactions = Number(totalResult?.total || 0)

    if (totalTransactions === 0) {
      console.info("No transactions need entity_activity_id updates")
      return
    }

    console.info(`Found ${totalTransactions} transactions to update`)

    let processedCount = 0
    let batchNumber = 0
    let offset = 0

    while (processedCount < totalTransactions) {
      const startTime = Date.now()
      batchNumber++

      const result = await db.executeQuery(
        sql`
          UPDATE ws_transactions wt
          SET entity_activity_id = (
            SELECT ea.id
            FROM ws_entity_activities ea
            WHERE ea.entity_id = wt.entity_id
              AND ea.activity_id = wt.activity_id
            LIMIT 1
          )
          WHERE wt.id IN (
            SELECT id FROM (
              SELECT id
              FROM ws_transactions
              WHERE entity_activity_id IS NULL
              ORDER BY id
              LIMIT ${batchSize} OFFSET ${offset}
            ) AS subquery
          )
        `.compile(db)
      )
      
      const updatedCount = Number(result.numAffectedRows || 0)
      
      if (updatedCount === 0) {
        break
      }

      processedCount += updatedCount
      offset += batchSize
      const endTime = Date.now()
      const duration = endTime - startTime

      console.info(
        `Updated batch ${batchNumber} - ` +
          `${updatedCount} transactions in ${duration}ms ` +
          `(${processedCount}/${totalTransactions})`
      )
    }

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Raw SQL Entity activity ID update migration finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - ws_transactions: ${processedCount} rows updated`)
    console.info(
      "✅ Raw SQL Entity activity ID update migration completed successfully"
    )
    process.exit(0)
  } catch (error) {
    console.error("❌ Error updating entity_activity_id with raw SQL")
    console.error(error)
    process.exit(1)
  }
}

export async function updateTransactionEntityActivityId(batchSize: number) {
  const startTime = new Date()
  console.info(
    `Entity activity ID update migration started at: ${startTime.toLocaleString()}`
  )

  try {
    const totalResult = await db
      .selectFrom("ws_transactions")
      .select(db.fn.count("id").as("total"))
      .where("entity_activity_id", "is", null)
      .executeTakeFirst()

    const totalTransactions = Number(totalResult?.total || 0)

    if (totalTransactions === 0) {
      console.info("No transactions need entity_activity_id updates")
      return
    }

    console.info(`Found ${totalTransactions} transactions to update`)

    let processedCount = 0
    let batchNumber = 0

    while (processedCount < totalTransactions) {
      const startTime = Date.now()
      batchNumber++

      const transactionIds = await db
        .selectFrom("ws_transactions")
        .select("id")
        .where("entity_activity_id", "is", null)
        .limit(batchSize)
        .execute()

      if (transactionIds.length === 0) {
        break
      }

      const ids = transactionIds.map((t) => t.id)

      await db
        .updateTable("ws_transactions as t")
        .set((eb) => ({
          entity_activity_id: eb
            .selectFrom("ws_entity_activities as ea")
            .select("ea.id")
            .whereRef("ea.entity_id", "=", "t.entity_id")
            .whereRef("ea.activity_id", "=", "t.activity_id")
            .limit(1),
        }))
        .where("t.id", "in", ids)
        .execute()

      processedCount += transactionIds.length
      const endTime = Date.now()
      const duration = endTime - startTime

      console.info(
        `Updated batch ${batchNumber} - ` +
          `${transactionIds.length} transactions in ${duration}ms ` +
          `(${processedCount}/${totalTransactions})`
      )
    }

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Entity activity ID update migration finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - ws_transactions: ${processedCount} rows updated`)
    console.info(
      "✅ Entity activity ID update migration completed successfully"
    )
    process.exit(0)
  } catch (error) {
    console.error("❌ Error updating entity_activity_id")
    console.error(error)
    process.exit(1)
  }
}
