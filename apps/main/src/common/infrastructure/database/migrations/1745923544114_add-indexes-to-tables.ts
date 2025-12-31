import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createIndex("rabies_vaccine_rules_type_id_IDX")
    .on("rabies_vaccine_rules")
    .column("type_id")
    .execute()

  await db.schema
    .createIndex("rabies_vaccine_rules_method_id_IDX")
    .on("rabies_vaccine_rules")
    .column("method_id")
    .execute()

  await db.schema
    .createIndex("ws_consumptions_transaction_id_IDX")
    .on("ws_consumptions")
    .column("transaction_id")
    .execute()

  await db.schema
    .createIndex("ws_consumptions_patient_id_IDX")
    .on("ws_consumptions")
    .column("patient_id")
    .execute()

  await db.schema
    .createIndex("ws_consumption_rabies_consumption_id_IDX")
    .on("ws_consumption_rabies")
    .column("consumption_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropIndex("rabies_vaccine_rules_type_id_IDX").execute()

  await db.schema.dropIndex("rabies_vaccine_rules_method_id_IDX").execute()

  await db.schema.dropIndex("ws_consumptions_transaction_id_IDX").execute()

  await db.schema.dropIndex("ws_consumptions_patient_id_IDX").execute()

  await db.schema
    .dropIndex("ws_consumption_rabies_consumption_id_IDX")
    .execute()
}
