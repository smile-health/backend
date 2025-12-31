import { CompiledQuery, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  await db.executeQuery(
    CompiledQuery.raw(`
		DROP FUNCTION IF EXISTS ${process.env.DB_NAME}.get_customers_distribution_consumption_entityTag
		`)
  )

  const query = `
		CREATE FUNCTION ${process.env.DB_NAME}.get_customers_distribution_consumption_entityTag(program_id INT, entity_id INT)
		returns JSON
		DETERMINISTIC
		BEGIN
			DECLARE json_result JSON;

			WITH customerByVendor as (
				select
						wcv.id as customer_vendor_id,
					wcv.customer_id,
					wcv.is_distribution,
					wcv.is_consumption
				from
					ws_customer_vendors as wcv
				where
					wcv.vendor_id = entity_id
					#entity_id in ws_entities
				and
					wcv.program_id = program_id
					#program_id
				and 
					wcv.deleted_at is null
			),
			activities as (
				select
					wcva.customer_vendor_id,
					wcv.customer_id,
					wcva.activity_id
				from
					ws_customer_vendor_activities wcva
				left join ws_customer_vendors wcv on wcva.customer_vendor_id = wcv.id and wcv.deleted_at is null
				where
					wcva.customer_vendor_id in (
						select
							customer_vendor_id
						from
							customerByVendor)
			),
			customer_data as (
				select
					we.id,
					we.name,
					we.address,
					we.code,
					we.status,
					(
						select
							COALESCE(JSON_ARRAYAGG(ac.activity_id), JSON_ARRAY())
						from
							activities as ac
						where
							we.id = ac.customer_id 
					) as 'activities',
					COALESCE(
						JSON_OBJECT(
							'id', et.id,
							'title', et.title,
							'is_open_vial', case when et.id = 10 THEN 1 else 0 end
						), JSON_OBJECT() 
					) as 'entity_tag'
				from
							ws_entities as we
				left join
							entity_tags as et
						on
					we.entity_tag_id = et.id
				where
					we.id IN (
					select
						customer_id
					from
						customerByVendor)
					and we.program_id = program_id
					and we.status = 1
				group by
					we.id
			)	
			
			select JSON_OBJECT(
				'customer_consumptions', (
					ifnull((
						select JSON_ARRAYAGG(
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
					from customer_data as cd
					join customerByVendor as cv on cd.id = cv.customer_id
					where cv.is_consumption = 1
					), JSON_ARRAY())
				),
				'customers', (
					ifnull((
						select JSON_ARRAYAGG(
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
					from customer_data as cd
					join customerByVendor as cv on cd.id = cv.customer_id
					where cv.is_distribution = 1
					), JSON_ARRAY())
				)
			) into json_result;

				RETURN json_result;	
		END
		`
  await db.executeQuery(CompiledQuery.raw(query))
}
