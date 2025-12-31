import { Kysely, Transaction } from "kysely"
import { insertTableMapping } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateDisposalMethods = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number
) => {
  // Get disposal methods from extermination_flow
  const exterminationFlows = await migrationDB
    .selectFrom("extermination_flows as ef")
    .select([
      "ef.id",
      "ef.title",
      "ef.createdAt",
      "ef.updatedAt",
      "ef.deletedAt",
    ])
    .where("ef.deletedAt", "is", null)
    .execute()

  if (exterminationFlows.length === 0) {
    console.log("No disposal methods to migrate")
    return
  }

  console.log(`Migrating ${exterminationFlows.length} disposal methods`)

  const res = await trx
    .insertInto("ws_disposal_methods")
    .values(
      exterminationFlows.map((flow) => ({
        title: flow.title ?? "",
        created_at: flow.created_at ?? new Date(),
        updated_at: flow.updated_at ?? new Date(),
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: exterminationFlows.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, flow] of exterminationFlows.entries()) {
    mapGlobalIds[flow.id] = insertedIds[i]
  }

  await insertTableMapping("extermination_flows", programId, mapGlobalIds)

  console.log(
    `Successfully migrated ${exterminationFlows.length} disposal methods`
  )

  // Now migrate extermination_flow_reasons
  await migrateDisposalMethodReasons(trx, migrationDB, programId, mapGlobalIds)

  return mapGlobalIds
}

export const migrateDisposalMethodReasons = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  disposalMethodsMapping: Record<number, number>
) => {
  // Get disposal method reasons from extermination_flow_reasons
  const exterminationFlowReasons = await migrationDB
    .selectFrom("extermination_flow_reasons as efr")
    .select([
      "efr.id",
      "efr.flow_id",
      "efr.transaction_reason_id",
      "efr.createdAt",
      "efr.updatedAt",
      "efr.deletedAt",
    ])
    .where("efr.deletedAt", "is", null)
    .where("efr.flow_id", "in", Object.keys(disposalMethodsMapping).map(Number))
    .execute()

  if (exterminationFlowReasons.length === 0) {
    console.log("No disposal method reasons to migrate")
    return
  }

  console.log(
    `Migrating ${exterminationFlowReasons.length} disposal method reasons`
  )

  const res = await trx
    .insertInto("ws_disposal_method_reasons")
    .values(
      exterminationFlowReasons.map((reason) => ({
        disposal_method_id: disposalMethodsMapping[reason.flow_id!] ?? 0,
        transaction_reason_id: reason.transaction_reason_id ?? 0,
        created_at: reason.createdAt ?? new Date(),
        updated_at: reason.updatedAt ?? new Date(),
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: exterminationFlowReasons.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, reason] of exterminationFlowReasons.entries()) {
    mapGlobalIds[reason.id] = insertedIds[i]
  }

  await insertTableMapping(
    "extermination_flow_reasons",
    programId,
    mapGlobalIds
  )

  console.log(
    `Successfully migrated ${exterminationFlowReasons.length} disposal method reasons`
  )
  return mapGlobalIds
}
