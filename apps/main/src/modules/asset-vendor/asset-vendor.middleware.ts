import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { Context } from "hono"
import { z } from "zod"
import { AssetVendorRepository } from "./asset-vendor.repository.js"
import {
  GetAssetVendorsQueryParamsSchema,
  EditStatusAssetVendorRequestSchema,
  EditStatusAssetVendorRequest,
  GetAssetVendorsQueryParams,
} from "./asset-vendor.schema.js"
import { createMiddleware } from "hono/factory"
import { NotFoundError } from "@smile-health/lib/error.js"

export class AssetVendorMiddleware extends BaseMiddleware {
  constructor(private readonly repository: AssetVendorRepository) {
    super()
  }

  readonly #getAssetVendor = async (c: Context) => {
    const id = c.req.param("id")
    const assetVendor = await this.repository.getOnlyAssetVendorById(
      c,
      Number(id),
      c.get("programId")
    )

    return assetVendor
  }

  readonly #requestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: EditStatusAssetVendorRequest,
    assetVendor
  ) => {
    if (data.status === 0 || data.status === 1) {
      // check if update must be with the same program
      if (assetVendor.program_id !== c.get("programId")) {
        throw new NotFoundError(
          c.var.t("validator.not_match", {
            field: c.var.t("asset_vendor.label.program_id"),
          })
        )
      }
      // check if asset vendor already used in asset inventory
      const [warranty, calibration, maintenance] = await Promise.all([
        this.repository.getAssetInventoriesByWarrantyVendorId(
          c,
          assetVendor.id,
          c.get("programId")
        ),
        this.repository.getAssetInventoriesByCalibrationVendorId(
          c,
          assetVendor.id,
          c.get("programId")
        ),
        this.repository.getAssetInventoriesByMaintenanceVendorId(
          c,
          assetVendor.id,
          c.get("programId")
        ),
      ])

      if ((warranty || calibration || maintenance) && data.status === 0) {
        ctx.addIssue({
          path: ["status"],
          message: c.var.t("validator.cannot_deactivate", {
            field1: c.var.t("asset_vendor.label.id"),
            field2: c.var.t("asset_inventory.label.id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #pathParamValidation = async (c: Context, assetVendor) => {
    if (!assetVendor) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("asset_vendor.label.id"),
        })
      )
    }
  }

  readonly #queryParamValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetAssetVendorsQueryParams
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
    return GetAssetVendorsQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  update = (c: Context) => {
    return EditStatusAssetVendorRequestSchema.superRefine(async (data, ctx) => {
      const assetVendor = await this.#getAssetVendor(c)
      await this.#pathParamValidation(c, assetVendor)
      await this.#requestValidation(c, ctx, data, assetVendor)
    })
  }

  export = (c: Context) => {
    return GetAssetVendorsQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  detail = createMiddleware(async (c, next) => {
    const assetVendor = await this.#getAssetVendor(c)
    await this.#pathParamValidation(c, assetVendor)
    await next()
  })
}
