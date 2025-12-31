import { CompiledQuery, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const query = `
		CREATE FUNCTION IF NOT EXISTS ${process.env.DB_NAME}.get_activities_start_end(program_id INT, entity_id INT)
		returns JSON
		DETERMINISTIC
		BEGIN
			DECLARE json_result JSON;
				DECLARE currentDate DATE;
				
				SET currentDate = CURDATE();
				
				select JSON_OBJECT(
						'activities', (
							ifnull (
								(
									SELECT JSON_ARRAYAGG(
											JSON_OBJECT(
													'id', wa.id,
													'entity_activity_id', wea.id,
													'name', wa.name,
													'is_ordered_sales', wa.is_ordered_sales,
									'is_ordered_purchase', wa.is_ordered_purchase,
													'start_date', wea.start_date,
													'end_date', wea.end_date,
													'is_ongoing',
                            CASE
                                WHEN wea.start_date <= currentDate
                                  AND (wea.end_date >= currentDate OR wea.end_date IS NULL)
                                THEN 1
                                ELSE 0
                            END
											)
									)
									FROM ws_activities wa
									JOIN ws_entity_activities wea ON wa.id = wea.activity_id and wea.deleted_at is null
									JOIN ws_entities we ON wea.entity_id = we.id and we.program_id = program_id
									WHERE wa.program_id = program_id
									AND wea.entity_id = entity_id
									AND wea.start_date IS NOT NULL
									AND (
											(wea.start_date <= currentDate AND wea.end_date >= currentDate)
											OR (wea.end_date IS NULL AND wea.start_date <= currentDate)
									)
									and (wa.status = 1 or wa.deleted_at is null)
									ORDER BY wa.id ASC
								), JSON_ARRAY()
							)
						)
				) into json_result;
				
				RETURN json_result;	
		END
		`
  await db.executeQuery(CompiledQuery.raw(query))
}
