import { Kysely, Transaction } from "kysely"
import { insertTableMapping } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateDisposalTransactionTypes = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number
) => {
  // Get disposal transaction types from extermination_transaction_types
  const exterminationTransactionTypes = await migrationDB
    .selectFrom("extermination_transaction_types as ett")
    .select([
      "ett.id",
      "ett.title",
      "ett.title_en",
      "ett.createdAt",
      "ett.updatedAt",
      "ett.deletedAt",
    ])
    .where("ett.deletedAt", "is", null)
    .execute()

  if (exterminationTransactionTypes.length === 0) {
    console.log("No disposal transaction types to migrate")
    return
  }

  console.log(
    `Migrating ${exterminationTransactionTypes.length} disposal transaction types`
  )

  const res = await trx
    .insertInto("ws_disposal_transaction_types")
    .values(
      exterminationTransactionTypes.map((type) => ({
        title: type.title ?? "",
        created_at: type.created_at ?? new Date(),
        updated_at: type.updated_at ?? new Date(),
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: exterminationTransactionTypes.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, type] of exterminationTransactionTypes.entries()) {
    mapGlobalIds[type.id] = insertedIds[i]
  }

  await insertTableMapping(
    "extermination_transaction_types",
    programId,
    mapGlobalIds
  )

  console.log(
    `Successfully migrated ${exterminationTransactionTypes.length} disposal transaction types`
  )
  return mapGlobalIds
}
