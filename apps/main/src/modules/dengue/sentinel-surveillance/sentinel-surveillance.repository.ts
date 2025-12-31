import { Context } from "hono"
import { doEncrypt } from "@/modules/transaction/utils/transaction.encryption.js"
import {
  GetPatientsQuery,
  GetSpecimensQuery,
  CreateSentinelSurveillanceRequest,
  GetSentinelSurveillanceRequest,
  UpdateSentinelSurveillanceRequest
} from "./sentinel-surveillance.schema.js"
import moment from "moment"
import { LABORATORY_EXAMINATION } from "@/common/constants/dengue.js"

export class SentinelSurveillanceRepository {
  async getPatients(c: Context, params: GetPatientsQuery) {
    let query = c.var.trx
      .selectFrom("ws_patients as wp")
      .innerJoin("ws_patient_dengues as wpd", "wpd.patient_id", "wp.id")
      .where("wpd.laboratory_examination", "=", LABORATORY_EXAMINATION)
      .where("wp.deleted_at", "is", null)
      .select([
        "wp.id",
        "wp.nik",
        "wp.name",
        "wp.created_at",
      ])


    // filter
    if (params.keyword) {
      const encryptedKeyword = doEncrypt(params.keyword)
      query = query.where((eb) =>
        eb.or([
          eb("wp.nik", "=", encryptedKeyword),
          eb("wp.name", "=", encryptedKeyword)
        ])
      )
    }

    if (params.nik) {
      const encryptedNIK = doEncrypt(params.nik)
      query = query.where("wp.nik", "=", encryptedNIK)
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
        .select(c.var.trx.fn.count("wp.id").as("total"))
        .executeTakeFirst(),
    ])

