import { Kysely, sql } from 'kysely';
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('integration_ayo_sehat')
    .addColumn('id', 'bigint', (col) => col.primaryKey().autoIncrement().notNull())
    .addColumn('vendor_id', 'integer')
    .addColumn('customer_id', 'integer')
    .addColumn('activity_id', 'integer')
    .addColumn('material_id', 'integer')
    .addColumn('stock_id', 'bigint')
    .addColumn('batch_id', 'bigint')
    .addColumn('status_vvm', 'boolean')
    .addColumn('consumed_qty', 'decimal')
    .addColumn('consumed_qty_openvial', 'decimal')
    .addColumn('consumed_qty_closevial', 'decimal')
    .addColumn('transaction_id_consumed', 'integer')
    .addColumn('created_at_consumed_smile', 'datetime')
    .addColumn('consumed_status', 'boolean')
    .addColumn('session_id', 'varchar(255)')
    .addColumn('transaction_id_return', 'integer')
    .addColumn('return_qty', 'decimal')
    .addColumn('return_qty_openvial', 'decimal')
    .addColumn('return_qty_closevial', 'decimal')
    .addColumn('transaction_id_injection', 'integer')
    .addColumn('injection_qty', 'decimal')
    .addColumn('created_at_injection', 'datetime')
    .addColumn('created_at_return_vaccination', 'datetime')
    .addColumn('updated_at_return_vaccination', 'datetime')
    .addColumn('return_status', 'boolean')
    .addColumn('return_validation', 'boolean')
    .addColumn('created_by', 'bigint')
    .addColumn('integration_status', 'boolean', (col) => col.notNull().defaultTo(false))
    .$call(addTimestampColumns)
    .execute();

  // Add indexes
  await db.schema.createIndex('integration_ayo_sehat_vendor_id').on('integration_ayo_sehat').column('vendor_id').execute();
  await db.schema.createIndex('integration_ayo_sehat_customer_id').on('integration_ayo_sehat').column('customer_id').execute();
  await db.schema.createIndex('integration_ayo_sehat_activity_id').on('integration_ayo_sehat').column('activity_id').execute();
  await db.schema.createIndex('integration_ayo_sehat_material_id').on('integration_ayo_sehat').column('material_id').execute();
  await db.schema.createIndex('integration_ayo_sehat_stock_id').on('integration_ayo_sehat').column('stock_id').execute();
  await db.schema.createIndex('integration_ayo_sehat_batch_id').on('integration_ayo_sehat').column('batch_id').execute();
  await db.schema.createIndex('integration_ayo_sehat_transaction_id_consumed').on('integration_ayo_sehat').column('transaction_id_consumed').execute();
  await db.schema.createIndex('integration_ayo_sehat_consumed_status').on('integration_ayo_sehat').column('consumed_status').execute();
  await db.schema.createIndex('integration_ayo_sehat_session_id').on('integration_ayo_sehat').column('session_id').execute();
  await db.schema.createIndex('integration_ayo_sehat_transaction_id_return').on('integration_ayo_sehat').column('transaction_id_return').execute();
  await db.schema.createIndex('integration_ayo_sehat_transaction_id_injection').on('integration_ayo_sehat').column('transaction_id_injection').execute();
  await db.schema.createIndex('integration_ayo_sehat_created_at_return_vaccination').on('integration_ayo_sehat').column('created_at_return_vaccination').execute();
  await db.schema.createIndex('integration_ayo_sehat_updated_at_return_vaccination').on('integration_ayo_sehat').column('updated_at_return_vaccination').execute();
  await db.schema.createIndex('integration_ayo_sehat_return_status').on('integration_ayo_sehat').column('return_status').execute();
  await db.schema.createIndex('integration_ayo_sehat_return_validation').on('integration_ayo_sehat').column('return_validation').execute();
  await db.schema.createIndex('integration_ayo_sehat_created_at').on('integration_ayo_sehat').column('created_at').execute();
  await db.schema.createIndex('integration_ayo_sehat_updated_at').on('integration_ayo_sehat').column('updated_at').execute();
  await db.schema.createIndex('integration_ayo_sehat_created_by').on('integration_ayo_sehat').column('created_by').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('integration_ayo_sehat').execute();
}