import { CompiledQuery, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const query = `
		CREATE FUNCTION IF NOT EXISTS ${process.env.DB_NAME}.get_transaction_types_reasons(program_id INT)
		RETURNS JSON
		READS SQL DATA
		DETERMINISTIC
		BEGIN
			DECLARE json_result JSON;
			SELECT JSON_ARRAYAGG(
				JSON_OBJECT(
						'id', wtt.id,
						'title', wtt.title,
						'title_en', wtt.title_en,
						'change_type', wtt.change_type,
						'enable', wtt.enable,
						'transaction_reasons', IFNULL((
								SELECT JSON_ARRAYAGG(
										JSON_OBJECT(
												'id', wtr.id,
												'title', wtr.title,
												'title_en', wtr.title_en,
												'is_other', wtr.is_other,
												'is_purchase', wtr.is_purchase
										)
								) 
								FROM ws_transaction_reasons wtr
								WHERE wtr.transaction_type_id = wtt.id
								AND wtr.status = 1
						), JSON_ARRAY())
				)
			) INTO json_result
			FROM ws_transaction_types wtt
			WHERE wtt.deleted_at IS NULL;
			RETURN json_result;
		END;
		`
  await db.executeQuery(CompiledQuery.raw(query))
}
