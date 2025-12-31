import { sql, type Kysely } from "kysely"
import { Database } from "../../../../../../core/src/common/infrastructure/database/types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE material_subtypes
    ADD COLUMN material_type_id BIGINT NOT NULL AFTER name
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE material_subtypes
    DROP COLUMN material_type_id
  `.execute(db)
}
