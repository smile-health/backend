import { Context } from "hono"
import { z } from "zod"
import { ImmunizationRepository } from "./immunization.repository.js"
import { getIdentityAndAddressByNIK } from "@/common/utils/verify-nik.js"
import { LocationRepository } from "../location/location.repository.js"
import {
  CreateImmunizationSchema,
  ValidateNikSchema,
  CreateWeighingHistorySchema,
  UpdateWeighingHistorySchema,
  WeighingHistoryIdSchema,
  GetWeighingHistoryListSchema,
  GetImmunizationSchema,
  immunizationId,
  UpdateImmunizationStatusSchema,
  PatientIdSchema,
  UpdateImmunizationSchema,
} from "./immunization.schema.js"

export class ImmunizationMiddleware {
  constructor(
    private readonly repository: ImmunizationRepository,
    private readonly locationRepo: LocationRepository
  ) {}

  validateNIK = (c: Context) => {
    return ValidateNikSchema.superRefine(async (data, ctx) => {
      await this.#validateNIK(c, ctx, data.nik)
    })
  }

  create = (c: Context) => {
    return CreateImmunizationSchema.superRefine(async (data, ctx) => {
      await this.#validateNIK(c, ctx, data.nik ?? "")
    })
  }

  validateId = (c: Context) => {
    return PatientIdSchema.superRefine(async (data, ctx) => {
      this.#validateNumericId(c, ctx, data.id, "id")

      const patientExists =
        await this.repository.checkPatientImmunizationExists(c, Number(data.id))
      if (!patientExists) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.patient_not_found"),
          path: ["id"],
        })
      }
    })
  }

  update = (c: Context) => {
    return UpdateImmunizationSchema.superRefine(async (data, ctx) => {
      if (data.nik) {
        await this.#validateNIK(c, ctx, data.nik)

        const patientId = Number(c.req.param("id"))
        const existingPatient = await this.repository.findPatientByNik(
          c,
          data.nik,
          patientId
        )

        if (existingPatient) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "NIK already exists",
            path: ["nik"],
          })
        }
      }
    })
  }

  createWeighingHistory = (c: Context) => {
    return CreateWeighingHistorySchema.superRefine(async (data, ctx) => {
      const immunizationExists = await this.repository.checkImmunizationExists(
        c,
        data.patient_immunization_id
      )
      if (!immunizationExists) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.immunization_not_found"),
          path: ["patient_immunization_id"],
        })
      }
    })
  }

  updateWeighingHistory = (c: Context) => {
    return UpdateWeighingHistorySchema.superRefine(async (data, ctx) => {
      const hasAnyField =
        data.input_date ||
        data.gender ||
        data.weight ||
        data.height ||
        data.z_score_weight !== undefined ||
        data.z_score_height !== undefined ||
        data.z_score_bmi !== undefined

      if (!hasAnyField) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one field must be provided for update",
          path: ["_"],
        })
      }
    })
  }

  validateWeighingHistoryId = (c: Context) => {
    return WeighingHistoryIdSchema.superRefine(async (data, ctx) => {
      this.#validateNumericId(c, ctx, data.id, "id")
    })
  }

  validatePatientImmunizationId = (c: Context) => {
    return GetWeighingHistoryListSchema.superRefine(async (data, ctx) => {
      this.#validateNumericId(
        c,
        ctx,
        data.patient_immunization_id,
        "patient_immunization_id"
      )

      const immunizationExists = await this.repository.checkImmunizationExists(
        c,
        Number(data.patient_immunization_id)
      )
      if (!immunizationExists) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.immunization_not_found"),
          path: ["patient_immunization_id"],
        })
      }
    })
  }

  list = (c: Context) => {
    return GetImmunizationSchema
  }

  validateImmunizationId = (c: Context) => {
    return immunizationId.superRefine(async (data, ctx) => {
      this.#validateNumericId(c, ctx, data.id, "id")

      const immunization = await this.repository.findById(c, Number(data.id))
      if (!immunization) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.not_exist", {
            field: c.var.t("immunization.label.id"),
          }),
          path: ["id"],
        })
      }
    })
  }

  updateStatus = (c: Context) => {
    return UpdateImmunizationStatusSchema.superRefine(async (data, ctx) => {
      this.#validateVaccineStatusRules(ctx, data)
    })
  }

  readonly #validateNumericId = (
    c: Context,
    ctx: z.RefinementCtx,
    id: string,
    fieldName: string
  ) => {
    const numericId = Number(id)
    if (isNaN(numericId) || numericId <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.invalid_id"),
        path: [fieldName],
      })
    }
  }

  readonly #validateVaccineStatusRules = (
    ctx: z.RefinementCtx,
    data: z.infer<typeof UpdateImmunizationStatusSchema>
  ) => {
    const { vaccine_status, injection_date, batch_id } = data

    if (vaccine_status) {
      if (vaccine_status === "note_with_batch" && !batch_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Batch ID is required for note with batch",
          path: ["batch_id"],
        })
      }

      if (
        (vaccine_status === "note_only_date" ||
          vaccine_status === "note_with_batch") &&
        !injection_date
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Injection date is required",
          path: ["injection_date"],
        })
      }
    } else if (!injection_date && !batch_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least injection_date or batch_id is required",
        path: ["_"],
      })
    }
  }

  readonly #validateNIK = async (
    c: Context,
    ctx: z.RefinementCtx,
    nik: string
  ) => {
    if (!this.#isValidNIKFormat(c, ctx, nik)) {
      return
    }

    try {
      const nikData = await getIdentityAndAddressByNIK(
        c,
        nik,
        this.locationRepo
      )
      this.#validateNIKData(c, ctx, nikData)
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.invalid_nik"),
        path: ["patient", "identity_number"],
      })
    }
  }

  readonly #isValidNIKFormat = (
    c: Context,
    ctx: z.RefinementCtx,
    nik: string
  ): boolean => {
    if (!nik || nik.length !== 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.invalid_nik_length"),
        path: ["patient", "identity_number"],
      })
      return false
    }

    if (!/^\d+$/.test(nik)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.invalid_nik_format"),
        path: ["patient", "identity_number"],
      })
      return false
    }

    return true
  }

  readonly #validateNIKData = (
    c: Context,
    ctx: z.RefinementCtx,
    nikData: any
  ) => {
    if (!nikData.province_id || !nikData.city_id || !nikData.district_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.invalid_nik_location"),
        path: ["patient", "identity_number"],
      })
      return
    }

    const parsedDate = new Date(nikData.date_of_birth)
    const isValidDate =
      parsedDate instanceof Date &&
      !isNaN(parsedDate.getTime()) &&
      parsedDate.getFullYear() === nikData.full_year &&
      parsedDate.getMonth() + 1 === nikData.month_of_birth &&
      parsedDate.getDate() === nikData.actual_day

    if (!isValidDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.invalid_date_of_birth"),
        path: ["patient", "identity_number"],
      })
      return
    }

    if (parsedDate > new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.date_of_birth_future"),
        path: ["patient", "identity_number"],
      })
    }
  }
}
