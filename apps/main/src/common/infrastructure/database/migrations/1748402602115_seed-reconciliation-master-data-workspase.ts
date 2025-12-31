/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely } from "kysely"

const executeSeed = async (db: Kysely<any>) => {
  const reconciliationAction = [
    { reconciliation_action_id: 1 },
    { reconciliation_action_id: 2 },
  ]

  const reconciliationReason = [
    { reconciliation_reason_id: 1 },
    { reconciliation_reason_id: 2 },
    { reconciliation_reason_id: 3 },
  ]

  // get program workspace id
  const programs = await db
    .selectFrom("workspaces")
    .select("id")
    .where("deleted_at", "is", null)
    .execute()

  if (programs.length === 0) {
    throw new Error("No workspaces found to seed reconciliation data.")
  }

  // Flat-mapping workspace ID ke setiap action dan reason
  const reconciliationActionWs = programs.flatMap(({ id }) =>
    reconciliationAction.map((action) => ({
      ...action,
      workspace_id: id,
    }))
  )

  const reconciliationReasonWs = programs.flatMap(({ id }) =>
    reconciliationReason.map((reason) => ({
      ...reason,
      workspace_id: id,
    }))
  )

  await db
    .insertInto("reconciliation_reasons_workspaces")
    .values(reconciliationReasonWs)
    .execute()

  await db
    .insertInto("reconciliation_actions_workspaces")
    .values(reconciliationActionWs)
    .execute()
}

export async function up(db: Kysely<any>): Promise<void> {
  // Move to data migration as the workspaces is empty since this seed
  // await executeSeed(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // delete all records from the reconciliation tables
  await db.deleteFrom("reconciliation_reasons_workspaces").execute()
  await db.deleteFrom("reconciliation_actions_workspaces").execute()
}
