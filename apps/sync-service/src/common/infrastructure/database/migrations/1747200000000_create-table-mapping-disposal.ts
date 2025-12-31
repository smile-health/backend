import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // Create mapping table for extermination_flows (disposal methods)
  await db.schema
    .createTable("mapping_extermination_flows")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_extermination_flow_id", "bigint", (col) =>
      col.notNull()
    )
    .addColumn("existing_extermination_flow_id", "bigint", (col) =>
      col.notNull()
    )
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_extermination_flows_platform_flow_id")
    .on("mapping_extermination_flows")
    .column("platform_extermination_flow_id")
    .column("program_id")
    .execute()

  // Create mapping table for extermination_transaction_type (disposal transaction types)
  await db.schema
    .createTable("mapping_extermination_transaction_types")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_extermination_transaction_type_id", "bigint", (col) =>
      col.notNull()
    )
    .addColumn("existing_extermination_transaction_type_id", "bigint", (col) =>
      col.notNull()
    )
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_extermination_transaction_types_platform_type_id")
    .on("mapping_extermination_transaction_types")
    .column("platform_extermination_transaction_type_id")
    .column("program_id")
    .execute()

  // Create mapping table for extermination_flow_reasons (disposal method reasons)
  await db.schema
    .createTable("mapping_extermination_flow_reasons")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_extermination_flow_reason_id", "bigint", (col) =>
      col.notNull()
    )
    .addColumn("existing_extermination_flow_reason_id", "bigint", (col) =>
      col.notNull()
    )
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_extermination_flow_reasons_platform_reason_id")
    .on("mapping_extermination_flow_reasons")
    .column("platform_extermination_flow_reason_id")
    .column("program_id")
    .execute()

  // Create mapping table for extermination_transaction (disposal transactions)
  await db.schema
    .createTable("mapping_extermination_transactions")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_extermination_transaction_id", "bigint", (col) =>
      col.notNull()
    )
    .addColumn("existing_extermination_transaction_id", "bigint", (col) =>
      col.notNull()
    )
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex(
      "idx_mapping_extermination_transaction_platform_transaction_id"
    )
    .on("mapping_extermination_transactions")
    .column("platform_extermination_transaction_id")
    .column("program_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_extermination_transactions").execute()
  await db.schema.dropTable("mapping_extermination_flow_reasons").execute()
  await db.schema.dropTable("mapping_extermination_transaction_types").execute()
  await db.schema.dropTable("mapping_extermination_flows").execute()
}
