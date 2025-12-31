import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`       
    ALTER TABLE notification_types
      ADD COLUMN fcm_enabled BOOLEAN DEFAULT TRUE NOT NULL AFTER type,
      ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT TRUE NOT NULL AFTER type,
      ADD COLUMN email_enabled BOOLEAN DEFAULT TRUE NOT NULL AFTER type;
      `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("notification_types")
    .dropColumn("fcm_enabled")
    .dropColumn("whatsapp_enabled")
    .dropColumn("email_enabled")
    .execute()
}
