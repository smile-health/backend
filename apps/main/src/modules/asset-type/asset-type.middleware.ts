import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { Context } from "hono"
import { z } from "zod"
import { AssetTypeRepository } from "./asset-type.repository.js"
import {
  GetAssetTypesQueryParamsSchema,
  EditStatusAssetTypeRequestSchema,
  EditStatusAssetTypeRequest,
  GetAssetTypesQueryParams,
} from "./asset-type.schema.js"
import { createMiddleware } from "hono/factory"
import { NotFoundError } from "@smile/lib/error.js"

export class AssetTypeMiddleware extends BaseMiddleware {
  constructor(private readonly repository: AssetTypeRepository) {
    super()
  }

  readonly #getAssetType = async (c: Context) => {
    const id = c.req.param("id")
    const assetType = await this.repository.getOnlyAssetTypeById(
      c,
      Number(id),
      c.get("programId")
    )

    return assetType
  }

  readonly #requestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: EditStatusAssetTypeRequest,
    assetType
  ) => {
    if (data.status === 0 || data.status === 1) {
      // check if update must be with the same program
      if (assetType.program_id !== c.get("programId")) {
        throw new NotFoundError(
          c.var.t("validator.not_match", {
            field: c.var.t("asset_type.label.program_id"),
          })
        )
      }
      // check if asset vendor already used in asset inventory
      const type = await this.repository.getAssetInventoriesByAssetTypeId(
        c,
        assetType.id,
        c.get("programId")
      )

      if (type && data.status === 0) {
        ctx.addIssue({
          path: ["status"],
          message: c.var.t("validator.cannot_deactivate", {
            field1: c.var.t("asset_type.label.id"),
            field2: c.var.t("asset_inventory.label.id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #pathParamValidation = async (c: Context, assetType) => {
    if (!assetType) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("asset_type.label.id"),
        })
      )
    }
  }

  readonly #queryParamValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetAssetTypesQueryParams
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
    return GetAssetTypesQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  update = (c: Context) => {
    return EditStatusAssetTypeRequestSchema.superRefine(async (data, ctx) => {
      const assetType = await this.#getAssetType(c)
      await this.#pathParamValidation(c, assetType)
      await this.#requestValidation(c, ctx, data, assetType)
    })
  }

  export = (c: Context) => {
    return GetAssetTypesQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  detail = createMiddleware(async (c, next) => {
    const assetType = await this.#getAssetType(c)
    await this.#pathParamValidation(c, assetType)
    await next()
  })
}
