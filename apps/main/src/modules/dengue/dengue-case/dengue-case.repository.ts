import { Context } from "hono"
import { CreateDengueCaseDTO, GetDengueCaseRequest, PatientAddressDTO, PatientDTO, SpecimenDTO } from "./dengue-case.schema.js"
import { doEncrypt } from "@/modules/transaction/utils/transaction.encryption.js"
import { EQUIPMENT, LABORATORY, REAGENT } from "@/common/constants/dengue.js"
import { maritalStatus } from "@/common/constants/marital-status.js"
import moment from "moment"
import { sql } from "kysely"

export class DengueCaseRepository {
  async findByIdentityNumber(c: Context, identityNumber: string) {
    const encryptedIdentityNumber = doEncrypt(identityNumber)

    return await c.var.trx
      .selectFrom("ws_patients as wp")
      .leftJoin('educations as ed', 'ed.id', 'wp.education_id')
      .leftJoin("occupations as o", "o.id", "wp.occupation_id")
      .leftJoin("religions as r", "r.id", "wp.religion_id")
      .leftJoin("ethnics as eth", "eth.id", "wp.ethnic_id")
      .select([
        "wp.id",
        "wp.name",
        "wp.address",
        "wp.village_id",
        "wp.pos_code",
        "wp.residential_address",
        "wp.residential_province_id",
        "wp.residential_regency_id",
        "wp.residential_subdistrict_id",
        "wp.residential_village_id",
        "wp.residential_pos_code",
        "wp.phone_number",
        "wp.marital_status",
        "wp.education_id",
        "ed.title as education_name",
        "wp.occupation_id",
        "o.title as occupation_name",
        "wp.religion_id",
        "r.title as religion_name",
        "wp.ethnic_id",
        "eth.title as ethnic_name",
      ])
      .where("nik", "=", encryptedIdentityNumber)
      .where("identity_type", "=", 1)
      .executeTakeFirst()
  }

  findLocationByCode(c: Context, params: PatientAddressDTO) {
    let query = c.var.trx
      .selectFrom("locations as p")
      .innerJoin("locations as r", "r.parent_id", "p.id")
      .innerJoin("locations as sd", "sd.parent_id", "r.id")
      .innerJoin("locations as v", "v.parent_id", "sd.id")
      .select([
        "p.id as province_id",
        "p.name as province_name",
        "r.id as regency_id",
        "r.name as regency_name",
        "sd.id as subdistrict_id",
        "sd.name as subdistrict_name",
        "v.id as village_id",
        "v.name as village_name",
      ])

    if (params.province_id) {
      query = query.where("p.id", "=", params.province_id)
    }

    if (params.regency_id) {
      query = query.where("r.id", "=", params.regency_id)
    }

    if (params.subdistrict_id) {
      query = query.where("sd.id", "=", params.subdistrict_id)
    }

    if (params.village_id) {
      query = query.where("v.id", "=", params.village_id)
    }

    return query.executeTakeFirst()
  }

  findResidentialLocationByCode(c: Context, params: PatientAddressDTO) {
    let query = c.var.trx
      .selectFrom("locations as p")
      .innerJoin("locations as r", "r.parent_id", "p.id")
      .innerJoin("locations as sd", "sd.parent_id", "r.id")
      .innerJoin("locations as v", "v.parent_id", "sd.id")
      .select([
        "p.id as province_id",
        "p.name as province_name",
        "r.id as regency_id",
        "r.name as regency_name",
        "sd.id as subdistrict_id",
        "sd.name as subdistrict_name",
        "v.id as village_id",
        "v.name as village_name",
      ])

    if (params.residential_province_id) {
      query = query.where("p.id", "=", params.residential_province_id)
    }

    if (params.residential_regency_id) {
      query = query.where("r.id", "=", params.residential_regency_id)
    }

    if (params.residential_subdistrict_id) {
      query = query.where("sd.id", "=", params.residential_subdistrict_id)
    }

    if (params.residential_village_id) {
      query = query.where("v.id", "=", params.residential_village_id)
    }

    return query.executeTakeFirst()
  }

