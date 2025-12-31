import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
	const createTableQuery = sql`
		CREATE TABLE ws_daily_target_count_snapshots (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			snapshot_date DATE NOT NULL,
			microplanning_id BIGINT NOT NULL,
			target_group_id INT NOT NULL,
			entity_type VARCHAR(20) NOT NULL,
			reference_id BIGINT NOT NULL,
			sub_district_id BIGINT,
			current_count INT NOT NULL DEFAULT 0,
			cumulative_count INT NOT NULL DEFAULT 0,
			promoted_out_count INT NOT NULL DEFAULT 0,
			newly_added_count INT NOT NULL DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			created_by BIGINT,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			updated_by BIGINT,
			deleted_at TIMESTAMP NULL,
			deleted_by BIGINT,
			UNIQUE KEY uk_snapshot (snapshot_date, microplanning_id, entity_type, reference_id, target_group_id)
		)
	`
	await db.executeQuery(createTableQuery.compile(db))

	// Add indexes for better performance
	await db.schema
		.createIndex("idx_dtcs_date")
		.on("ws_daily_target_count_snapshots")
		.column("snapshot_date")
		.execute()

	await db.schema
		.createIndex("idx_dtcs_microplanning")
		.on("ws_daily_target_count_snapshots")
		.column("microplanning_id")
		.execute()

	await db.schema
		.createIndex("idx_dtcs_sub_district")
		.on("ws_daily_target_count_snapshots")
		.column("sub_district_id")
		.execute()

	await db.schema
		.createIndex("idx_dtcs_entity_type")
		.on("ws_daily_target_count_snapshots")
		.column("entity_type")
		.execute()

	await db.schema
		.createIndex("idx_dtcs_date_entity")
		.on("ws_daily_target_count_snapshots")
		.columns(["snapshot_date", "entity_type", "target_group_id"])
		.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("ws_daily_target_count_snapshots").execute()
}
