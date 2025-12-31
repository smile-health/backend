import type { Kysely } from 'kysely'
import { sql } from 'kysely';


export async function up(db: Kysely<any>): Promise<void> {
	// Drop old version if exists
	await sql`DROP FUNCTION IF EXISTS get_customers_distribution_consumption_entityTag`.execute(db);

	await sql`CREATE FUNCTION get_customers_distribution_consumption_entityTag(entity_id BIGINT, program_id BIGINT)
      RETURNS JSON
      LANGUAGE SQL
      DETERMINISTIC
      CONTAINS SQL
      SQL SECURITY DEFINER
      COMMENT 'Returns customer and consumption data as JSON'
      BEGIN
        DECLARE json_result JSON;

        WITH customerByVendor AS (
          SELECT
            wcv.id AS customer_vendor_id,
            wcv.customer_id,
            wcv.is_distribution,
            wcv.is_consumption
          FROM
            ws_customer_vendors AS wcv
          WHERE
            wcv.vendor_id = entity_id
            AND wcv.program_id = program_id
            AND wcv.deleted_at IS NULL
        ),
        activities AS (
          SELECT
            wcva.customer_vendor_id,
            wcv.customer_id,
            wcva.activity_id
          FROM
            ws_customer_vendor_activities wcva
            LEFT JOIN ws_customer_vendors wcv
              ON wcva.customer_vendor_id = wcv.id
              AND wcv.deleted_at IS NULL
          WHERE
            wcva.customer_vendor_id IN (
              SELECT customer_vendor_id FROM customerByVendor
            )
        ),
        customer_data AS (
          SELECT
            we.id,
            we.name,
            we.address,
            we.code,
            we.status,
            (
              SELECT COALESCE(JSON_ARRAYAGG(ac.activity_id), JSON_ARRAY())
              FROM activities AS ac
              WHERE we.id = ac.customer_id
            ) AS activities,
            COALESCE(
              JSON_OBJECT(
                'id', et.id,
                'title', et.title,
                'is_open_vial', CASE WHEN et.id = 10 THEN 1 ELSE 0 END
              ),
              JSON_OBJECT()
            ) AS entity_tag
          FROM ws_entities AS we
          LEFT JOIN entity_tags AS et ON we.entity_tag_id = et.id
          WHERE
            we.id IN (SELECT customer_id FROM customerByVendor)
            AND we.program_id = program_id
            AND we.status = 1
          GROUP BY we.id
        )
        SELECT JSON_OBJECT(
          'customer_consumptions',
          IFNULL((
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
            FROM customer_data AS cd
            JOIN customerByVendor AS cv ON cd.id = cv.customer_id
            WHERE cv.is_consumption = 1
          ), JSON_ARRAY()),
          'customers',
          IFNULL((
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
            FROM customer_data AS cd
            JOIN customerByVendor AS cv ON cd.id = cv.customer_id
            WHERE cv.is_distribution = 1
          ), JSON_ARRAY())
        ) INTO json_result;

        RETURN json_result;
      END;
    `.execute(db);


}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP FUNCTION IF EXISTS get_customers_distribution_consumption_entityTag`.execute(db);
}
