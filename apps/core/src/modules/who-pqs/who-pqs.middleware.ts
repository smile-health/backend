import { Context } from "hono"
import { CceigatRepository } from "../cceigat/cceigat.repository"
import { TypePQsepository } from "../type-pqs/type-pqs.repository"
import { WhoPqsRepository } from "./who-pqs.repository"
import {
  CreateWhoPqsRequest,
  CreateWhoPqsSchema,
  PqsCodeSchema,
  PqsTypeSchema,
  UpdateWhoPqsRequest,
  UpdateWhoPqsSchema,
} from "./who-pqs.schema"
import z, { ZodSchema } from "zod"
import { NotFoundError, ValidationError } from "@smile-health/lib/error"
import { AssetModelRepository } from "../asset-model/asset-model.repository"

export class WhoPqsMiddleware {
  constructor(
    private readonly repo: WhoPqsRepository,
    private readonly typePqsRepo: TypePQsepository,
    private readonly cceigatRepo: CceigatRepository,
    private readonly assetModelRepo: AssetModelRepository
  ) {}

  createSchema = async (c: Context) => {
    return this.attachCommonRefinements(c, CreateWhoPqsSchema)
  }

  updateSchema = async (c: Context) => {
    return this.updateCommonRefinements(c, UpdateWhoPqsSchema)
  }

  updateCommonRefinements = (c: Context, schema: ZodSchema) => {
    return schema.superRefine(
      async (data: UpdateWhoPqsRequest, ctx: z.RefinementCtx) => {
        const id = c.req.param("id")
        const [pqsCodeByCode, typePqs, cceigat, pqsCodeById, assetModel] =
          await Promise.all([
            this.repo.findOne(c, { code: data.code }),
            this.typePqsRepo.findOne(c, { id: data.pqs_type_id }),
            this.cceigatRepo.findOne(c, { id: data.cceigat_description_id }),
            this.repo.findOne(c, { id: Number(id) }),
            this.assetModelRepo.findOne(c, { pqs_code_id: Number(id) }),
          ])

        if (!pqsCodeById) {
          throw new NotFoundError(c.var.t("validator.not_exist", { field: id }))
        }

        await this.#validatePqsCodeModification(c, data, assetModel, Number(id))

        const isHasNotCapacity =
          (data.net_capacity5 == null || data.net_capacity5 === undefined) &&
          (data.net_capacityMin20 == null ||
            data.net_capacityMin20 === undefined) &&
          (data.net_capacityMin86 == null ||
            data.net_capacityMin86 === undefined)

        this.#isHasNotCapacity(ctx, isHasNotCapacity)
        this.#isPqsCodeAlreadyExist(c, ctx, pqsCodeByCode, true)
        this.#isTypePqsNotExist(ctx, typePqs)
        if (data.cceigat_description_id !== null)
          this.#isCceigatNotExist(ctx, cceigat)
      }
    )
  }

  attachCommonRefinements = (c: Context, schema: ZodSchema) => {
    return schema.superRefine(
      async (data: CreateWhoPqsRequest, ctx: z.RefinementCtx) => {
        const [pqsCode, typePqs, cceigat] = await Promise.all([
          this.repo.findOne(c, { code: data.code }),
          this.typePqsRepo.findOne(c, { id: data.pqs_type_id }),
          this.cceigatRepo.findOne(c, { id: data.cceigat_description_id }),
        ])

        const isHasNotCapacity =
          (data.net_capacity5 == null || data.net_capacity5 === undefined) &&
          (data.net_capacityMin20 == null ||
            data.net_capacityMin20 === undefined) &&
          (data.net_capacityMin86 == null ||
            data.net_capacityMin86 === undefined)

        this.#isHasNotCapacity(ctx, isHasNotCapacity)
        this.#isPqsCodeAlreadyExist(c, ctx, pqsCode)
        this.#isTypePqsNotExist(ctx, typePqs)
        if (data.cceigat_description_id !== null) {
          this.#isCceigatNotExist(ctx, cceigat)
        }
      }
    )
  }

  readonly #isPqsCodeAlreadyExist = (
    c: Context,
    ctx: z.RefinementCtx,
    pqsCode: PqsCodeSchema | undefined,
    isUpdate: boolean = false
  ) => {
    if (pqsCode && isUpdate === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.exist",
        path: ["code"],
      })
    }

    if (pqsCode && isUpdate === true) {
      const id = c.req.param("id")
      if (pqsCode.id !== Number(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.exist",
          path: ["code"],
        })
      }
    }
  }

  readonly #isTypePqsNotExist = (
    ctx: z.RefinementCtx,
    typePqs: PqsTypeSchema | undefined
  ) => {
    if (!typePqs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["pqs_type_id"],
      })
    }
  }

  readonly #isCceigatNotExist = (
    ctx: z.RefinementCtx,
    cceigat: PqsTypeSchema | undefined
  ) => {
    if (!cceigat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["cceigat_description_id"],
      })
    }
  }

  readonly #isHasNotCapacity = (
    ctx: z.RefinementCtx,
    isHasNotCapacity: boolean
  ) => {
    if (isHasNotCapacity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one net capacity must be provided.",
        path: ["net_capacity5"],
      })
    }
  }

  readonly #validatePqsCodeModification = async (
    c: Context,
    data: UpdateWhoPqsRequest,
    assetModel,
    id: number
  ) => {
    // If not used, allow any modification
    if (!assetModel) return

    const [thresholds, capacities] = await Promise.all([
      this.repo.getTemperatureThresholds(c, 1, [-86, -25, 2], [-40, -15, 8]),
      this.repo.getNetCapacityById(c, id),
    ])

    const capacityMap = new Map(
      capacities.map((cap) => [cap.temperature_threshold_id, cap.net_capacity])
    )

    thresholds.forEach((threshold) => {
      if (threshold.is_predefined !== 1) return

      const existingCapacity = capacityMap.get(threshold.id)
      let newCapacity: number | null | undefined

      // Match temperature ranges to payload fields
      if (threshold.min_temperature === 2 && threshold.max_temperature === 8) {
        newCapacity = data.net_capacity5
      } else if (
        threshold.min_temperature === -25 &&
        threshold.max_temperature === -15
      ) {
        newCapacity = data.net_capacityMin20
      } else if (
        threshold.min_temperature === -86 &&
        threshold.max_temperature === -40
      ) {
        newCapacity = data.net_capacityMin86
      } else {
        return
      }

      const Existing = existingCapacity ?? null
      const New = newCapacity ?? null

      if (New !== Existing) {
        throw new ValidationError(
          c.var.t("validator.pqs_code.pqs_has_been_used")
        )
      }
    })
  }
}
