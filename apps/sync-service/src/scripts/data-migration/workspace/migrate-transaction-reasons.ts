import { TRANSACTION_TYPE } from "@/common/constant/transaction.js"
import { insertTableMapping } from "@/scripts/helper.js"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateTransactionReasons = async (programId = 1) => {
  const startTime = new Date()
  console.info(
    `Migration transaction reasons started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  const migrationDB = getMigrationDB(programId)

  let transactionReasonCount = 0
  const transactionReasonWorkspaceCount = 0
  try {
    const transactionReasons = await migrationDB
      .selectFrom("transaction_reasons")
      .selectAll()
      .where("deletedAt", "is", null)
      .orderBy("id")
      .execute()

    transactionReasonCount = transactionReasons.length

    console.info(`migrating ${transactionReasonCount} transaction reasons`)

    const res = await db
      .insertInto("ws_transaction_reasons")
      .values(
        transactionReasons.map((trxReason) => ({
          program_id: 0,
          title: trimTitle(trxReason.title ?? ""),
          title_en: trxReason.title_en,
          transaction_type_id: determineTransactionType(
            trxReason.transaction_type_id!,
            null
          ),
          is_other: trxReason.is_other,
          is_purchase: trxReason.is_purchase,
          status: determineStatus(
            trxReason.transaction_type_id!,
            trxReason.title!
          ),
          created_at: trxReason.createdAt,
          updated_at: trxReason.updatedAt,
          deleted_at: trxReason.deletedAt,
        }))
      )
      .executeTakeFirst()

    const insertedIds = Array.from(
      { length: transactionReasons.length },
      (_, i) => Number(res.insertId) + i
    )
    const mapPlatformTransactionReasons = {}
    for (const [i, reason] of transactionReasons.entries()) {
      mapPlatformTransactionReasons[reason.id] = insertedIds[i]
    }

    // Add new hibah transaction reason
    await db
      .insertInto("ws_transaction_reasons")
      .values({
        title: "hibah",
        title_en: "donation",
        transaction_type_id: 7,
        program_id: 0,
        is_other: 0,
        is_purchase: 0,
        status: 1,
      })
      .executeTakeFirst()

    const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

    if (platformProgramIds.length === 0) {
      console.warn(
        `No platform program IDs mapped for legacy program ID: ${programId}`
      )
      process.exit(0)
    }

    for (const progId of platformProgramIds) {
      await insertTableMapping(
        "transaction_reasons",
        progId,
        mapPlatformTransactionReasons
      )

      console.log(`Successfully created mappings for program ID: ${progId}`)
    }

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration transaction reasons finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Transaction Reasons: ${transactionReasonCount} records`)
    console.info(
      `   - Transaction Reason Workspaces: ${transactionReasonWorkspaceCount} records`
    )
    console.info(
      "✅ All workspace transaction reason migration completed successfully"
    )
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}

// shorten title for tolgee
const trimTitle = (title: string) => {
  if (title === "Uji Sampling Kemenkes (Siapkan Berita Acara)") {
    return "Uji Sampling Kemenkes"
  }

  return title
}

const determineTransactionType = (trxType: number, orderId: number | null) => {
  // trx type konsumsi
  if (!orderId && trxType === 2) {
    return 10
  }

  // trx type pembuangan
  if (trxType === 11) {
    return 9
  }

  // if not found then default from previous
  return trxType
}

const determineStatus = (trxType: number, title: string) => {
  // always display reason for transaction other than add stock
  if (trxType !== TRANSACTION_TYPE.ADD_STOCK) {
    return 1
  }

  // display reason for add stock only for specific reason
  const whitelistedReasons = ["hibah", "Pembelian langsung", "Input Stok Awal"]

  return whitelistedReasons.includes(title) ? 1 : 0
}
