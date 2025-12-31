select 
 dodv.entities_id,
 dodv.entity_name,
-- toDate(toDateTime(dodv.created_at, 'Asia/Jakarta')) as day,
-- toWeek(toDateTime(dodv.created_at, 'Asia/Jakarta')) as week,
-- formatDateTime(toDateTime(dodv.created_at, 'Asia/Jakarta'), '%Y-%m')as month,
 sum(dodv.ordered) as dipesan,
 sum(dodv.recommended) as direkomendasikan,
 sum(dodv.sent) as dikirimkan,
 sum(dodv.received) as diterima
from datamart_order_difference_v5 dodv final
where dodv.deleted_at is null
and dodv.entity_type <> 5
and dodv.entity_status = 1
and ((dodv.entity_activity_start_date <= toDate(${currentDate}) and dodv.entity_activity_end_date >= toDate(${currentDate})) or (dodv.entity_activity_end_date is null and dodv.entity_activity_start_date <= toDate(${currentDate})))--and toDate(dodv.created_at + interval 7 hours) between {from:DateTime('Asia/Jakarta')} and {to:DateTime('Asia/Jakarta')}
--and dodv.activity_id in (${activity_id})
--and dodv.entity_province_id = ${province_id}
--and dodv.entity_regency_id = ${regency_id}
--and dodv.entities_id = ${entity_id}
--and dodv.entity_tag_id in (${entity_tag_id})
--and dodv.master_material_id in (${material_id})
--and material_type_id in (${material_type_id})
--and dodv.reason_id = ${reason_id}
group by 1,2
-- order by 3 asc