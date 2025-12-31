import { genders } from "@/common/constants/gender.js"
import { Context } from "hono"
import { DEVICE_TYPE } from "../../../common/constants/device.js"
import { MARITAL_STATUS } from "@/common/constants/dengue.js"
import {
  diffYears,
  formatDateYMD,
  parseDecryptedDate,
} from "../utils/date.utils.js"
import { doDecrypt } from "../utils/transaction.encryption.js"
import { TransactionDetailRepository } from "./detail.repository.js"
import { TransactionDetailRequestDTO } from "./detail.schema.js"

export class TransactionDetailModule {
  constructor(private readonly repo: TransactionDetailRepository) {}

  async detail(c: Context, params: TransactionDetailRequestDTO) {
    const transaction = await this.repo.findTransactionById(c, params.id)

    if (!transaction) {
      return {
        success: false,
        message: c.var.t("validator.not_exist", {
          field: c.var.t("transaction.export.title"),
        }),
        data: null,
      }
    }

    const consumptionDiseaseHistoryPrevention =
      await this.repo.findConsumptionDiseaseHistoryPrevention(
        c,
        transaction.consumption_id,
        transaction.protocol_id
      )

    const patientsData = await this.repo.findPatientsByTransactionId(
      c,
      params.id
    )

    const patients = await Promise.all(
      patientsData.map(async (patient) => {
        const registeredAddressParts = [
          doDecrypt(patient.registered_address || ""),
          patient.village,
          patient.subdistrict,
          patient.regency,
          patient.province,
        ].filter(Boolean)
        const registeredAddress = registeredAddressParts.join(", ")

        const residentialAddressParts = [
          doDecrypt(patient.residential_address || ""),
          patient.residential_village,
          patient.residential_subdistrict,
          patient.residential_regency,
          patient.residential_province,
        ].filter(Boolean)
        const residentialAddress = residentialAddressParts.join(", ")

        const dob = parseDecryptedDate(patient.date_of_birth)
        const ageAtVaccination = diffYears(dob, patient.actual_date)
        const ageNow = diffYears(dob, new Date())

        return {
          vaccination: {
            type: patient.vaccine_type || "",
            method: patient.vaccine_method || "",
            sequence: patient.vaccine_sequence || "",
            age_at_vaccination: ageAtVaccination,
            material_status:
              typeof patient.material_status === "string"
                ? patient.material_status
                : "",
            disease_history: consumptionDiseaseHistoryPrevention ? true : false,
          },
          identity: {
            patient_id: Number(patient.patient_id ?? 0),
            identity_type: patient.identity_type || 0,
            identity_number: doDecrypt(patient.identity_number || ""),
            name: doDecrypt(patient.name || ""),
            gender: patient.gender
              ? c.var.t(`gender.label.${patient.gender}`) ||
                genders.find((el) => el.id === patient.gender)?.title ||
                ""
              : "",
            date_of_birth: formatDateYMD(dob),
            age: ageNow,
            marital_status:
              patient.marital_status > 0
                ? c.var.t(MARITAL_STATUS[patient.marital_status || 2])
                : "",
            education: patient.education
              ? c.var.t(`education.label.${patient.education}`)
              : "",
            occupation: patient.occupation
              ? c.var.t(`occupation.label.${patient.occupation}`)
              : "",
            religion: patient.religion
              ? c.var.t(`religion.label.${patient.religion}`)
              : "",
            ethnicity: patient.ethnicity || "",
            phone_number: doDecrypt(patient.phone_number || ""),
            registered_address: registeredAddress,
            residential_address: residentialAddress,
          },
        }
      })
    )

    const consumptionKipiHistory = await this.repo.findConsumptionKipiHistory(
      c,
      transaction.consumption_id
    )

    return {
      success: true,
      message: c.var.t("validator.exist", {
        field: c.var.t("transaction.export.title"),
      }),
      data: {
        consumption_id: transaction.consumption_id || "",
        protocol: {
          id: transaction.protocol_id || 0,
          name: transaction.protocol || "",
          is_kipi: Boolean(transaction.is_kipi),
          is_medical_history: Boolean(transaction.is_medical_history),
        },
        transaction: {
          activity_name: transaction.activity_name || "",
          material_name: transaction.material_name || "",
          batch_code: transaction.batch_code || "",
          order_id: transaction.order_id || "",
          order_status: transaction.order_status_name
            ? c.var.t(`order.status.${transaction.order_status_name}`)
            : "",
          device: transaction.device_type
            ? Object.keys(DEVICE_TYPE).find(
                (key) =>
                  DEVICE_TYPE[key as keyof typeof DEVICE_TYPE] ===
                  transaction.device_type
              ) || ""
            : "",
          manufacturer: transaction.manufacturer || "",
          production_date: transaction.production_date
            ? transaction.production_date.toISOString()
            : "",
          expired_date: transaction.expired_date
            ? transaction.expired_date.toISOString()
            : "",
          actual_transaction_date: transaction.actual_transaction_date
            ? transaction.actual_transaction_date.toISOString()
            : "",
          entity_name: transaction.entity_name || "",
          created_at: transaction.created_at
            ? transaction.created_at.toISOString()
            : "",
          created_by: transaction.created_by?.toString() || "",
        },
        patients: patients,
        consumption: {
          kipi_history: consumptionKipiHistory.map((kipi) => ({
            reaction: c.var.t("reaction.label." + kipi.reaction) || "",
            other_reaction: kipi.other_reaction || "",
            reaction_date: kipi.reaction_date
              ? kipi.reaction_date.toISOString()
              : "",
            sequence_name: kipi.sequence_name || "",
          })),
          disease_history_prevention: {
            has_dengue_before: Boolean(
              consumptionDiseaseHistoryPrevention?.has_dengue_before
            ),
            last_dengue_month:
              consumptionDiseaseHistoryPrevention?.last_dengue_month
                ? new Intl.DateTimeFormat(
                    c.var.language === "id" ? "id-ID" : "en-US",
                    { month: "short" }
                  ).format(
                    new Date(
                      2000,
                      consumptionDiseaseHistoryPrevention.last_dengue_month - 1
                    )
                  )
                : "",
            last_dengue_year:
              consumptionDiseaseHistoryPrevention?.last_dengue_year || 0,
            has_voluntary_vaccination: Boolean(
              consumptionDiseaseHistoryPrevention?.has_voluntary_vaccination
            ),
          },
        },
      },
    }
  }
}
