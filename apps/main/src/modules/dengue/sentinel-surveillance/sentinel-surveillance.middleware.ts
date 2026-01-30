import { Context } from "hono"
import { z } from "zod"
import {
  GetPatientsQuerySchema,
  GetSpecimensQuerySchema,
  CreateSentinelSurveillanceSchema,
  GetSentinelSurveillanceRequestSchema,
  GetSentinelSurveillanceIndexSchema,
  UpdateSentinelSurveillanceSchema,
  ValidateIdParamSchema,
  sentinelSurveillanceId,
} from "./sentinel-surveillance.schema.js"
import { SentinelSurveillanceRepository } from "./sentinel-surveillance.repository.js"
import { ValidationError } from "@smile-health/lib/error.js"

export class SentinelSurveillanceMiddleware {
  constructor(
    private readonly sentinelRepo: SentinelSurveillanceRepository
  ) { }

  validateNIK = () => {
    return GetPatientsQuerySchema
  }

  validateSpecimensQuery = () => {
    return GetSpecimensQuerySchema
  }

  list = () => {
    return GetSentinelSurveillanceRequestSchema
  }

  listIndex = () => {
    return GetSentinelSurveillanceIndexSchema
  }

  validateIdParam = (c: Context) => {
    return ValidateIdParamSchema.superRefine(async (data) => {
      const record = await this.sentinelRepo.findById(c, data.id)

      if (!record) {
        throw new ValidationError("Sentinel surveillance not exist")
      }
    })
  }

  create = (c: Context) => {
    return CreateSentinelSurveillanceSchema.superRefine(async (data, ctx) => {
      await this.#validatePatientExists(c, ctx, data.patient_id)
      await this.#validateSpecimenExists(c, ctx, data.specimen_id)
      await this.#validateLabResultExists(c, ctx, data.lab_result_id)

      if (data.duration !== undefined && data.duration <= 0) {
        throw new ValidationError("Duration must be positive")
      }
    })
  }

  update = (c: Context) => {
    return UpdateSentinelSurveillanceSchema.superRefine(async (data, ctx) => {
      await this.#validatePatientExists(c, ctx, data.patient_id)

      if (data.lab_result_id !== null && data.lab_result_id !== undefined) {
        await this.#validateLabResultExists(c, ctx, data.lab_result_id)
      }

      if (data.specimen_id !== null && data.specimen_id !== undefined) {
        await this.#validateSpecimenExists(c, ctx, data.specimen_id)
      }

      if (data.duration !== undefined && data.duration <= 0) {
        throw new ValidationError("Duration must be positive")
      }
    })
  }

  validateSentinelSurveillanceId = (c: Context) => {
    return sentinelSurveillanceId.superRefine(async (data) => {
      const id = parseInt(data.id)

      if (isNaN(id) || id <= 0) {
        throw new ValidationError("Invalid id")
      }

      const record = await this.sentinelRepo.findById(c, id)

      if (!record) {
        throw new ValidationError("Sentinel surveillance not exist")
      }
    })
  }

  readonly #validatePatientExists = async (
    c: Context,
    ctx: z.RefinementCtx,
    patientId: number
  ) => {
    const patient = await this.sentinelRepo.findPatientById(c, patientId)

    if (!patient) {
      throw new ValidationError("Patient not exist")
    }
  }

  readonly #validateSpecimenExists = async (
    c: Context,
    ctx: z.RefinementCtx,
    specimenId: number
  ) => {
    const specimen = await this.sentinelRepo.findSpecimenById(c, specimenId)

    if (!specimen) {
      throw new ValidationError("Specimen not exist")
    }
  }

  readonly #validateLabResultExists = async (
    c: Context,
    ctx: z.RefinementCtx,
    labResultId: number
  ) => {
    const labResult = await this.sentinelRepo.findPcrLabResultById(c, labResultId)
    if (!labResult) {
      throw new ValidationError("Lab result not exist")
    }
  }
}
