import { PROTOCOL_TYPE } from "@/common/constants/general.js"
import { BaseRepository } from "@/modules/base.repository.js"
import { Context } from "hono"
import { normalizeToYMD } from "../utils/date.utils.js"
import { doEncrypt } from "../utils/transaction.encryption.js"

export class ConsumptionRepository extends BaseRepository<"ws_transactions"> {
  constructor() {
    super("ws_transactions", false, true)
  }

  async getProtocol(c: Context, activityId: number, materialId: number) {
    return c.var.trx
      .selectFrom("ws_material_activities as wma")
      .leftJoin("protocols as wp", "wma.protocol_id", "wp.id")
      .select([
        "wma.protocol_id as protocol_id",
        "wp.name as protocol_name",
        "wp.is_kipi as is_kipi",
        "wp.is_medical_history as is_medical_history",
        "wma.is_patient_needed as is_patient_needed",
      ])
      .where("wma.activity_id", "=", activityId)
      .where("wma.material_id", "=", materialId)
      .where("wp.deleted_at", "is", null)
      .executeTakeFirst()
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
      name: string | null
      phone_number: string | null
      gender: number | null
      birth_date?: string | null
      marital_status?: number
      religion_id?: number | null
      ethnic_id?: number | null
      residential_address?: string | null
      education_id?: number | null
      occupation_id?: number | null
      address?: string | null
      province_id?: number | null
      regency_id?: number | null
      subdistrict_id?: number | null
      village_id?: number | null
      pos_code?: string | null
      rt?: string | null
      rw?: string | null
      residential_province_id?: number | null
      residential_regency_id?: number | null
      residential_subdistrict_id?: number | null
      residential_village_id?: number | null
    }
  ) {
    const encryptedIdentityNumber = doEncrypt(data.identity_number)
    const encryptedPhone = data.phone_number
      ? doEncrypt(data.phone_number)
      : null
    const encryptedName = data.name ? doEncrypt(data.name) : null
    const normalizedBirthDate = data.birth_date
      ? normalizeToYMD(data.birth_date)
      : null
    const encryptedBirthDate = normalizedBirthDate
      ? doEncrypt(normalizedBirthDate)
      : null
    const encryptedAddress = data.address ? doEncrypt(data.address) : null
    const encryptedResidentialAddress = data.residential_address
      ? doEncrypt(data.residential_address)
      : null

    const patientData = {
      identity_type: data.identity_type,
      nik: encryptedIdentityNumber,
      name: encryptedName,
      phone_number: encryptedPhone,
      gender: data.gender || 1,
      birth_date: encryptedBirthDate,
      marital_status: data.marital_status,
      religion_id: data.religion_id,
      ethnic_id: data.ethnic_id,
      residential_address: encryptedResidentialAddress,
      education_id: data.education_id,
      occupation_id: data.occupation_id,
      address: encryptedAddress,
      province_id: data.province_id,
      regency_id: data.regency_id,
      subdistrict_id: data.subdistrict_id,
      village_id: data.village_id,
      pos_code: data.pos_code,
      rt: data.rt,
      rw: data.rw,
      residential_province_id: data.residential_province_id,
      residential_regency_id: data.residential_regency_id,
      residential_subdistrict_id: data.residential_subdistrict_id,
      residential_village_id: data.residential_village_id,
    }

    const patientDataUpdate = Object.fromEntries(
      Object.entries(patientData).filter(([_, v]) => v !== undefined && v !== null)
    )

    delete patientDataUpdate.nik

    return c.var.trx
      .insertInto("ws_patients")
      .values(patientData)
      .onDuplicateKeyUpdate(patientDataUpdate)
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

  async createConsumption(
    c: Context,
    data: {
      transaction_id: number
      patient_id: number
      protocol_id: number | null
      vaccine_sequence_id: number | null
      vaccine_method_id: number | null
      vaccine_type_id: number | null
      actual_date: Date | null
      actual_qty: number
      created_by: number
      updated_by: number
      next_vaccine_date: Date | null
      stop_notification?: 0 | null,
      injection_count: number
    }
  ) {
    return c.var.trx
      .insertInto("ws_consumptions")
      .values(data)
      .executeTakeFirstOrThrow()
  }

  async createConsumptionReaction(
    c: Context,
    consumptionId: number,
    data: {
      reaction_id: number
      other_reaction: string | null
      actual_date: Date | null
    }
  ) {
    return c.var.trx
      .insertInto("ws_consumption_reactions")
      .values({
        consumption_id: consumptionId,
        reaction_id: data.reaction_id,
        other_reaction: data.other_reaction,
        actual_date: data.actual_date,
      })
      .executeTakeFirstOrThrow()
  }

  async createPatientMedicalHistory(
    c: Context,
    patientId: number,
    protocolId: number,
    data: {
      is_diagnose_before: number | null
      diagnosis_date: Date | null
      month_before: number | null
      year_before: number | null
      received_medicine: number | null
      received_vaccine: number | null
      notes: string | null
    }
  ) {
    return c.var.trx
      .insertInto("ws_patient_medical_histories")
      .values({
        patient_id: patientId,
        protocol_id: protocolId,
        ...data,
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

  async getSequenceIds(
    c: Context,
    previousSeq: number,
    beforeSeq: number | null,
    nextSeq: number,
    qty: number
  ) {
    const sequenceIds: number[] = []
    let currentPrev = previousSeq
    let currentBefore = beforeSeq
    let tempIdx = 1

    while (true) {
      let query = c.var.trx
        .selectFrom("ws_vaccine_rules")
        .select("next_sequence")
        .where("previous_sequence", "=", currentPrev)
        .$if(currentBefore != null && currentBefore != undefined, (qb) =>
          qb.where((eb) =>
            eb.or([
              eb("before_sequence", "=", currentBefore!),
              eb("before_sequence", "is", null),
            ])
          )
        )

      if (tempIdx == 1)
        query = query.where((eb) =>
          eb.or([
            eb("prerequisite_qty", "=", qty),
            eb("prerequisite_qty", "is", null),
          ])
        )

      const sequence = await query.executeTakeFirst()

      if (!sequence) break

      const next = Number(sequence.next_sequence)
      sequenceIds.push(next)
      currentBefore = currentPrev
      currentPrev = next
      tempIdx += 1
    }

    const indexOf = sequenceIds.indexOf(nextSeq)

    return {
      next_sequences:
        indexOf >= 0 ? sequenceIds.slice(indexOf + 1) : sequenceIds,
      previous_sequences: indexOf >= 0 ? sequenceIds.slice(0, indexOf) : [],
    }
  }

  async getOtherSequences(c: Context, otherSequencesIds: number[]) {
    return await c.var.trx
      .selectFrom("ws_vaccine_sequences as wvs")
      .leftJoin("vaccine_types as vt", "vt.id", "wvs.type_id")
      .leftJoin("vaccine_methods as vm", "vm.id", "wvs.method_id")
      .select([
        "wvs.id as id",
        "wvs.title as title",
        "wvs.type_id as type_id",
        "vt.title as type_title",
        "wvs.method_id as method_id",
        "vm.title as method_title",
      ])
      .where("wvs.id", "in", otherSequencesIds)
      .orderBy("wvs.sort", "asc")
      .execute()
  }

  async findActualQtyFromSequence(
    c: Context,
    previous_sequence: number,
    next_sequence: number
  ) {
    const vacRule = await c.var.trx
      .selectFrom("ws_vaccine_rules as wvr")
      .innerJoin(
        "ws_vaccine_sequences as wvs",
        "wvs.id",
        "wvr.previous_sequence"
      )
      .select(["wvr.prerequisite_qty", "wvs.method_id", "wvs.type_id"])
      .where("previous_sequence", "=", previous_sequence)
      .where("next_sequence", "=", next_sequence)
      .executeTakeFirst()

    return {
      actualQty: vacRule?.prerequisite_qty || 0,
      method_id: vacRule?.method_id || null,
      type_id: vacRule?.type_id || null,
    }
  }

  async findSequenceById(c: Context, sequencId: number) {
    return await c.var.trx
      .selectFrom("ws_vaccine_sequences")
      .selectAll()
      .where("id", "=", sequencId)
      .executeTakeFirst()
  }
}
