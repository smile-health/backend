import { CompiledQuery, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const query = `
		CREATE FUNCTION IF NOT EXISTS ${process.env.DB_NAME}.get_origin_activities(program_id INT)
		returns JSON
		DETERMINISTIC
		BEGIN
			DECLARE json_result JSON;

			WITH master_activities as (
				select
					wa.id,
					wa.name,
					wa.is_ordered_sales,
					wa.is_ordered_purchase
				from
					ws_activities as wa
				where
					wa.program_id = program_id
				AND
					wa.deleted_at is NULL
				order by
					wa.id
				ASC
			)	
			
			select JSON_OBJECT(
				'origin_activities', (
					ifnull((
						select JSON_ARRAYAGG(
						JSON_OBJECT(
							'id', ma.id,
							'name', ma.name,
							'is_ordered_sales', ma.is_ordered_sales,
							'is_ordered_purchase', ma.is_ordered_purchase
						) 
					)
					from master_activities as ma
					), JSON_ARRAY())
				)
			) into json_result;

				RETURN json_result;	
		END
		`
  await db.executeQuery(CompiledQuery.raw(query))
}
