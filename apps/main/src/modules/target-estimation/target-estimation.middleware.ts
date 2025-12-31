import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { TargetEstimationNonBiasRepository } from "../target-estimation-non-bias/target-estimation-non-bias.repository.js"
import { Context } from "hono"
import {
  AddTargetCalculateNonBiasSchema,
  SaveEstimationRequest,
  SaveEstimationBiasSchema,
  SaveEstimationBiasRequest,
  UpdateEstimationRequest,
  UpdateEstimationBiasRequest,
  UpdateEstimationSchema,
  UpdateEstimationBiasSchema,
} from "./target-estimation.schema.js"
import z from "zod"
import {
  validateRequiredFields,
  addValidationIssue,
} from "@/common/utils/validation.utils.js"

export class TargetEstimationMiddleware extends BaseMiddleware {
  readonly #nonBiasFields = [
    "service_percentage_outreach",
    "service_percentage_facility",
    "required_monthly_outreach",
    "required_monthly_facility",
    "available_service_outreach",
    "available_service_facility",
    "required_additional_outreach",
    "required_vaccinator_outreach",
    "required_additional_facility",
    "required_vaccinator_facility",
    "ideal_needs",
    "available_worker",
    "gap_worker",
  ] as const

  readonly #biasFields = [
    "august_service_point",
    "august_service_days",
    "august_vaccinator",
    "november_service_point",
    "november_service_days",
    "november_vaccinator",
  ] as const

  constructor(
    private readonly nonBiasRepository: TargetEstimationNonBiasRepository
  ) {
    super()
  }

  create = (c: Context) => {
    return AddTargetCalculateNonBiasSchema.superRefine(
      async (data: SaveEstimationRequest, ctx: z.RefinementCtx) => {
        await this.#validateVillageId(c, ctx, data)
        await this.#validateNonBiasFields(c, ctx, data)
        await this.#checkDuplicateVillage(c, ctx, data)
      }
    )
  }

  readonly #validateVillageId = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: SaveEstimationRequest
  ) => {
    validateRequiredFields(
      c,
      ctx,
      data,
      ["village_id"] as const,
      "target_estimation_non_bias"
    )
  }

  readonly #checkDuplicateVillage = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: SaveEstimationRequest
  ) => {
    if (data.village_id) {
      const existingRecord = await this.nonBiasRepository.findByVillage(
        c,
        data.village_id
      )

      if (existingRecord) {
        addValidationIssue(
          c,
          ctx,
          "village_id",
          "validator.exist",
          "target_estimation_non_bias.label.village_id"
        )
      }
    }
  }

  createBias = (c: Context) => {
    return SaveEstimationBiasSchema.superRefine(
      async (data: SaveEstimationBiasRequest, ctx: z.RefinementCtx) => {
        await this.#validateSchoolId(c, ctx, data)
        await this.#validateBiasFields(c, ctx, data)
      }
    )
  }

  readonly #validateSchoolId = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: SaveEstimationBiasRequest
  ) => {
    validateRequiredFields(
      c,
      ctx,
      data,
      ["school_id"] as const,
      "target_estimation_bias"
    )
  }

  readonly #validateNonBiasFields = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: UpdateEstimationRequest | SaveEstimationRequest
  ) => {
    validateRequiredFields(
      c,
      ctx,
      data,
      this.#nonBiasFields,
      "target_estimation_non_bias"
    )
  }

  readonly #validateBiasFields = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: UpdateEstimationBiasRequest | SaveEstimationBiasRequest
  ) => {
    validateRequiredFields(
      c,
      ctx,
      data,
      this.#biasFields,
      "target_estimation_bias"
    )
  }

  update = (c: Context) => {
    return UpdateEstimationSchema.superRefine(
      async (data: UpdateEstimationRequest, ctx: z.RefinementCtx) => {
        await this.#validateNonBiasFields(c, ctx, data)
      }
    )
  }

  updateBias = (c: Context) => {
    return UpdateEstimationBiasSchema.superRefine(
      async (data: UpdateEstimationBiasRequest, ctx: z.RefinementCtx) => {
        await this.#validateBiasFields(c, ctx, data)
      }
    )
  }
}
