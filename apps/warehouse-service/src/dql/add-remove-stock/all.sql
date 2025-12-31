-- transaksi tambah stock all
SELECT 
  -- dtv.transactions_created_at,
  toMonth(
    toDateTime(
      dtv.transactions_created_at, 'Asia/Jakarta'
    )
  ) AS month, 
  toYear(
    toDateTime(
      dtv.transactions_created_at, 'Asia/Jakarta'
    )
  ) AS year, 
  dtv.transactions_transaction_reason_id, 
  wtr.title as reason_title, 
  sum(dtv.transactions_change_qty) as Qty 
from 
  datamart_transactions_v5 dtv final 
  left join raw_ws_transaction_reasons wtr on dtv.transactions_transaction_reason_id = wtr.id 
  and wtr.deleted_at is null 
  inner join raw_ws_entity_activities rwea on rwea.entity_id = dtv.entities_id 
  and rwea.activity_id = dtv.transactions_activity_id 
  and rwea.deleted_at is null 
where 
  dtv.transactions_deleted_at is null 
  and dtv.master_deleted_at is null 
  and dtv.transactions_transaction_type_id = 7 --(tambah stok)
  --  and dtv.transactions_transaction_type_id = 8 --(kurang stok)
  and dtv.entities_status = 1 
  and dtv.entities_type <> 5 --  and dtv.transactions_activity_id IN (1, 2, 3, 4, 7)
  --  and toDateTime(dtv.transactions_created_at, 'Asia/Jakarta') BETWEEN ${start_date} AND ${end_date}
  and rwea.start_date is not null --  and (
  --    (rwea.start_date <= ${end_date} AND rwea.end_date >= ${end_date})
  --    OR (rwea.end_date IS NULL AND rwea.start_date <= ${end_date})
  --  )
group by 
  1, 2, 3, 4 
order by 
  1, 2, 3
