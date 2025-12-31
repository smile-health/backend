import { db } from "@/common/infrastructure/database/index.js"
import { Context } from "hono"
import { GetImportLogQueries } from "./patient.excel.schema.js"
import { normalizeToYMD } from "./utils/date.js"
import { doEncrypt } from "./utils/encryption.js"

export class PatientExcelRepository {
  async getImportLog(c: Context, queries: GetImportLogQueries) {
    const startDate = queries.start_date ? new Date(queries.start_date) : null
    if (startDate) startDate.setUTCHours(0, 0, 0, 0)

    const endDate = queries.end_date ? new Date(queries.end_date) : null
    if (endDate) endDate.setUTCHours(23, 59, 59, 999)

    let query = c.var.trx
      .selectFrom("patient_import_logs")
      .where("deleted_at", "is", null)

    if (startDate) query = query.where("created_at", ">=", startDate)
    if (endDate) query = query.where("created_at", "<=", endDate)

    const [data, count] = await Promise.all([
      query
        .select(["file", "status", "notes", "created_at", "created_by"])
        .limit(queries.paginate)
        .offset((queries.page - 1) * queries.paginate)
        .orderBy("created_at", "desc")
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return { data, total: Number(count.total) }
  }

  async findByTitle(
    c: Context,
    table: "educations" | "occupations" | "religions" | "ethnics",
    title: string
  ): Promise<number | null> {
    const row = await c.var.trx
      .selectFrom(table)
      .select("id")
      .where("deleted_at", "is", null)
      .where("title", "=", title)
      .executeTakeFirst()

    return row?.id ?? null
  }

  async getPatientIdByIdentity(
    c: Context,
    identityType: number,
    identityNumber: string
  ): Promise<number | null> {
    const encryptedIdentityNumber = doEncrypt(identityNumber)

    const res = await c.var.trx
      .selectFrom("ws_patients")
      .select(["id"])
      .where("identity_type", "=", identityType)
      .where("nik", "=", encryptedIdentityNumber)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return res?.id ?? null
  }

  async upsertPatient(
    c: Context,
    data: {
      identity_type: 1 | 2
      identity_number: string
      name: string | null
      phone_number: string | null
      gender: 1 | 2
      date_of_birth: string | null
      marital_status?: number
      religion_id: number | null
      ethnic_id: number | null
      education_id: number | null
      occupation_id: number | null
      province_id: number | null
      regency_id: number | null
      address: string | null
      residential_province_id: number | null
      residential_regency_id: number | null
      residential_address: string | null
    }
  ) {
    const encName = data.name ? doEncrypt(data.name) : null
    const encPhone = data.phone_number ? doEncrypt(data.phone_number) : null
    const encNik = doEncrypt(data.identity_number)
    const encDob = data.date_of_birth
      ? doEncrypt(normalizeToYMD(data.date_of_birth))
      : null
    const encAddress = data.address ? doEncrypt(data.address) : null
    const encResidentialAddress = data.residential_address
      ? doEncrypt(data.residential_address)
      : null

    const patientData = {
      name: encName,
      phone_number: encPhone,
      gender: data.gender,
      birth_date: encDob,
      ...(data.marital_status !== undefined
        ? { marital_status: data.marital_status }
        : {}),
      religion_id: data.religion_id,
      ethnic_id: data.ethnic_id,
      education_id: data.education_id,
      occupation_id: data.occupation_id,
      province_id: data.province_id,
      regency_id: data.regency_id,
      address: encAddress,
      residential_address: encResidentialAddress,
      residential_province_id: data.residential_province_id,
      residential_regency_id: data.residential_regency_id,
    }

    const patientDataUpdate = Object.fromEntries(
      Object.entries(patientData).filter(
        ([, v]) => v !== undefined && v !== null
      )
    )

    return await c.var.trx
      .insertInto("ws_patients")
      .values({
        identity_type: data.identity_type,
        nik: encNik,
        ...patientData,
      })
      .onDuplicateKeyUpdate(patientDataUpdate)
      .executeTakeFirstOrThrow()
  }

  async insertPatientMedicalHistory(
    c: Context,
    data: {
      patientId: number
      protocolId: number
      isDiagnose: 0 | 1
      receivedVaccine: 0 | 1
      month: number | null
      year: number | null
    }
  ) {
    const userId = c.var.user.id

    return await c.var.trx
      .insertInto("ws_patient_medical_histories")
      .values({
        patient_id: data.patientId,
        protocol_id: data.protocolId,
        is_diagnose_before: data.isDiagnose,
        diagnosis_date: null,
        month_before: data.month,
        year_before: data.year,
        received_medicine: null,
        received_vaccine: data.receivedVaccine,
        notes: null,
        created_by: userId,
        updated_by: userId,
      })
      .executeTakeFirstOrThrow()
  }

  async createLogImportPatient(
    c: Context | null,
    data: {
      file: string
      status: number
      notes: string
      created_by: number
      updated_by: number
    }
  ) {
    const conn = c ? c.var.trx : db

    return await conn.insertInto("patient_import_logs").values(data).execute()
  }
}
