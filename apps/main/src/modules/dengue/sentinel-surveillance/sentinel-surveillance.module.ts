import { Context } from "hono"
import { SentinelSurveillanceRepository } from "./sentinel-surveillance.repository.js"
import { doDecrypt } from "@/modules/transaction/utils/transaction.encryption.js"
import {
  GetPatientsQuery,
  GetSpecimensQuery,
  CreateSentinelSurveillanceRequest,
  GetSentinelSurveillanceRequest,
  UpdateSentinelSurveillanceRequest
} from "./sentinel-surveillance.schema.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import moment from "moment"
import { NS1_ID } from "@/common/constants/dengue.js"

export class SentinelSurveillanceModule {
  constructor(
    private readonly repo: SentinelSurveillanceRepository
  ) { }

  async getPatients(c: Context, params: GetPatientsQuery) {
    const { data, total } = await this.repo.getPatients(c, params)

    const decryptedPatients = data.map((patient) => ({
      id: patient.id,
      nik: doDecrypt(patient.nik),
      name: patient.name ? doDecrypt(patient.name) : null,
    }))

    return new PaginatedResponse(params, decryptedPatients, total)
  }

  async getSpecimens(c: Context, params: GetSpecimensQuery) {
    const { data, total } = await this.repo.getSpecimens(c, params)

    const decryptedSpecimens = data.map((specimen) => ({
      id: specimen.id,
      patient_id: specimen.patient_id || null,
      nik: specimen.nik ? doDecrypt(specimen.nik) : null,
      specimen_type_id: Number(specimen.specimen_type_id),
      specimen_type_name: specimen.specimen_type_name,
      specimen_code: specimen.specimen_code,
      collection_date: specimen.collection_date
        ? moment(specimen.collection_date).format("YYYY-MM-DD")
        : null,
      release_date: specimen.release_date
        ? moment(specimen.release_date).format("YYYY-MM-DD")
        : null,
      examination_result_id: Number(specimen.examination_result_id),
      examination_result_name: specimen.examination_method_name,
      specimen_collection: specimen.collection_date != null ? 1 : 0,
      ns1_result: NS1_ID.includes(specimen.examination_result_id) ? 1 : 0,
    }))

    return new PaginatedResponse(params, decryptedSpecimens, total)
  }

  async create(c: Context, body: CreateSentinelSurveillanceRequest) {
    const sentinelId = await this.repo.create(c, body)

    return {
      sentinel_id: sentinelId,
    }
  }

  async list(c: Context, params: GetSentinelSurveillanceRequest) {
    const { data, total } = await this.repo.findAll(c, params)

    const formattedData = data.map((item) => ({
      id: item.id,
      patient_nik: item.patient_nik ? doDecrypt(item.patient_nik) : null,
      specimen_code: item.specimen_code,
      ns1_result: NS1_ID.includes(item.examination_result_id) ? 1 : 0,
      lab_result_name: item.lab_result_name || null,
      created_at: moment(item.created_at).format("YYYY-MM-DD HH:mm:ss"),
      updated_at: moment(item.updated_at).format("YYYY-MM-DD HH:mm:ss"),
      updated_by: item.updated_by ? item.firstname + " " + item.lastname : 'Admin',
    }))

    return new PaginatedResponse(params, formattedData, total)
  }

  async update(c: Context, id: number, body: UpdateSentinelSurveillanceRequest) {
    await this.repo.update(c, id, body)

    return {
      id: id,
    }
  }

  async listPcrLabResult(c: Context) {
    return await this.repo.listPcrLabResult(c)
  }

  async getDetail(c: Context, id: number) {
    const item = await this.repo.findDetailById(c, id)

    if (!item) {
      return null
    }

    return {
      data: {
        id: item.id,
        patient_id: item.patient_id,
        patient_nik: item.patient_nik ? doDecrypt(item.patient_nik) : null,
        specimen_id: item.specimen_id,
        specimen_code: item.specimen_code,
        duration: item.duration,
        case_report_completed: item.case_report_completed,
        lab_result_id: item.lab_result_id,
        lab_result_name: item.lab_result_name,
        specimen_collection: item.collection_date != null ? 1 : 0,
        ns1_result: item.examination_result != null ? 1 : 0,
        updated_at: moment(item.updated_at).format("YYYY-MM-DD HH:mm:ss"),
        updated_by: item.updated_by ? item.firstname + " " + item.lastname : 'Admin',
      }
    }

  }
}