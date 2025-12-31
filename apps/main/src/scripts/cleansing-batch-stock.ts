import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Transaction } from "kysely"

interface StockRows {
  batch_id: number | null
  batch_code: string | null
  id: number
  material_id: number | null
  material_id_batch: number | null
  batch_code_batch: string | null
  manufacture_id: number | null
  manufacture_id_batch: number | null
}
const getBatch = async (
  trx: Transaction<DB>,
  batchId: number | null,
  code?: string,
  materialId?: number,
  manufactureId?: number
) => {
  return trx
    .selectFrom("ws_batches")
    .select([
      "id",
      "code",
      "material_id",
      "manufacture_id",
      "production_date",
      "expired_date",
    ])
    .$if(!!batchId, (qb) => qb.where("id", "=", batchId!))
    .$if(!batchId, (qb) =>
      qb
        .where("code", "=", code!)
        .where("material_id", "=", materialId!)
        .where("manufacture_id", "=", manufactureId!)
    )
    .where("deleted_at", "is", null)
    .executeTakeFirst()
}

const processUpdateBatchStock = async (
  trx: Transaction<DB>,
  rows: StockRows[]
) => {
  for (const row of rows) {
    const manufactureId = row.manufacture_id ?? row.manufacture_id_batch
    if (!manufactureId) continue
    // if batch exist
    const existBatch = await getBatch(
      trx,
      null,
      row.batch_code ?? row.batch_code_batch ?? "",
      row.material_id ?? row.material_id_batch!,
      manufactureId!
    )

    if (existBatch) {
      console.log(
        `Updating stock id ${row.id} with existing batch id ${existBatch.id}`
      )
      await trx
        .updateTable("ws_stocks")
        .set({ batch_id: existBatch.id, manufacture_id: manufactureId })
        .where("id", "=", row.id)
        .execute()

      continue
    }

    // if batch not exist
    const batchNow = await getBatch(trx, row.batch_id)
    console.log("create new batch with data", {
      code: row.batch_code ?? row.batch_code_batch,
      material_id: row.material_id!,
      manufacture_id: manufactureId,
      production_date: batchNow?.production_date,
      expired_date: batchNow?.expired_date,
    })
    const newBatch = await trx
      .insertInto("ws_batches")
      .values({
        code: row.batch_code ?? row.batch_code_batch ?? "",
        material_id: row.material_id!,
        manufacture_id: manufactureId,
        production_date: batchNow?.production_date,
        expired_date: batchNow?.expired_date,
      })
      .executeTakeFirst()
    const newBatchId = Number(newBatch.insertId)
    await trx
      .updateTable("ws_stocks")
      .set({ batch_id: newBatchId, manufacture_id: manufactureId })
      .where("id", "=", row.id)
      .execute()
    console.log(`Updating stock id ${row.id} with new batch id ${newBatchId}`)
  }
}

export const cleansingBatchStock = async (
  programId: number,
  batchSize: number
) => {
  try {
    console.log(
      `Starting cleansing batch stock for programId: ${programId} with batchSize: ${batchSize}`
    )
    await db.transaction().execute(async (trx) => {
      let totalProcessed = 0
      let hasMore = true

      while (hasMore) {
        const stockRows = await trx
          .selectFrom("ws_stocks as ws")
          .innerJoin("ws_batches as wb", "ws.batch_id", "wb.id")
          .leftJoin("ws_activities as wa", "wa.id", "ws.activity_id")
          .select([
            "ws.id",
            "ws.batch_id",
            "ws.material_id",
            "wb.material_id as material_id_batch",
            "ws.batch_code",
            "wb.code as batch_code_batch",
            "ws.manufacture_id as manufacture_id",
            "wb.manufacture_id as manufacture_id_batch",
          ])
          .whereRef("wb.material_id", "!=", "ws.material_id")
          .where("ws.deleted_at", "is", null)
          .$if(!!programId, (qb) => qb.where("wa.program_id", "=", programId))
          .limit(batchSize)
          .execute()

        if (stockRows.length === 0) {
          console.log("No more invalid stock data found.")
          hasMore = false
          break
        }

        // update batch stock rows
        // console.log({ stockRows })
        await processUpdateBatchStock(trx, stockRows)

        totalProcessed += stockRows.length
        console.log(
          `Processed batch of ${stockRows.length} records, total processed: ${totalProcessed}`
        )
      }
    })

    console.log("Cleansing batch stock completed.")
    process.exit(0)
  } catch (error) {
    console.error("Error cleansing batch stock:", error)
    process.exit(1)
  }
}