  async listEquipment(c: Context, params) {
    let query = c.var.trx
      .selectFrom("materials")
      .select(["id", "name"])
      .where("material_type_id", "=", EQUIPMENT)
      .where("status", "=", 1)
      .where("deleted_at", "is", null)

    // Filter
    if (params.keyword) {
      query = query.where("name", "like", `%${params.keyword}%`)
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.orderBy("name", "asc")

    const [data, total] = await Promise.all([
      query.execute(),
      c.var.trx
        .selectFrom("materials")
        .select(c.var.trx.fn.count("id").as("total"))
        .where("material_type_id", "=", EQUIPMENT)
        .where("status", "=", 1)
        .where("deleted_at", "is", null)
        .$if(!!params.keyword, (qb) => qb.where("name", "like", `%${params.keyword}%`))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data,
      total: Number(total?.total ?? 0),
    }
  }

  async listClinicalDiagnosis(c: Context) {
    return await c.var.trx
      .selectFrom("clinical_diagnosis")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listLastStatus(c: Context) {
    return await c.var.trx
      .selectFrom("last_status")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listVectorControl(c: Context) {
    return await c.var.trx
      .selectFrom("vector_control")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listSymptoms(c: Context) {
    return await c.var.trx
      .selectFrom("symptoms")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listSpecimenType(c: Context) {
    return await c.var.trx
      .selectFrom("specimen_type")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listExaminationMethod(c: Context) {
    return await c.var.trx
      .selectFrom("examination_method")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listExaminationResult(c: Context) {
    return await c.var.trx
      .selectFrom("examination_result")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listLaboratory(c: Context, params) {
    let query = c.var.trx
      .selectFrom("entities")
      .select(["id", "name"])
      .where("entity_tag_id", "=", LABORATORY)
      .where("deleted_at", "is", null)

    // Filter
    if (params.keyword) {
      query = query.where("name", "like", `%${params.keyword}%`)
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.orderBy("name", "asc")

    const [data, total] = await Promise.all([
      query.execute(),
      c.var.trx
        .selectFrom("entities")
        .select(c.var.trx.fn.count("id").as("total"))
        .where("entity_tag_id", "=", LABORATORY)
        .where("deleted_at", "is", null)
        .$if(!!params.keyword, (qb) => qb.where("name", "like", `%${params.keyword}%`))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data,
      total: Number(total?.total ?? 0),
    }
  }

  async listReagent(c: Context, params) {
    let query = c.var.trx
      .selectFrom("materials")
      .select(["id", "name"])
      .where("material_type_id", "=", REAGENT)
      .where("status", "=", 1)
      .where("deleted_at", "is", null)

    // Filter
    if (params.keyword) {
      query = query.where("name", "like", `%${params.keyword}%`)
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.orderBy("name", "asc")

    const [data, total] = await Promise.all([
      query.execute(),
      c.var.trx
        .selectFrom("materials")
        .select(c.var.trx.fn.count("id").as("total"))
        .where("material_type_id", "=", REAGENT)
        .where("status", "=", 1)
        .where("deleted_at", "is", null)
        .$if(!!params.keyword, (qb) => qb.where("name", "like", `%${params.keyword}%`))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data,
      total: Number(total?.total ?? 0),
    }
  }

  async listLaboratoryAll(c: Context) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id", "name"])
      .where("entity_tag_id", "=", LABORATORY)
      .where("deleted_at", "is", null)
      .execute()
  }

  async listEquipmentAll(c: Context) {
    return c.var.trx
      .selectFrom("materials")
      .select(["id", "name"])
      .where("material_type_id", "=", EQUIPMENT)
      .where("status", "=", 1)
      .where("deleted_at", "is", null)
      .execute()
  }

  async listReagentAll(c: Context) {
    return await c.var.trx
      .selectFrom("materials")
      .select(["id", "name"])
      .where("material_type_id", "=", REAGENT)
      .where("status", "=", 1)
      .where("deleted_at", "is", null)
      .execute()
  }

  async findAll(c: Context, params: GetDengueCaseRequest) {
    const entityId = c.var.user?.entity_id

    let query = c.var.trx
      .selectFrom("ws_patient_dengues as wpd")
      .leftJoin("ws_patients as wp", "wp.id", "wpd.patient_id")
      .leftJoin("ws_specimens as ws", "ws.patient_dengue_id", "wpd.id")
      .leftJoin("clinical_diagnosis as cd", "cd.id", "wpd.clinical_diagnosis_id")
      .leftJoin("last_status as ls", "ls.id", "wpd.last_status_id")
      .leftJoin("examination_method as em", "em.id", "ws.examination_method_id")
      .leftJoin("examination_result as er", "er.id", "ws.examination_result_id")
      .leftJoin("specimen_type as st", "st.id", "ws.specimen_type_id")
      .leftJoin("entities as e", "e.id", "wpd.laboratory_id")
      .leftJoin("users as u", "u.id", "wpd.updated_by")
      .leftJoin('educations as ed', 'ed.id', 'wp.education_id')
      .leftJoin("occupations as o", "o.id", "wp.occupation_id")
      .leftJoin("religions as r", "r.id", "wp.religion_id")
      .leftJoin("ethnics as eth", "eth.id", "wp.ethnic_id")
      .where("wpd.deleted_at", "is", null)
      .where("wpd.entity_id", "=", entityId)
      .select([
        "wpd.id",
        "wp.nik as identity_number",
        "wp.name as name",
        "wp.birth_date",
        "wpd.input_date",
        "wpd.created_at",
        "wpd.updated_at",
        "wpd.updated_by",
        "u.firstname",
        "u.lastname",

        "wp.gender",
        "wp.phone_number",
        "wp.marital_status",
        "wp.education_id",
        "ed.title as education_name",
        "wp.occupation_id",
        "o.title as occupation_name",
        "wp.religion_id",
        "r.title as religion_name",
        "wp.ethnic_id",
        "eth.title as ethnic_name",
        "wp.address",
        "wp.residential_address",
        "wp.village_id",
        "wp.residential_province_id",
        "wp.residential_regency_id",
        "wp.residential_subdistrict_id",
        "wp.residential_village_id",
        "wp.pos_code",
        "wp.residential_pos_code",

        "wpd.clinical_diagnosis_id",
        "cd.name as clinical_diagnosis_name",
        "wpd.symptoms_id",
        "wpd.last_status_id",
        "ls.name as last_status_name",
        "wpd.epidemiology_type",
        "wpd.pe_result_id",
        "wpd.vector_control_id",
        "wpd.laboratory_examination",
        "wpd.examination_type",
        "wpd.laboratory_id",
        "wpd.laboratory_name",
        "e.name as laboratory_id_name",

        "ws.id as specimen_id",
        "ws.specimen_type_id",
        "st.name as specimen_type_name",
        "ws.specimen_code",
        "ws.collection_date",
        "ws.release_date",
        "ws.examination_method_id",
        "em.name as examination_method_name",
        "ws.equipment_id",
        "ws.reagent_id",
        "ws.examination_result_id",
        "er.name as examination_result_name",
      ])

    // Filter
    if (params.keyword) {
      const keyword = doEncrypt(params.keyword)

      query = query.where((eb) =>
        eb.or([
          eb("wp.name", "=", keyword),
          eb("wp.nik", "=", keyword)
        ])
      )
    }

    if (params.start_date && params.end_date) {
      const startDate = moment(params.start_date)
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss")

      const endDate = moment(params.end_date)
        .endOf("day")
        .format("YYYY-MM-DD HH:mm:ss")

      query = query
        .where("wpd.created_at", ">=", startDate)
        .where("wpd.created_at", "<=", endDate)
    }

    if (params.clinical_diagnosis && params.clinical_diagnosis !== 'undefined') {
      query = query.where("wpd.clinical_diagnosis_id", "=", params.clinical_diagnosis)
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.orderBy("wpd.created_at", "desc")

    const [data, total] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .clearLimit()
        .clearOffset()
        .select(c.var.trx.fn.count("wpd.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: data,
      total: Number(total?.total ?? 0),
    }
  }

  async findEquipment(c: Context, ids: number[], type?: number) {
    if (!ids || ids.length === 0) {
      return []
    }

    let query = c.var.trx
      .selectFrom("materials")
      .select(["id", "name"])
      .where("id", "in", ids)
      .where("status", "=", 1)
      .where("deleted_at", "is", null)

    // Filter
    if (type) {
      query = query.where("material_type_id", "=", type)
    }

    return await query.execute()
  }

  async findVectorControl(c: Context, ids: number[]) {
    if (!ids || ids.length === 0) {
      return []
    }

    return await c.var.trx
      .selectFrom("vector_control")
      .select(["id", "name"])
      .where("id", "in", ids)
      .where("deleted_at", "is", null)
      .execute()
  }

  async findSymptoms(c: Context, ids: number[]) {
    if (!ids || ids.length === 0) {
      return []
    }

    return await c.var.trx
      .selectFrom("symptoms")
      .select(["id", "name"])
      .where("id", "in", ids)
      .where("deleted_at", "is", null)
      .execute()
  }

  async findByNikAndInputDate(c: Context, nik: string, inputDate: string) {
    const encryptedNik = doEncrypt(nik)

    // Extract date only (YYYY-MM-DD) from inputDate
    const dateOnly = inputDate.split(' ')[0]

    return await c.var.trx
      .selectFrom("ws_patient_dengues as wpd")
      .innerJoin("ws_patients as wp", "wp.id", "wpd.patient_id")
      .select([
        "wpd.id",
        "wpd.patient_id",
        "wpd.input_date",
        "wp.nik",
        "wp.name",
      ])
      .where("wp.nik", "=", encryptedNik)
      .where(sql`DATE(wpd.input_date)`, "=", dateOnly)
      .where("wpd.deleted_at", "is", null)
      .where("wp.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_patient_dengues")
      .select(["id", "patient_id", "deleted_at"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getLocation(c: Context, level: number) {
    return await c.var.trx
      .selectFrom("locations")
      .select(["id", "name"])
      .where("level", "=", level)
      .execute()
  }

  async list(c: Context, params: GetDengueCaseRequest) {
    const entityId = c.var.user?.entity_id

    let query = c.var.trx
      .selectFrom("ws_patient_dengues as wpd")
      .leftJoin("ws_patients as wp", "wp.id", "wpd.patient_id")
      .leftJoin("clinical_diagnosis as cd", "cd.id", "wpd.clinical_diagnosis_id")
      .leftJoin("users as u", "u.id", "wpd.updated_by")
      .where("wpd.deleted_at", "is", null)
      .where("wpd.entity_id", "=", entityId)
      .select([
        "wpd.id",
        "wp.nik as identity_number",
        "wp.name as name",
        "wp.birth_date",
        "wpd.input_date",
        "wpd.created_at",
        "wpd.updated_at",
        "wpd.updated_by",
        "u.firstname",
        "u.lastname",
        "cd.name as clinical_diagnosis_name",
      ])

    // Filter
    if (params.keyword) {
      const keyword = doEncrypt(params.keyword)

      query = query.where((eb) =>
        eb.or([
          eb("wp.name", "=", keyword),
          eb("wp.nik", "=", keyword)
        ])
      )
    }

    if (params.start_date && params.end_date) {
      const startDate = moment(params.start_date)
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss")

      const endDate = moment(params.end_date)
        .endOf("day")
        .format("YYYY-MM-DD HH:mm:ss")

      query = query
        .where("wpd.created_at", ">=", startDate)
        .where("wpd.created_at", "<=", endDate)
    }

    if (params.clinical_diagnosis) {
      query = query.where("wpd.clinical_diagnosis_id", "=", params.clinical_diagnosis)
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.orderBy("wpd.created_at", "desc")

    const [data, total] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .clearLimit()
        .clearOffset()
        .select(c.var.trx.fn.count("wpd.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: data,
      total: Number(total?.total ?? 0),
    }
  }

  async findDetailById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_patient_dengues as wpd")
      .leftJoin("ws_patients as wp", "wp.id", "wpd.patient_id")
      .leftJoin("ws_specimens as ws", "ws.patient_dengue_id", "wpd.id")
      .leftJoin("clinical_diagnosis as cd", "cd.id", "wpd.clinical_diagnosis_id")
      .leftJoin("last_status as ls", "ls.id", "wpd.last_status_id")
      .leftJoin("vector_control as vc", "vc.id", "wpd.vector_control_id")
      .leftJoin("examination_method as em", "em.id", "ws.examination_method_id")
      .leftJoin("examination_result as er", "er.id", "ws.examination_result_id")
      .leftJoin("specimen_type as st", "st.id", "ws.specimen_type_id")
      .leftJoin("entities as e", "e.id", "wpd.laboratory_id")
      .leftJoin('educations as ed', 'ed.id', 'wp.education_id')
      .leftJoin("occupations as o", "o.id", "wp.occupation_id")
      .leftJoin("religions as r", "r.id", "wp.religion_id")
      .leftJoin("ethnics as eth", "eth.id", "wp.ethnic_id")
      .where("wpd.id", "=", id)
      .where("wpd.deleted_at", "is", null)
      .where("ws.deleted_at", "is", null)
      .select([
        "wpd.id",
        "wp.nik as identity_number",
        "wp.name as name",
        "wp.birth_date",
        "wpd.input_date",

        "wp.gender",
        "wp.phone_number",
        "wp.marital_status",
        "wp.education_id",
        "ed.title as education_name",
        "wp.occupation_id",
        "o.title as occupation_name",
        "wp.religion_id",
        "r.title as religion_name",
        "wp.ethnic_id",
        "eth.title as ethnic_name",
        "wp.address",
        "wp.residential_address",
        "wp.village_id",
        "wp.residential_village_id",
        "wp.pos_code",
        "wp.residential_pos_code",

        "wpd.clinical_diagnosis_id",
        "cd.name as clinical_diagnosis_name",
        "wpd.symptoms_id",
        "wpd.last_status_id",
        "ls.name as last_status_name",
        "wpd.epidemiology_type",
        "wpd.pe_result_id",
        "wpd.vector_control_id",
        "vc.name as vector_control_name",
        "wpd.laboratory_examination",
        "wpd.examination_type",
        "wpd.laboratory_id",
        "wpd.laboratory_name",
        "e.name as laboratory_id_name",

        "ws.id as specimen_id",
        "ws.specimen_type_id",
        "st.name as specimen_type_name",
        "ws.specimen_code",
        "ws.collection_date",
        "ws.release_date",
        "ws.examination_method_id",
        "em.name as examination_method_name",
        "ws.equipment_id",
        "ws.reagent_id",
        "ws.examination_result_id",
        "er.name as examination_result_name",
      ])
      .executeTakeFirst()
  }

  async upsertPatient(c: Context, data: PatientDTO) {
    const encryptedIdentityNumber = doEncrypt(data.nik)

    const encryptedData = {
      name: data.name ? doEncrypt(data.name) : null,
      gender: data.gender,
      birth_date: data.date_of_birth ? doEncrypt(data.date_of_birth) : null,
      marital_status: data.marital_id || 0,
      education_id: data.last_education_id || null,
      occupation_id: data.occupation_id || null,
      religion_id: data.religion_id || null,
      ethnic_id: data.ethnic_id || null,
      phone_number: data.phone ? doEncrypt(data.phone) : null,
      address: data.registered_address ? doEncrypt(data.registered_address) : null,
      province_id: data.registered_province_id || null,
      regency_id: data.registered_city_id || null,
      subdistrict_id: data.registered_district_id || null,
      village_id: data.registered_village_id || null,
      pos_code: data.registered_postal_code || null,
      residential_address: data.residence_address ? doEncrypt(data.residence_address) : null,
      residential_province_id: data.residence_province_id || null,
      residential_regency_id: data.residence_city_id || null,
      residential_subdistrict_id: data.residence_district_id || null,
      residential_village_id: data.residence_village_id || null,
      residential_pos_code: data.residence_postal_code || null,
    }

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
    } else {
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
  }

  async createDengueCase(c: Context, data: CreateDengueCaseDTO) {
    const result = await c.var.trx
      .insertInto("ws_patient_dengues")
      .values(data)
      .executeTakeFirstOrThrow()

    return Number(result.insertId)
  }

  async updateDengueCase(c: Context, id: number, data: CreateDengueCaseDTO) {
    return await c.var.trx
      .updateTable("ws_patient_dengues")
      .set(data)
      .where("id", "=", id)
      .executeTakeFirstOrThrow()
  }

  async createSpecimen(c: Context, data: SpecimenDTO) {
    return await c.var.trx
      .insertInto("ws_specimens")
      .values(data)
      .executeTakeFirstOrThrow()
  }

  async updateSpecimen(c: Context, id: number, data: SpecimenDTO) {
    return await c.var.trx
      .updateTable("ws_specimens")
      .set(data)
      .where("id", "=", id)
      .executeTakeFirstOrThrow()
  }

  async deleteSpecimen(c: Context, id: number) {
    return await c.var.trx
      .deleteFrom("ws_specimens")
      .where("id", "=", id)
      .executeTakeFirstOrThrow()
  }

  async getRecords(c: Context, id: number, params) {
    let query = c.var.trx
      .selectFrom("ws_patient_dengues as wpd")
      .leftJoin("ws_patients as wp", "wp.id", "wpd.patient_id")
      .leftJoin("clinical_diagnosis as cd", "cd.id", "wpd.clinical_diagnosis_id")
      .leftJoin("users as u", "u.id", "wpd.updated_by")
      .where("wp.id", "=", id)
      .where("wpd.deleted_at", "is", null)
      .select([
        "wpd.id",
        "wpd.clinical_diagnosis_id",
        "cd.name as clinical_diagnosis_name",
        "wpd.updated_at",
        "wpd.updated_by",
        "u.firstname",
        "u.lastname",
      ])

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.orderBy("wpd.created_at", "desc")

    const [data, total] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .clearLimit()
        .clearOffset()
        .select(c.var.trx.fn.count("wpd.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data,
      total: Number(total?.total ?? 0),
    }
  }

  async getDetailPatient(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_patient_dengues as wpd")
      .leftJoin("ws_patients as wp", "wp.id", "wpd.patient_id")
      .leftJoin("ws_specimens as ws", "ws.patient_dengue_id", "wpd.id")
      .leftJoin("ws_sentinel_surveillance as wss", (join) =>
        join
          .onRef("wss.patient_id", "=", "wp.id")
          .onRef("wss.specimen_id", "=", "ws.id")
      )
      .leftJoin("clinical_diagnosis as cd", "cd.id", "wpd.clinical_diagnosis_id")
      .leftJoin("last_status as ls", "ls.id", "wpd.last_status_id")
      .leftJoin("vector_control as vc", "vc.id", "wpd.vector_control_id")
      .leftJoin("examination_method as em", "em.id", "ws.examination_method_id")
      .leftJoin("examination_result as er", "er.id", "ws.examination_result_id")
      .leftJoin("specimen_type as st", "st.id", "ws.specimen_type_id")
      .leftJoin("pcr_lab_result as plr", "plr.id", "wss.lab_result_id")
      .leftJoin("entities as e", "e.id", "wpd.laboratory_id")
      .leftJoin("users as u", "u.id", "wpd.updated_by")
      .leftJoin('educations as ed', 'ed.id', 'wp.education_id')
      .leftJoin("occupations as o", "o.id", "wp.occupation_id")
      .leftJoin("religions as r", "r.id", "wp.religion_id")
      .leftJoin("ethnics as eth", "eth.id", "wp.ethnic_id")
      .where("wpd.deleted_at", "is", null)
      .where("wpd.id", "=", id)
      .select([
        "wp.nik",
        "wp.name",
        "wp.gender",
        "wp.birth_date",
        "wpd.input_date",
        "wp.phone_number",
        "wp.marital_status",
        "wp.education_id",
        "ed.title as education_name",
        "wp.occupation_id",
        "o.title as occupation_name",
        "wp.religion_id",
        "r.title as religion_name",
        "wp.ethnic_id",
        "eth.title as ethnic_name",
        "wp.address",
        "wp.residential_address",
        "wp.village_id",
        "wp.residential_village_id",
        "wp.pos_code",

        "wpd.clinical_diagnosis_id",
        "cd.name as clinical_diagnosis_name",
        "wpd.symptoms_id",
        "wpd.last_status_id",
        "ls.name as last_status_name",
        "wpd.epidemiology_type",
        "wpd.pe_result_id",
        "wpd.vector_control_id",
        "wpd.laboratory_examination",
        "wpd.examination_type",
        "wpd.laboratory_id",
        "wpd.laboratory_name",
        "e.name as laboratory_id_name",

        "ws.specimen_type_id",
        "st.name as specimen_type_name",
        "ws.specimen_code",
        "ws.collection_date",
        "ws.release_date",
        "ws.examination_method_id",
        "em.name as examination_method_name",
        "ws.equipment_id",
        "ws.reagent_id",
        "ws.examination_result_id",
        "er.name as examination_result_name",

        "wss.duration",
        "wss.case_report_completed",
        "wss.lab_result_id",
        "plr.name as lab_result_name",
      ])
      .executeTakeFirst()
  }

  async getPatients(c: Context, params) {
    let query = c.var.trx
      .selectFrom("ws_patients as wp")
      .innerJoin("ws_patient_dengues as wpd", "wp.id", "wpd.patient_id")
      .select([
        "wp.id",
        "wp.nik",
        "wp.name",
        "wp.birth_date",
        "wpd.input_date",
      ])

    // Filter
    if (params.keyword) {
      const encryptedKeyword = doEncrypt(params.keyword)
      query = query.where((eb) =>
        eb.or([
          eb("wp.nik", "=", encryptedKeyword),
          eb("wp.name", "=", encryptedKeyword)
        ])
      )
    }

    if (params.start_date && params.end_date) {
      const startDate = moment(params.start_date)
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss")

      const endDate = moment(params.end_date)
        .endOf("day")
        .format("YYYY-MM-DD HH:mm:ss")

      query = query
        .where("wpd.created_at", ">=", startDate)
        .where("wpd.created_at", "<=", endDate)
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.groupBy("wp.id").orderBy("wp.created_at", "desc")

    const [data, total] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .clearGroupBy()
        .clearLimit()
        .clearOffset()
        .select(sql<number>`COUNT(DISTINCT wp.id)`.as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data,
      total: Number(total?.total ?? 0),
    }
  }

  async findPatientById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_patients")
      .select(["id", "nik", "name", "deleted_at"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async listMaritalStatus(c: Context) {
    return maritalStatus.map(item => ({
      id: item.id,
      name: item.title
    }))
  }

  async listEducation(c: Context) {
    return await c.var.trx
      .selectFrom("educations")
      .select(["id", "title as name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listOccupation(c: Context) {
    return await c.var.trx
      .selectFrom("occupations")
      .select(["id", "title as name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listReligion(c: Context) {
    return await c.var.trx
      .selectFrom("religions")
      .select(["id", "title as name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async listEthnicity(c: Context) {
    return await c.var.trx
      .selectFrom("ethnics")
      .select(["id", "title as name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async findSentinelBySpecimen(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_sentinel_surveillance")
      .select("id")
      .where("specimen_id", "=", id)
      .executeTakeFirst()
  }
}
