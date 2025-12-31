import { CompiledQuery, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const query = `
		CREATE FUNCTION IF NOT EXISTS ${process.env.DB_NAME}.get_vendors_entityTag(program_id INT, entity_id INT)
		RETURNS JSON
		READS SQL DATA
		DETERMINISTIC
		BEGIN
			DECLARE json_result JSON;
			WITH vendorByCustomer as (
				SELECT
					wcv.id as customer_vendor_id,
					wcv.vendor_id as vendor_id
				FROM
					ws_customer_vendors as wcv
				WHERE
					wcv.customer_id = entity_id
				AND
					wcv.program_id = program_id
				AND 
					wcv.deleted_at IS NULL
			),
			activities as (
				SELECT
					wcva.customer_vendor_id,
					wcv.vendor_id,
					wcva.activity_id
				FROM
					ws_customer_vendor_activities wcva
				LEFT JOIN ws_customer_vendors wcv ON wcva.customer_vendor_id = wcv.id AND wcv.deleted_at IS NULL
				WHERE
					wcva.customer_vendor_id IN (
						SELECT
							customer_vendor_id
						FROM
							vendorByCustomer
					)
			),
			vendor_data as (
				SELECT
					we.id,
					we.name,
					we.address,
					we.code,
					we.status,
					(
						SELECT
							COALESCE(JSON_ARRAYAGG(ac.activity_id), JSON_ARRAY())
						FROM
							activities as ac
						WHERE
							we.id = ac.vendor_id 
					) as activities,
					COALESCE(
						JSON_OBJECT(
							'id', et.id,
							'title', et.title
						), JSON_OBJECT() 
					) as entity_tag
				FROM
					ws_entities as we
				LEFT JOIN
					entity_tags as et ON we.entity_tag_id = et.id
				WHERE
					we.id IN (
						SELECT
							vendor_id
						FROM
							vendorByCustomer
					)
					AND we.program_id = program_id
					AND we.status = 1
					AND we.is_vendor = 1
				GROUP BY
					we.id
			)	
			SELECT JSON_OBJECT(
				'vendors', IFNULL((
					SELECT JSON_ARRAYAGG(
						JSON_OBJECT(
							'id', cd.id,
							'name', cd.name,
							'address', cd.address,
							'code', cd.code,
							'status', cd.status,
							'activities', cd.activities,
							'entity_tag', cd.entity_tag
						) 
					)
					FROM vendor_data as cd
					JOIN vendorByCustomer as cv ON cd.id = cv.vendor_id
				), JSON_ARRAY())
			) INTO json_result;
			RETURN json_result;	
		END;
		`
  await db.executeQuery(CompiledQuery.raw(query))
}
