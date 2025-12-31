import { Context } from "hono"
import { EducationRepository } from "../../education/education.repository.js"
import { EthnicRepository } from "../../ethnic/ethnic.repository.js"
import { LocationRepository } from "../../location/location.repository.js"
import { OccupationRepository } from "../../occupation/occupation.repository.js"
import { ReligionRepository } from "../../religion/religion.repository.js"
import { UserRepository } from "../../user/user.repository.js"
import { doDecrypt, doEncrypt } from "../utils/transaction.encryption.js"
import { PatientRepository } from "./patient.repository.js"
import {
  PatientDetailRequestDTO,
  PatientVaccineSequenceRequestDTO,
} from "./patient.schema.js"

export class PatientModule {
  constructor(
    private readonly repo: PatientRepository,
    private readonly educationRepo: EducationRepository,
    private readonly occupationRepo: OccupationRepository,
    private readonly religionRepo: ReligionRepository,
    private readonly ethnicRepo: EthnicRepository,
    private readonly locationRepo: LocationRepository,
    private readonly userRepo: UserRepository
  ) {}

  async getDetail(c: Context, params: PatientDetailRequestDTO) {
    const encryptedNik = doEncrypt(params.nik)

    const patient = await this.repo.findByNik(c, encryptedNik)
    if (!patient) {
      return {
        success: false,
        message: c.var.t("validator.not_exist", {
          field: c.var.t("transaction.export.patient"),
        }),
        data: null,
      }
    }

    return {
      success: true,
      message: c.var.t("validator.exist", {
        field: c.var.t("transaction.export.patient"),
      }),
      data: {
        ...patient,
        nik: doDecrypt(patient.nik),
        name: patient.name ? doDecrypt(patient.name) : null,
        birth_date: patient.birth_date ? doDecrypt(patient.birth_date) : null,
        phone_number: patient.phone_number
          ? doDecrypt(patient.phone_number)
          : null,
        address: patient.address ? doDecrypt(patient.address) : null,
        residential_address: patient.residential_address
          ? doDecrypt(patient.residential_address)
          : null,
      },
    }
  }

  async getVaccineSequence(
    c: Context,
    params: PatientVaccineSequenceRequestDTO
  ) {
    const encryptedNik = doEncrypt(params.nik)

    const patientVaccineSequence = await this.repo.findVaccineSequenceByNik(
      c,
      encryptedNik,
      params.protocol_id
    )

    if (!patientVaccineSequence) {
      return {
        success: false,
        message: c.var.t("validator.not_exist", {
          field: c.var.t("transaction.export.patient"),
        }),
        data: null,
      }
    }

    return {
      success: true,
      message: c.var.t("validator.exist", {
        field: c.var.t("transaction.export.patient"),
      }),
      data: {
        ...patientVaccineSequence,
        nik: doDecrypt(patientVaccineSequence.nik),
        name: patientVaccineSequence.name
          ? doDecrypt(patientVaccineSequence.name)
          : null,
      },
    }
  }

  async getLocationByNik(c: Context, params: { nik: string }) {
    const nik = params.nik

    const provId = Number(nik.substring(0, 2))
    const regId = Number(nik.substring(0, 4))
    const subId = Number(nik.substring(0, 6))

    const [province, regency, subdistrict] = await Promise.all([
      this.locationRepo.findByID(c, provId),
      this.locationRepo.findByID(c, regId),
      this.locationRepo.findByID(c, subId),
    ])

    return {
      data: {
        province: province
          ? { id: province.id, name: province.name }
          : { id: null, name: null },
        regency: regency
          ? { id: regency.id, name: regency.name }
          : { id: null, name: null },
        subdistrict: subdistrict
          ? { id: subdistrict.id, name: subdistrict.name }
          : { id: null, name: null },
      },
    }
  }
}
