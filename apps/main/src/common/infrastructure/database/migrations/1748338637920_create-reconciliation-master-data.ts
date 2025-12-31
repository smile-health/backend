/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

const createBaseTable = async (db: Kysely<any>, tableName: string) => {
  await db.schema
    .createTable(tableName)
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

const createWorkspaceRelationTable = async (
  db: Kysely<any>,
  tableName: string,
  foreignKey: string
) => {
  await db.schema
    .createTable(tableName)
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn(foreignKey, "bigint", (col) => col.notNull())
    .addColumn("workspace_id", "bigint", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

const executeCreateTables = async (db: Kysely<any>) => {
  await createBaseTable(db, "reconciliation_categories")
  await createBaseTable(db, "reconciliation_reasons")
  await createBaseTable(db, "reconciliation_actions")

  await createWorkspaceRelationTable(
    db,
    "reconciliation_reasons_workspaces",
    "reconciliation_reason_id"
  )

  await createWorkspaceRelationTable(
    db,
    "reconciliation_actions_workspaces",
    "reconciliation_action_id"
  )
}

const executeSeed = async (db: Kysely<any>) => {
  const reconciliationCategory = [
    { id: 1, title: "received" },
    { id: 2, title: "return" },
    { id: 3, title: "distribution" },
    { id: 4, title: "received_return" },
    { id: 5, title: "consumed" },
    { id: 6, title: "defect" },
    { id: 7, title: "remaining" },
  ]

  const reconciliationAction = [
    { id: 1, title: "report_incident" },
    { id: 2, title: "updated" },
  ]

  const reconciliationReason = [
    { id: 1, title: "not_available_in_smile" },
    { id: 2, title: "not_yet_updated" },
    { id: 3, title: "cancelled_not_match" },
  ]

  await db
    .insertInto("reconciliation_categories")
    .values(reconciliationCategory)
    .execute()

  await db
    .insertInto("reconciliation_reasons")
    .values(reconciliationReason)
    .execute()

  await db
    .insertInto("reconciliation_actions")
    .values(reconciliationAction)
    .execute()
}
export async function up(db: Kysely<any>): Promise<void> {
  await executeCreateTables(db)
  await executeSeed(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("reconciliation_categories").execute()
  await db.schema.dropTable("reconciliation_reasons").execute()
  await db.schema.dropTable("reconciliation_actions").execute()
  await db.schema.dropTable("reconciliation_reasons_workspaces").execute()
  await db.schema.dropTable("reconciliation_actions_workspaces").execute()
}
