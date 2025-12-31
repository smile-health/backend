import { Context } from "hono"
import { doEncrypt } from "../transaction/utils/transaction.encryption.js"
import {
  CreateChildRegistrationDTO,
  CreateImmunizationDataDTO,
  CreateWeighingHistoryDTO,
  UpdateChildRegistrationDTO,
  UpdateWeighingHistoryDTO,
} from "./immunization.schema.js"

export class ImmunizationRepository {
  async findByIdentityNumber(c: Context, identityNumber: string) {
    const encryptedIdentityNumber = doEncrypt(identityNumber)

    return await c.var.trx
      .selectFrom("ws_patients")
      .select([
        "id",
        "name",
        "address",
        "village_id",
        "pos_code",
        "residential_address",
        "residential_province_id",
        "residential_regency_id",
        "residential_subdistrict_id",
        "residential_village_id",
      ])
      .where("nik", "=", encryptedIdentityNumber)
      .where("identity_type", "=", 1)
      .executeTakeFirst()
  }

  async upsertPatient(c: Context, data: CreateChildRegistrationDTO) {
    const encryptedIdentityNumber = data.nik ? doEncrypt(data.nik) : ""
    const address = data.address ? doEncrypt(data.address) : ""

    const encryptedData = {
      name: data.name ? doEncrypt(data.name) : null,
      gender: data.gender ?? 0,
      birth_date: data.date_of_birth ? doEncrypt(data.date_of_birth) : null,
      phone_number: data.phone_number ? doEncrypt(data.phone_number) : null,
      marital_status: data.marital_status ?? 0,
      education_id: data.education_id ?? null,
      occupation_id: data.occupation_id ?? null,
      religion_id: data.religion_id ?? null,
      ethnic_id: data.ethnic_id ?? null,
      province_id: data.province_id ?? null,
      regency_id: data.regency_id ?? null,
      subdistrict_id: data.subdistrict_id ?? null,
      village_id: data.village_id ?? null,
      address: address,
      residential_province_id: data.residential_province_id
        ? data.residential_province_id
        : data.province_id,
      residential_regency_id: data.residential_regency_id
        ? data.residential_regency_id
        : data.regency_id,
      residential_subdistrict_id: data.residential_subdistrict_id
        ? data.residential_subdistrict_id
        : data.subdistrict_id,
      residential_village_id: data.residential_village_id
        ? data.residential_village_id
        : data.village_id,
      residential_address: data.residential_address
        ? doEncrypt(data.residential_address)
        : address,
    }

    // If NIK is provided, check for existing patient
    if (data.nik && encryptedIdentityNumber) {
      const existing = await c.var.trx
        .selectFrom("ws_patients")
        .select("id")
        .where("nik", "=", encryptedIdentityNumber)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      if (existing) {
        await c.var.trx
          .updateTable("ws_patients")
          .set(encryptedData)
          .where("nik", "=", encryptedIdentityNumber)
          .executeTakeFirstOrThrow()

        return existing.id
      }
    }

    // Insert new patient
    const result = await c.var.trx
      .insertInto("ws_patients")
      .values({
        ...encryptedData,
        nik: encryptedIdentityNumber,
        identity_type: 1,
      })
      .executeTakeFirstOrThrow()

    return Number(result.insertId)
  }

  async updatePatientById(
    c: Context,
    patientId: number,
    data: UpdateChildRegistrationDTO
  ) {
    const encryptedFields = [
      "nik",
      "name",
      "date_of_birth",
      "phone_number",
      "address",
      "residential_address",
    ]

    const fieldMapping: Record<string, string> = {
      date_of_birth: "birth_date",
    }

    const encryptedData: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue

      const dbColumn = fieldMapping[key] ?? key
      encryptedData[dbColumn] = encryptedFields.includes(key)
        ? doEncrypt(value as string)
        : null
    }

    await c.var.trx
      .updateTable("ws_patients")
      .set(encryptedData)
      .where("id", "=", patientId)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()

