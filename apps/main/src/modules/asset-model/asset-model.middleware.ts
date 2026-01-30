import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { Context } from "hono"
import { z } from "zod"
import { AssetModelRepository } from "./asset-model.repository.js"
import {
  GetAssetModelsQueryParamsSchema,
  EditStatusAssetModelRequestSchema,
  EditStatusAssetModelRequest,
  GetAssetModelsQueryParams,
} from "./asset-model.schema.js"
import { createMiddleware } from "hono/factory"
import { NotFoundError } from "@smile-health/lib/error.js"

export class AssetModelMiddleware extends BaseMiddleware {
  constructor(private readonly repository: AssetModelRepository) {
    super()
  }

  readonly #getAssetModel = async (c: Context) => {
    const id = c.req.param("id")
    const assetModel = await this.repository.getOnlyAssetModelById(
      c,
      Number(id),
      c.get("programId")
    )

    return assetModel
  }

  readonly #requestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: EditStatusAssetModelRequest,
    assetModel
  ) => {
    if (data.status === 0 || data.status === 1) {
      // check if update must be with the same program
      if (assetModel.program_id !== c.get("programId")) {
        throw new NotFoundError(
          c.var.t("validator.not_match", {
            field: c.var.t("asset_model.label.program_id"),
          })
        )
      }
      // check if asset vendor already used in asset inventory
      const model = await this.repository.getAssetInventoriesByAssetModelId(
        c,
        assetModel.id,
        c.get("programId")
      )

      if (model && data.status === 0) {
        ctx.addIssue({
          path: ["status"],
          message: c.var.t("validator.cannot_deactivate", {
            field1: c.var.t("asset_model.label.id"),
            field2: c.var.t("asset_inventory.label.id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #pathParamValidation = async (c: Context, assetModel) => {
    if (!assetModel) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("asset_model.label.id"),
        })
      )
    }
  }

  readonly #queryParamValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetAssetModelsQueryParams
  ) => {
    if (data.sort_by && !data.sort_type) {
      ctx.addIssue({
        path: ["sort_type"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("common.sort_type"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.sort_by && data.sort_type) {
      ctx.addIssue({
        path: ["sort_by"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("common.sort_by"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }
  }

  list = (c: Context) => {
    return GetAssetModelsQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  update = (c: Context) => {
    return EditStatusAssetModelRequestSchema.superRefine(async (data, ctx) => {
      const assetModel = await this.#getAssetModel(c)
      await this.#pathParamValidation(c, assetModel)
      await this.#requestValidation(c, ctx, data, assetModel)
    })
  }

  export = (c: Context) => {
    return GetAssetModelsQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  detail = createMiddleware(async (c, next) => {
    const assetModel = await this.#getAssetModel(c)
    await this.#pathParamValidation(c, assetModel)
    await next()
  })
}