    return {
      data,
      total: Number(total?.total ?? 0),
    }
  }

  async getSpecimens(c: Context, params: GetSpecimensQuery) {
    let query = c.var.trx
      .selectFrom("ws_specimens as ws")
      .innerJoin("ws_patients as wp", "wp.id", "ws.patient_id")
      .leftJoin("examination_method as em", "em.id", "ws.examination_method_id")
      .leftJoin("specimen_type as st", "st.id", "ws.specimen_type_id")
      .select([
        "ws.id",
        "wp.id as patient_id",
        "wp.nik",
        "ws.specimen_type_id",
        "st.name as specimen_type_name",
        "ws.specimen_code",
        "ws.collection_date",
        "ws.release_date",
        "ws.examination_method_id",
        "em.name as examination_method_name",
        "ws.examination_result_id",
      ])
      .where("wp.deleted_at", "is", null)

    // Filter by NIK (multiple)
    if (params.nik && params.nik.length > 0) {
      const encryptedNIKs = params.nik.map(nik => doEncrypt(nik))
      query = query.where("wp.nik", "in", encryptedNIKs)
    }

    // Filter by specimen ID (multiple)
    if (params.specimen_id && params.specimen_id.length > 0) {
      query = query.where("ws.id", "in", params.specimen_id)
    }

    // Filter by specimen code
    if (params.keyword) {
      query = query.where("ws.specimen_code", "like", `%${params.keyword}%`)
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.orderBy("ws.created_at", "desc")

    const [data, total] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .clearLimit()
        .clearOffset()
        .select(c.var.trx.fn.count("ws.id").as("total"))
        .executeTakeFirst(),
    ])

    return {
      data,
      total: Number(total?.total ?? 0),
    }
  }

  async create(c: Context, data: CreateSentinelSurveillanceRequest) {
    const entityId = c.var.user?.entity_id

    const result = await c.var.trx
      .insertInto("ws_sentinel_surveillance")
      .values({
        patient_id: data.patient_id,
        specimen_id: data.specimen_id,
        duration: data.duration,
        case_report_completed: data.case_report_completed ?? false,
        lab_result_id: data.lab_result_id,
        entity_id: entityId,
      })
      .executeTakeFirstOrThrow()

    return Number(result.insertId)
  }

  async findById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_sentinel_surveillance")
      .select([
        "id",
      ])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findPatientById(c: Context, patientId: number) {
    return await c.var.trx
      .selectFrom("ws_patients")
      .select("id")
      .where("id", "=", patientId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findSpecimenById(c: Context, specimenId: number) {
    return await c.var.trx
      .selectFrom("ws_specimens")
      .select("id")
      .where("id", "=", specimenId)
      .executeTakeFirst()
  }

  async findAll(c: Context, params: GetSentinelSurveillanceRequest) {
    const entityId = c.var.user?.entity_id

    let query = c.var.trx
      .selectFrom("ws_sentinel_surveillance as wss")
      .innerJoin("ws_patients as wp", "wp.id", "wss.patient_id")
      .innerJoin("ws_specimens as ws", "ws.id", "wss.specimen_id")
      .leftJoin("pcr_lab_result as lr", "lr.id", "wss.lab_result_id")
      .leftJoin("users as u", "u.id", "wss.updated_by")
      .select([
        "wss.id",
        "wp.nik as patient_nik",
        "ws.specimen_code",
        "wss.lab_result_id",
        "lr.name as lab_result_name",
        "ws.examination_result_id",
        "wss.created_at",
        "wss.updated_at",
        "wss.updated_by",
        "u.firstname",
        "u.lastname",
      ])
      .where("wss.entity_id", "=", entityId)
      .where("wss.deleted_at", "is", null)
      .where("wp.deleted_at", "is", null)

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

    if (params.specimen_id) {
      query = query.where("ws.id", "=", params.specimen_id)
    }

    if (params.start_date && params.end_date) {
      const startDate = moment(params.start_date)
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss")

      const endDate = moment(params.end_date)
        .endOf("day")
        .format("YYYY-MM-DD HH:mm:ss")

      query = query
        .where("wss.created_at", ">=", startDate)
        .where("wss.created_at", "<=", endDate)
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    query = query.orderBy("wss.created_at", "desc")

    const [data, total] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .clearLimit()
        .clearOffset()
        .select(c.var.trx.fn.count("wss.id").as("total"))
        .executeTakeFirst(),
    ])

    return {
      data,
      total: Number(total?.total ?? 0),
    }
  }

  async findDetailById(c: Context, id: number) {
    const entityId = c.var.user?.entity_id

    return await c.var.trx
      .selectFrom("ws_sentinel_surveillance as wss")
      .innerJoin("ws_patients as wp", "wp.id", "wss.patient_id")
      .innerJoin("ws_specimens as ws", "ws.id", "wss.specimen_id")
      .leftJoin("pcr_lab_result as lr", "lr.id", "wss.lab_result_id")
      .leftJoin("users as u", "u.id", "wss.updated_by")
      .select([
        "wss.id",
        "wp.id as patient_id",
        "wp.nik as patient_nik",
        "wp.name as patient_name",
        "wss.specimen_id",
        "ws.specimen_code",
        "wss.duration",
        "wss.case_report_completed",
        "wss.lab_result_id",
        "lr.name as lab_result_name",
        "ws.collection_date",
        "ws.examination_result_id",
        "wss.created_at",
        "wss.updated_at",
        "wss.updated_by",
        "u.firstname",
        "u.lastname",
      ])
      .where("wss.entity_id", "=", entityId)
      .where("wss.deleted_at", "is", null)
      .where("wp.deleted_at", "is", null)
      .where("wss.id", "=", id)
      .executeTakeFirst()
  }

  async update(c: Context, id: number, data: UpdateSentinelSurveillanceRequest) {
    await c.var.trx
      .updateTable("ws_sentinel_surveillance")
      .set(data)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async listPcrLabResult(c: Context) {
    return await c.var.trx
      .selectFrom("pcr_lab_result")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async findPcrLabResultById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("pcr_lab_result")
      .select(["id", "name"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }
}
