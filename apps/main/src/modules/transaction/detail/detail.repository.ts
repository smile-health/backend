import { Context } from "hono"
import { sql } from "kysely"

export class TransactionDetailRepository {
  async findTransactionById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("ws_transactions as wt")
      .leftJoin("ws_consumptions as wc", (join) =>
        join.on((eb) =>
          eb.or([
            eb("wt.id", "=", eb.ref("wc.transaction_id")),
            eb("wt.id", "=", eb.ref("wc.return_transaction_id")),
          ])
        )
      )
      .leftJoin("ws_stocks as ws", "wt.stock_id", "ws.id")
      .leftJoin("ws_activities as wa", "wt.activity_id", "wa.id")
      .leftJoin("ws_materials as wm", "ws.material_id", "wm.id")
      .leftJoin("ws_batches as wb", "ws.batch_id", "wb.id")
      .leftJoin("ws_manufactures as wmf", "wb.manufacture_id", "wmf.id")
      .leftJoin("ws_entities as we", "wt.entity_id", "we.id")
      .leftJoin("ws_orders as wo", "wt.order_id", "wo.id")
      .leftJoin("ws_order_statuses as wos", "wo.order_status_id", "wos.id")
      .leftJoin("ws_users as wu", "wt.created_by", "wu.id")
      .leftJoin("protocols as wp", "wc.protocol_id", "wp.id")
      .select([
        sql<number>`wp.id`.as("protocol_id"),
        sql<string>`wp.name`.as("protocol"),
        "wp.is_kipi",
        "wp.is_medical_history",
        sql<string>`wm.name`.as("material_name"),
        sql<string>`wb.code`.as("batch_code"),
        sql<string>`wa.name`.as("activity_name"),
        "wt.device_type",
        sql<string>`wmf.name`.as("manufacturer"),
        "wb.production_date",
        "wb.expired_date",
        "wt.actual_transaction_date",
        sql<string>`we.name`.as("entity_name"),
        sql<number>`wo.id`.as("order_id"),
        sql<string>`wos.name`.as("order_status_name"),
        "wt.created_at",
        sql<string>`wu.username`.as("created_by"),
        sql<number>`wc.id`.as("consumption_id"),
      ])
      .where("wt.id", "=", id)
      .where("wt.deleted_at", "is", null)
      .where("ws.deleted_at", "is", null)
      .where("wm.deleted_at", "is", null)
      .where("wb.deleted_at", "is", null)
      .where("wmf.deleted_at", "is", null)
      .where("we.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findConsumptionDiseaseHistoryPrevention(
    c: Context,
    consumptionId: number,
    protocolId: number
  ) {
    return c.var.trx
      .selectFrom("ws_patient_medical_histories as wpmh")
      .leftJoin("ws_consumptions as wc", "wpmh.patient_id", "wc.patient_id")
      .select([
        "wpmh.is_diagnose_before as has_dengue_before",
        "wpmh.month_before as last_dengue_month",
        "wpmh.year_before as last_dengue_year",
        "wpmh.received_vaccine as has_voluntary_vaccination",
      ])
      .where("wc.id", "=", consumptionId)
      .where("wpmh.protocol_id", "=", protocolId)
      .where("wpmh.deleted_at", "is", null)
      .orderBy("wpmh.year_before", "desc")
      .orderBy("wpmh.month_before", "desc")
      .executeTakeFirst()
  }

  async findPatientsByTransactionId(c: Context, transactionId: number) {
    return c.var.trx
      .selectFrom("ws_consumptions as wc")
      .leftJoin("ws_patients as wp", "wc.patient_id", "wp.id")
      .leftJoin("vaccine_types as vt", "wc.vaccine_type_id", "vt.id")
      .leftJoin("vaccine_methods as vm", "wc.vaccine_method_id", "vm.id")
      .leftJoin(
        "ws_vaccine_sequences as wvs",
        "wc.vaccine_sequence_id",
        "wvs.id"
      )
      .leftJoin("ws_transactions as wt", "wc.transaction_id", "wt.id")
      .leftJoin("ws_stocks as ws", "wt.stock_id", "ws.id")
      .leftJoin("ws_stock_qualities as wsq", "ws.stock_quality_id", "wsq.id")
      .leftJoin("locations as l_province", "wp.province_id", "l_province.id")
      .leftJoin("locations as l_regency", "wp.regency_id", "l_regency.id")
      .leftJoin(
        "locations as l_subdistrict",
        "wp.subdistrict_id",
        "l_subdistrict.id"
      )
      .leftJoin("locations as l_village", "wp.village_id", "l_village.id")
      .leftJoin(
        "locations as l_residential_province",
        "wp.residential_province_id",
        "l_residential_province.id"
      )
      .leftJoin(
        "locations as l_residential_regency",
        "wp.residential_regency_id",
        "l_residential_regency.id"
      )
      .leftJoin(
        "locations as l_residential_subdistrict",
        "wp.residential_subdistrict_id",
        "l_residential_subdistrict.id"
      )
      .leftJoin(
        "locations as l_residential_village",
        "wp.residential_village_id",
        "l_residential_village.id"
      )
      .leftJoin("educations as e", "wp.education_id", "e.id")
      .leftJoin("occupations as o", "wp.occupation_id", "o.id")
      .leftJoin("religions as r", "wp.religion_id", "r.id")
      .leftJoin("ethnics as et", "wp.ethnic_id", "et.id")
      .select([
        "wc.id as consumption_id",
        "wc.actual_date",
        "vt.title as vaccine_type",
        "vm.title as vaccine_method",
        "wvs.title as vaccine_sequence",
        sql<string>`wsq.label`.as("material_status"),
        "wp.id as patient_id",
        "wp.identity_type",
        "wp.nik as identity_number",
        "wp.name",
        "wp.gender",
        "wp.birth_date as date_of_birth",
        "l_province.name as province",
        "l_regency.name as regency",
        "l_subdistrict.name as subdistrict",
        "l_village.name as village",
        "l_residential_province.name as residential_province",
        "l_residential_regency.name as residential_regency",
        "l_residential_subdistrict.name as residential_subdistrict",
        "l_residential_village.name as residential_village",
        "e.title as education",
        "o.title as occupation",
        "r.title as religion",
        "et.title as ethnicity",
        "wp.phone_number",
        "wp.address as registered_address",
        "wp.residential_address",
        "wp.marital_status",
      ])
      .where((eb) =>
        eb.or([
          eb("wc.transaction_id", "=", transactionId),
          eb("wc.return_transaction_id", "=", transactionId),
        ])
      )
      .where("wp.deleted_at", "is", null)
      .execute()
  }

  async findConsumptionKipiHistory(c: Context, consumptionId: number) {
    return c.var.trx
      .selectFrom("ws_consumption_reactions as wcr")
      .leftJoin("reactions as r", "wcr.reaction_id", "r.id")
      .leftJoin("ws_consumptions as wc", "wcr.consumption_id", "wc.id")
      .leftJoin(
        "ws_vaccine_sequences as wvs",
        "wc.vaccine_sequence_id",
        "wvs.id"
      )
      .select([
        "r.title as reaction",
        "wcr.other_reaction",
        "wcr.actual_date as reaction_date",
        "wvs.title as sequence_name",
      ])
      .where("wcr.consumption_id", "=", consumptionId)
      .where("wcr.deleted_at", "is", null)
      .execute()
  }
}
