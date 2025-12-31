import { PROTOCOL_TYPE } from "@/common/constants/general.js"
import { BaseRepository } from "@/modules/base.repository.js"
import { Context } from "hono"
import { doEncrypt } from "../utils/transaction.encryption.js"

export class ConsumptionRabiesRepository extends BaseRepository<"ws_transactions"> {
  constructor() {
    super("ws_transactions", false, true)
  }

  async getRabiesVaccineSequences(c: Context) {
    return c.var.trx
      .selectFrom("rabies_vaccine_types as t")
      .innerJoin("rabies_vaccine_rules as r", "r.type_id", "t.id")
      .innerJoin("rabies_vaccine_methods as m", "m.id", "r.method_id")
      .select([
        "t.id as type_id",
        "t.title as type_title",
        "m.id as method_id",
        "m.title as method_title",
        "m.is_multi_patient",
        "r.id as rule_id",
        "r.title as rule_title",
        "r.min",
        "r.max",
      ])
      .where("m.id", "is not", null)
      .where("r.id", "is not", null)
      .orderBy("t.id")
      .orderBy("m.id")
      .orderBy("r.id")
      .execute()
  }

  async findWsStockByIds(
    c: Context,
    ids: number[],
    programId: number,
    isForUpdate: boolean = true
  ) {
    return c.var.trx
      .selectFrom("ws_stocks as s")
      .leftJoin("ws_activities as a", "s.activity_id", "a.id")
      .select([
        "s.id",
        "s.material_id",
        "s.qty",
        "s.open_vial_qty",
        "s.allocated_qty",
        "s.batch_id",
      ])
      .where("s.id", "in", ids)
      .where("a.program_id", "=", programId)
      .$if(!!isForUpdate, (qb) => qb.forUpdate())
      .execute()
  }

  async findWsEntityActivityByEntityAndActivity(
    c: Context,
    entityId: number,
    activityId: number,
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_entity_activities as wea")
      .leftJoin("ws_activities as a", "wea.activity_id", "a.id")
      .select([
        "wea.id",
        "wea.entity_id",
        "wea.activity_id",
        "wea.start_date",
        "wea.end_date",
      ])
      .where("wea.entity_id", "=", entityId)
      .where("wea.activity_id", "=", activityId)
      .where("a.program_id", "=", programId)
      .executeTakeFirst()
  }

  async findWsTransactionTypeById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("ws_transaction_types")
      .select(["id", "change_type"])
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async updateOrCreatePatient(
    c: Context,
    data: {
      identity_type: number
      identity_number: string
      phone_number: string | null
    }
  ) {
    const encryptedIdentityNumber = doEncrypt(data.identity_number)
    const encryptedPhone = data.phone_number
      ? doEncrypt(data.phone_number)
      : null

    return c.var.trx
      .insertInto("ws_patients")
      .values({
        identity_type: data.identity_type,
        nik: encryptedIdentityNumber,
        phone_number: encryptedPhone,
      })
      .onDuplicateKeyUpdate({
        phone_number: encryptedPhone,
      })
      .executeTakeFirstOrThrow()
  }

  async getPatientIdByIdentity(
    c: Context,
    identityType: number,
    identityNumber: string
  ) {
    const encryptedIdentityNumber = doEncrypt(identityNumber)

    const patient = await c.var.trx
      .selectFrom("ws_patients")
      .select("id")
      .where("identity_type", "=", identityType)
      .where("nik", "=", encryptedIdentityNumber)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()

    return patient.id
  }

  async updateOrCreatePatientRabies(
    c: Context,
    data: {
      patient_id: number
      vaccine_type: number
      vaccine_method: number
      vaccine_sequence: number
      last_vaccine_at: Date
    }
  ) {
    return c.var.trx
      .insertInto("ws_patient_rabies")
      .values({
        patient_id: data.patient_id,
        vaccine_type: data.vaccine_type,
        vaccine_method: data.vaccine_method,
        vaccine_sequence: data.vaccine_sequence,
        last_vaccine_at: data.last_vaccine_at,
      })
      .onDuplicateKeyUpdate({
        vaccine_type: data.vaccine_type,
        vaccine_method: data.vaccine_method,
        vaccine_sequence: data.vaccine_sequence,
        last_vaccine_at: data.last_vaccine_at,
      })
      .executeTakeFirstOrThrow()
  }

  async createConsumption(
    c: Context,
    data: {
      transaction_id: number
      patient_id: number
      protocol_id: number
    }
  ) {
    return c.var.trx
      .insertInto("ws_consumptions")
      .values({
        transaction_id: data.transaction_id,
        patient_id: data.patient_id,
        protocol_id: data.protocol_id,
        vaccine_type_id: 1
      })
      .executeTakeFirstOrThrow()
  }

  async createConsumptionRabies(
    c: Context,
    data: {
      consumption_id: number
      vaccine_type: number
      vaccine_method: number
      vaccine_sequence: number
    }
  ) {
    return c.var.trx
      .insertInto("ws_consumption_rabies")
      .values({
        consumption_id: data.consumption_id,
        vaccine_type: data.vaccine_type,
        vaccine_method: data.vaccine_method,
        vaccine_sequence: data.vaccine_sequence,
      })
      .executeTakeFirstOrThrow()
  }

  async getSumChangeQtyForPatient(
    c: Context,
    patientId: number
  ): Promise<number> {
    const transactions = await c.var.trx
      .selectFrom("ws_consumptions as wc")
      .innerJoin("ws_transactions as wt", "wc.transaction_id", "wt.id")
      .leftJoin("ws_consumption_rabies as wcr", "wc.id", "wcr.consumption_id")
      .leftJoin("rabies_vaccine_rules as rvr", "wcr.vaccine_sequence", "rvr.id")
      .select([
        "wt.change_qty",
        "wt.actual_transaction_date",
        "rvr.active_duration",
      ])
      .where("wc.patient_id", "=", patientId)
      .where("wc.protocol_id", "=", PROTOCOL_TYPE.RABIES)
      .where("wc.deleted_at", "is", null)
      .execute()

    // Filter transactions based on active_duration
    const filteredTransactions = transactions.filter((transaction) => {
      // If active_duration is null, include the transaction
      if (transaction.active_duration === null) {
        return true
      }

      // If actual_transaction_date is null, exclude the transaction
      if (transaction.actual_transaction_date === null) {
        return false
      }

      // Calculate the difference in days between now and actual_transaction_date
      const actualDate = new Date(transaction.actual_transaction_date)
      const now = new Date()
      const daysDiff = Math.floor(
        (now.getTime() - actualDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Include the transaction if daysDiff is less than or equal to active_duration
      return daysDiff <= transaction.active_duration
    })

    // Calculate the sum of change_qty with special handling
    let sum = 0
    for (const transaction of filteredTransactions) {
      const changeQty = transaction.change_qty || 0

      // If change_qty is 0, count as 1
      // If change_qty is negative, take the absolute value
      if (changeQty === 0) {
        sum += 1
      } else if (changeQty < 0) {
        sum += Math.abs(changeQty)
      } else {
        sum += changeQty
      }
    }

    return sum
  }
}
