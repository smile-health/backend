import { db } from "../db.platform.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const updateStatus = async () => {
  const startTime = new Date()
  console.info(
    `Status update migration started at: ${startTime.toLocaleString()}`
  )

  const results: Record<string, number> = {}

  try {
    await db.transaction().execute(async (trx) => {
      const budgetResult = await trx
        .updateTable("budget_source_workspaces")
        .set({ status: 1 })
        .execute()
      const budgetRows = budgetResult.reduce(
        (sum, r) => sum + Number(r.numUpdatedRows || 0),
        0
      )
      results["budget_source_workspaces"] = budgetRows
      console.info(`Updated ${budgetRows} rows in budget_source_workspaces`)

      const manufactureResult = await trx
        .updateTable("manufactures")
        .set({ status: 1 })
        .execute()
      const manufactureRows = manufactureResult.reduce(
        (sum, r) => sum + Number(r.numUpdatedRows || 0),
        0
      )
      results["manufactures"] = manufactureRows
      console.info(`Updated ${manufactureRows} rows in manufactures`)

      const wsTransactionResult = await trx
        .updateTable("ws_transaction_reasons")
        .set({ status: 1 })
        .execute()
      const wsTransactionRows = wsTransactionResult.reduce(
        (sum, r) => sum + Number(r.numUpdatedRows || 0),
        0
      )
      results["ws_transaction_reasons"] = wsTransactionRows
      console.info(
        `Updated ${wsTransactionRows} rows in ws_transaction_reasons`
      )
    })

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Status update migration finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    for (const [table, count] of Object.entries(results)) {
      console.info(`   - ${table}: ${count} rows updated`)
    }
    console.info("✅ Status update migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error updating status")
    console.error(error)
    process.exit(1)
  }
}