    return patientId
  }

  async getImmunizationById(c: Context, immunizationId: number) {
    return await c.var.trx
      .selectFrom("ws_patient_immunizations")
      .select(["id", "patient_id", "parent_patient_id"])
      .where("id", "=", immunizationId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async updatePatientIdentityType(
    c: Context,
    patientId: number,
    identityType: string
  ) {
    await c.var.trx
      .updateTable("ws_patient_immunizations")
      .set({ identity_type: identityType })
      .where("id", "=", patientId)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async updatePatientNik(c: Context, patientId: number, nik: string) {
    const encryptedNik = doEncrypt(nik)

    await c.var.trx
      .updateTable("ws_patients")
      .set({ nik: encryptedNik })
      .where("id", "=", patientId)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async upsertImmunization(
    c: Context,
    data: CreateImmunizationDataDTO
  ): Promise<number> {
    const existing = await c.var.trx
      .selectFrom("ws_patient_immunizations")
      .select("id")
      .where("patient_id", "=", data.patient_id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    if (existing) {
      await c.var.trx
        .updateTable("ws_patient_immunizations")
        .set({
          parent_name: data.parent_name,
          identity_type:
            data.identity_type !== undefined
              ? String(data.identity_type)
              : undefined,
          parent_patient_id: data.parent_patient_id,
        })
        .where("patient_id", "=", data.patient_id)
        .executeTakeFirstOrThrow()

      return Number(existing.id)
    } else {
      const result = await c.var.trx
        .insertInto("ws_patient_immunizations")
        .values({
          patient_id: data.patient_id,
          parent_name: data.parent_name,
          identity_type:
            data.identity_type !== undefined
              ? String(data.identity_type)
              : undefined,
          parent_patient_id: data.parent_patient_id,
        })
        .executeTakeFirstOrThrow()

      return Number(result.insertId)
    }
  }

  async createWeighingHistory(c: Context, data: CreateWeighingHistoryDTO) {
    const userId = c.var.userId ?? null

    return await c.var.trx
      .insertInto("ws_immunization_weighing_history")
      .values({
        patient_immunization_id: data.patient_immunization_id,
        input_date: new Date(data.input_date),
        gender: data.gender,
        weight: data.weight,
        height: data.height,
        z_score_weight: data.z_score_weight,
        z_score_height: data.z_score_height,
        z_score_bmi: data.z_score_bmi,
        status: 0,
        created_by: userId,
        updated_by: userId,
      })
      .executeTakeFirstOrThrow()
  }

  async getMaterialTargetsByType(
    c: Context,
    type: "immunization" | "primary" | "additional"
  ) {
    return await c.var.trx
      .selectFrom("ws_material_targets")
      .select([
        "id",
        "material_id",
        "start_ideal_days",
        "end_ideal_days",
        "injection_month",
        "category",
        "type",
      ])
      .where("type", "=", type)
      .where("deleted_at", "is", null)
      .orderBy("start_ideal_days", "asc")
      .execute()
  }

  async bulkInsertPatientImmunizationDetails(
    c: Context,
    details: Array<{
      patient_immunization_id: number
      material_target_id: number
      batch_id: number | null
      ideal_schedule_date: string
      status: number
      last_status: number
      target_group_id: number
    }>
  ) {
    const userId = c.var.userId ?? null

    const values = details.map((detail) => ({
      patient_immunization_id: detail.patient_immunization_id,
      material_target_id: detail.material_target_id,
      batch_id: detail.batch_id,
      ideal_schedule_date: new Date(detail.ideal_schedule_date),
      status: detail.status,
      last_status: detail.last_status,
      target_group_id: detail.target_group_id,
      created_by: userId,
      updated_by: userId,
    }))

    return await c.var.trx
      .insertInto("ws_patient_immunization_details")
      .values(values)
      .executeTakeFirstOrThrow()
  }

  async getExistingMaterialTargetIds(
    c: Context,
    patientImmunizationId: number
  ): Promise<number[]> {
    const results = await c.var.trx
      .selectFrom("ws_patient_immunization_details")
      .select("material_target_id")
      .where("patient_immunization_id", "=", patientImmunizationId)
      .where("deleted_at", "is", null)
      .execute()

    return results.map((r) => r.material_target_id)
  }

  async findByNik(c: Context, nik: string) {
    return await c.var.trx
      .selectFrom("ws_targets as t")
      .leftJoin("educations as edu", "t.education_id", "edu.id")
      .leftJoin("occupations as occ", "t.occupation_id", "occ.id")
      .leftJoin("religions as rel", "t.religion_id", "rel.id")
      .leftJoin("ethnics as eth", "t.ethnic_id", "eth.id")
      .select([
        "t.id",
        "t.nik",
        "t.gender",
        "t.date_of_birth",
        "t.registered_postal_code",
        "t.registered_village_id",
        "t.registered_address",
        "t.residence_postal_code",
        "t.residence_village_id",
        "t.residence_address",
        "t.entity_id",
        "t.grade",
        "t.target_group_id",
        "t.name",
        "t.marital_status",
        "t.education_id",
        "edu.title as education_title",
        "t.occupation_id",
        "occ.title as occupation_title",
        "t.religion_id",
        "rel.title as religion_title",
        "t.ethnic_id",
        "eth.title as ethnic_title",
        "t.phone_number",
      ])
      .where("t.nik", "=", nik)
      .where("t.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getPatientImmunizationDetails(
    c: Context,
    patientImmunizationId: number
  ) {
    const now = new Date()

    return await c.var.trx
      .selectFrom("ws_patient_immunization_details as wpid")
      .leftJoin(
        "ws_material_targets as wmt",
        "wmt.id",
        "wpid.material_target_id"
      )
      .select([
        "wpid.id",
        "wpid.patient_immunization_id",
        "wpid.material_target_id",
        "wpid.batch_id",
        "wpid.ideal_schedule_date",
        "wpid.injection_date",
        "wpid.status",
        "wpid.is_given",
        "wmt.start_ideal_days",
      ])
      .where("wpid.patient_immunization_id", "=", patientImmunizationId)
      .where("wpid.deleted_at", "is", null)
      .where("wpid.ideal_schedule_date", "<=", now)
      .execute()
  }

  async getWeighingHistoryList(c: Context, patientImmunizationId: number) {
    return await c.var.trx
      .selectFrom("ws_immunization_weighing_history as wiwh")
      .leftJoin(
        "ws_patient_immunizations as wpi",
        "wpi.id",
        "wiwh.patient_immunization_id"
      )
      .leftJoin("ws_patients as wp", "wp.id", "wpi.patient_id")
      .select([
        "wiwh.id",
        "wiwh.input_date",
        "wiwh.weight",
        "wiwh.height",
        "wiwh.gender",
        "wiwh.z_score_weight",
        "wiwh.z_score_height",
        "wiwh.z_score_bmi",
        "wiwh.status",
        "wp.birth_date",
      ])
      .where("wiwh.patient_immunization_id", "=", patientImmunizationId)
      .where("wiwh.deleted_at", "is", null)
      .orderBy("wiwh.id", "desc")
      .execute()
  }

  async updateWeighingHistory(
    c: Context,
    id: number,
    patientImmunizationId: number,
    data: UpdateWeighingHistoryDTO
  ) {
    const updateData: any = { updated_by: c.var.userId ?? null }

    if (data.input_date !== undefined)
      updateData.input_date = new Date(data.input_date)
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.weight !== undefined) updateData.weight = data.weight
    if (data.height !== undefined) updateData.height = data.height
    if (data.z_score_weight !== undefined)
      updateData.z_score_weight = data.z_score_weight
    if (data.z_score_height !== undefined)
      updateData.z_score_height = data.z_score_height
    if (data.z_score_bmi !== undefined)
      updateData.z_score_bmi = data.z_score_bmi

    return await c.var.trx
      .updateTable("ws_immunization_weighing_history")
      .set(updateData)
      .where("id", "=", id)
      .where("patient_immunization_id", "=", patientImmunizationId)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async list(c: Context, params, subDistrictId: number) {
    let query = c.var.trx
      .selectFrom("ws_patient_immunizations as wpi")
      .leftJoin("ws_patients as wp", "wp.id", "wpi.patient_id")
      .leftJoin("ws_patients as wpp", "wpp.id", "wpi.parent_patient_id")
      .where("wpi.deleted_at", "is", null)
      .select([
        "wpi.id",
        "wp.nik",
        "wp.name",
        "wp.birth_date",
        "wpi.identity_type",
        "wpp.nik as parent_nik",
      ])

    if (subDistrictId) {
      query = query.where("wp.residential_subdistrict_id", "=", subDistrictId)
    }

    if (params.keyword) {
      const keyword = doEncrypt(params.keyword)

      query = query.where((eb) =>
        eb.or([eb("wp.name", "=", keyword), eb("wp.nik", "=", keyword)])
      )
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.orderBy("wpi.created_at", "desc")

    const [data, total] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .select(c.var.trx.fn.count("wpi.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: data,
      total: Number(total?.total ?? 0),
    }
  }

  async getDetail(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_patient_immunizations as wpi")
      .leftJoin("ws_patients as wp", "wp.id", "wpi.patient_id")
      .leftJoin("ws_patients as wpp", "wpp.id", "wpi.parent_patient_id")
      .where("wpi.deleted_at", "is", null)
      .where("wpi.id", "=", id)
      .select([
        "wpi.id",
        "wpi.patient_id",
        "wp.nik",
        "wp.name",
        "wp.birth_date",
        "wpi.parent_name",
        "wp.gender",
        "wpi.identity_type",
        "wpp.nik as parent_nik",
      ])
      .executeTakeFirst()
  }

  async findImmunizationDetail(
    c: Context,
    patientId: number,
    vaccineId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_patient_immunization_details")
      .selectAll()
      .where("patient_immunization_id", "=", patientId)
      .where("material_target_id", "=", vaccineId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getMaterialTargetWithParent(c: Context, vaccineId: number) {
    return await c.var.trx
      .selectFrom("ws_material_targets")
      .select(["id", "material_id", "parent_id"])
      .where("id", "=", vaccineId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getParentImmunizationStatus(
    c: Context,
    patientId: number,
    parentId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_patient_immunization_details")
      .select(["status", "last_status"])
      .where("patient_immunization_id", "=", patientId)
      .where("material_target_id", "=", parentId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getImmunizationStatus(c: Context, patientImmunizationId: number) {
    const now = new Date()

    return await c.var.trx
      .selectFrom("ws_patient_immunization_details as wpid")
      .leftJoin(
        "ws_material_targets as wmt",
        "wmt.id",
        "wpid.material_target_id"
      )
      .leftJoin("ws_materials as wm", "wm.id", "wmt.material_id")
      .leftJoin("ws_batches as wb", "wb.id", "wpid.batch_id")
      .select([
        "wpid.id",
        "wm.global_id as material_id",
        "wm.name as material_name",
        "wm.is_managed_in_batch",
        "wmt.id as material_target_id",
        "wmt.parent_id",
        "wmt.restricted_ideal_day",
        "wpid.ideal_schedule_date",
        "wpid.injection_date",
        "wpid.status",
        "wpid.is_given",
        "wb.code",
        "wb.id",
        "wmt.category",
      ])
      .where("wpid.patient_immunization_id", "=", patientImmunizationId)
      .where("wpid.deleted_at", "is", null)
      .where("wpid.ideal_schedule_date", "<=", now)
      .orderBy("wpid.ideal_schedule_date", "asc")
      .execute()
  }

  async getBatchesByMaterialIds(
    c: Context,
    materialIds: number[]
  ): Promise<
    Array<{
      material_id: number
      batch_id: number
      batch_code: string
      expired_date: Date | null
    }>
  > {
    if (materialIds.length === 0) return []

    return await c.var.trx
      .selectFrom("ws_batches")
      .select([
        "material_id",
        "id as batch_id",
        "code as batch_code",
        "expired_date",
      ])
      .where("material_id", "in", materialIds)
      .where("deleted_at", "is", null)
      .orderBy("expired_date", "desc")
      .orderBy("code", "asc")
      .execute()
  }

  async updateImmunizationStatus(
    c: Context,
    patientId: number,
    vaccineId: number,
    data: {
      injection_date?: Date | null
      batch_id?: number | null
      status?: number
      is_given?: number
      last_status?: number
      last_batch_id?: number | null
      last_injection_date?: Date | null
    }
  ) {
    return await c.var.trx
      .updateTable("ws_patient_immunization_details")
      .set({ ...data, updated_by: c.var.userId ?? null })
      .where("patient_immunization_id", "=", patientId)
      .where("material_target_id", "=", vaccineId)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async discardWeighingDraft(c: Context, patientImmunizationId: number) {
    return await c.var.trx
      .updateTable("ws_immunization_weighing_history")
      .set({ deleted_at: new Date(), deleted_by: c.var.userId ?? null })
      .where("patient_immunization_id", "=", patientImmunizationId)
      .where("status", "=", 0)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async discardImmunizationDraft(c: Context, patientImmunizationId: number) {
    await c.var.trx
      .updateTable("ws_patient_immunization_details")
      .set((eb) => ({
        batch_id: eb.ref("last_batch_id"),
        injection_date: eb.ref("last_injection_date"),
        status: eb.ref("last_status"),
        is_given: eb.ref("last_is_given"),
        updated_by: c.var.userId ?? null,
      }))
      .where("patient_immunization_id", "=", patientImmunizationId)
      .where("status", "!=", 2)
      .where("last_status", "=", 2)
      .where("deleted_at", "is", null)
      .execute()

    return await c.var.trx
      .updateTable("ws_patient_immunization_details")
      .set({
        batch_id: null,
        injection_date: null,
        status: 0,
        is_given: null,
        updated_by: c.var.userId ?? null,
      })
      .where("patient_immunization_id", "=", patientImmunizationId)
      .where("status", "!=", 2)
      .where((eb) =>
        eb.or([eb("last_status", "!=", 2), eb("last_status", "is", null)])
      )
      .where("deleted_at", "is", null)
      .execute()
  }

  async updateWeighingHistoryStatus(c: Context, id: number) {
    return await c.var.trx
      .updateTable("ws_immunization_weighing_history")
      .set({ status: 1, updated_by: c.var.userId ?? null })
      .where("patient_immunization_id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async updateImmunizationDetailsStatus(
    c: Context,
    patientImmunizationId: number
  ) {
    return await c.var.trx
      .updateTable("ws_patient_immunization_details")
      .set((eb) => ({
        status: 2,
        last_status: 2,
        last_batch_id: eb.ref("batch_id"),
        last_injection_date: eb.ref("injection_date"),
        last_is_given: eb.ref("is_given"),
        updated_by: c.var.userId ?? null,
      }))
      .where("patient_immunization_id", "=", patientImmunizationId)
      .where("status", "=", 1)
      .where("deleted_at", "is", null)
      .execute()
  }

  async checkPatientExists(c: Context, patientId: number): Promise<boolean> {
    const patient = await c.var.trx
      .selectFrom("ws_patients")
      .select("id")
      .where("id", "=", patientId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!patient
  }

  async checkPatientImmunizationExists(
    c: Context,
    id: number
  ): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("ws_patient_immunizations")
      .select("id")
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return !!result
  }

  async findPatientByNik(
    c: Context,
    nik: string,
    excludePatientImmunizationId: number
  ) {
    const encryptedNik = doEncrypt(nik)

    const immunization = await c.var.trx
      .selectFrom("ws_patient_immunizations")
      .select("patient_id")
      .where("id", "=", excludePatientImmunizationId)
      .executeTakeFirst()

    let query = c.var.trx
      .selectFrom("ws_patients")
      .select("id")
      .where("nik", "=", encryptedNik)
      .where("deleted_at", "is", null)

    if (immunization?.patient_id != null) {
      query = query.where("id", "!=", immunization.patient_id)
    }

    return await query.executeTakeFirst()
  }

  async checkImmunizationExists(
    c: Context,
    immunizationId: number
  ): Promise<boolean> {
    const immunization = await c.var.trx
      .selectFrom("ws_patient_immunizations")
      .select("id")
      .where("id", "=", immunizationId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!immunization
  }

  async findById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_patient_immunizations")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }
}
