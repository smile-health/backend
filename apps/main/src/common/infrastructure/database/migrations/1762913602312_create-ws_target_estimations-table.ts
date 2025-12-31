import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
}

export async function down(db: Kysely<Database>): Promise<void> {}
