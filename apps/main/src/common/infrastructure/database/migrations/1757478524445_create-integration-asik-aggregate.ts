import { Kysely, sql } from 'kysely';
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('integration_asik_aggregate')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement().notNull())
    .addColumn('customer_id', 'integer')
    .addColumn('pos_imunisasi_asik', 'varchar(255)')
    .addColumn('vendor_id', 'integer')
    .addColumn('puskesmas_asik', 'varchar(255)')
    .addColumn('material_id', 'integer')
    .addColumn('vaksin_asik', 'varchar(255)')
    .addColumn('batch_number_asik', 'varchar(255)')
    .addColumn('batch_id_smile', 'integer')
    .addColumn('batch_code_smile', 'varchar(255)')
    .addColumn('injection_date', 'date')
    .addColumn('aggregate', 'integer')
    .addColumn('input_date', 'date')
    .addColumn('pos_imunisasi_asik_province_id', 'integer')
    .addColumn('pos_imunisasi_asik_regency_id', 'integer')
    .addColumn('pos_imunisasi_asik_subdistrict_id', 'integer')
    .addColumn('puskesmas_asik_province_id', 'integer')
    .addColumn('puskesmas_asik_regency_id', 'integer')
    .addColumn('puskesmas_asik_subdistrict_id', 'integer')
    .addColumn('page', 'integer')
    .$call(addTimestampColumns)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('integration_asik_aggregate').execute();
}