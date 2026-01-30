import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { Context } from "hono"
import { z } from "zod"
import { AssetVendorRepository } from "./asset-vendor.repository.js"
import {
  AddAssetVendorRequestSchema,
  EditAssetVendorRequestSchema,
  GetAssetVendorsQueryParamsSchema,
  ImportAssetVendorArrayRequestSchema,
  ImportAssetVendorRowRequest,
  AddAssetVendorRequest,
  EditAssetVendorRequest,
  GetAssetVendorsQueryParams,
  ImportAssetVendorArrayRequest,
} from "./asset-vendor.schema.js"
import { createMiddleware } from "hono/factory"
import { ValidationError, NotFoundError } from "@smile-health/lib/error.js"
import { validator } from "hono/validator"
import { AssetVendorImport } from "./asset-vendor.excel.js"
import { formatExcelErrors } from "@smile-health/lib/zod.js"

export class AssetVendorMiddleware extends BaseMiddleware {
  constructor(private readonly repository: AssetVendorRepository) {
    super()
  }

  readonly #generateImportData = async (c: Context) => {
    const body = await c.req.parseBody()
    const file = body.file as File
    const usedTemplate = new AssetVendorImport()
    await usedTemplate.loadFromBuffer(await file.arrayBuffer())
    const rows = usedTemplate.getRows()
    const startRow = usedTemplate.getStartRow()

    const rowsResult = rows.map((obj) => {
      const newObj = {}

      if (obj[c.var.t("asset_vendor.label.name")]) {
        newObj["name"] = obj[c.var.t("asset_vendor.label.name")]
      }

      if (obj[c.var.t("asset_vendor.label.asset_vendor_type_name")]) {
        newObj["asset_vendor_type_id"] =
          obj[c.var.t("asset_vendor.label.asset_vendor_type_name")]
      }

      if (obj[c.var.t("asset_vendor.label.description")]) {
        newObj["description"] = obj[c.var.t("asset_vendor.label.description")]
      }

      
      return newObj
    })

    const usedSchema = ImportAssetVendorArrayRequestSchema.superRefine(
      async (data, ctx) => {
        if (data.length === 0) {
          this.#rowsCannotEmpty(c, ctx)
        }
        await this.#multipleRequestValidation(c, ctx, data)
      }
    ).transform((rows) => rows.map(this.transformRowSchema))

    const result = await usedSchema.safeParseAsync(rowsResult)

    if (!result.success) {
      const newError: any = { issues: [] }

      for (const err of result.error.issues) {
        if (err.message === "Required") {
          newError.issues.push({
            path: err.path,
            message: c.var.t("validator.required", {
              field: c.var.t(`asset_vendor.label.${err.path[1]}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        } else {
          newError.issues.push({
            path: err.path,
            message: c.var.t(err.message, {
              field: c.var.t(`asset_vendor.label.${err.path[1]}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }

      c.set("errors", formatExcelErrors(newError, startRow, c.var.t))
      throw new ValidationError()
    }

    return result.data
  }

  transformRowSchema = (row: ImportAssetVendorRowRequest) => {
    return {
      name: row["name"],
      asset_vendor_type_id: row["asset_vendor_type_id"],
      description: row["description"],
    }
  }

  readonly #rowsCannotEmpty = (c: Context, ctx: z.RefinementCtx) => {
    ctx.addIssue({
      path: ["rows"],
      message: c.var.t("validator.not_empty", {
        field: c.var.t("common.rows"),
      }),
      code: z.ZodIssueCode.custom,
    })
  }

  readonly #singleRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddAssetVendorRequest | EditAssetVendorRequest
  ) => {
    if (data.name) {
      const id = c.req.param("id")
      const assetVendor = await this.repository.getAssetVendorByName(
        c,
        data.name
      )

      if (
        (id && assetVendor && assetVendor.id !== Number(id)) ||
        (!id && assetVendor)
      ) {
        ctx.addIssue({
          path: ["name"],
          message: c.var.t("validator.exist", {
            field: c.var.t("asset_vendor.label.name"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.asset_vendor_type_id) {
      const assetVendorType = await this.repository.getAssetVendorTypeById(
        c,
        data.asset_vendor_type_id
      )

      if (!assetVendorType) {
        ctx.addIssue({
          path: ["asset_vendor_type_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_vendor.label.asset_vendor_type_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #pathParamValidation = async (c: Context) => {
    const id = c.req.param("id")
    const assetVendor = await this.repository.getOnlyAssetVendorById(
      c,
      Number(id)
    )

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

  readonly #multipleRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: ImportAssetVendorArrayRequest
  ) => {
    const checkDuplicateNameList: string[] = []
    for (const [index, d] of data.entries()) {
      if (d["name"]) {
        //check if name duplicate in sheet
        if (checkDuplicateNameList.includes(d["name"])) {
          ctx.addIssue({
            path: [index, "name"],
            message: c.var.t("validator.duplicated", {
              field: c.var.t("asset_vendor.label.name"),
            }),
            code: z.ZodIssueCode.custom,
          })
        } else {
          checkDuplicateNameList.push(d["name"])
        }

        // check if name exist in DB
        const assetVendor = await this.repository.getAssetVendorByName(
          c,
          d["name"]
        )
        if (assetVendor) {
          ctx.addIssue({
            path: [index, "name"],
            message: c.var.t("validator.exist", {
              field: c.var.t("asset_vendor.label.name"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }

      if (d["asset_vendor_type_id"]) {
        const assetVendorType = await this.repository.getAssetVendorTypeById(
          c,
          d["asset_vendor_type_id"]
        )

        if (!assetVendorType) {
          ctx.addIssue({
            path: [index, "asset_vendor_type_id"],
            message: c.var.t("validator.not_exist", {
              field: c.var.t("asset_vendor.label.asset_vendor_type_id"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }
  }

  create = (c: Context) => {
    return AddAssetVendorRequestSchema.superRefine(async (data, ctx) => {
      await this.#singleRequestValidation(c, ctx, data)
    })
  }

  update = (c: Context) => {
    return EditAssetVendorRequestSchema.superRefine(async (data, ctx) => {
      await this.#pathParamValidation(c)
      await this.#singleRequestValidation(c, ctx, data)
    })
  }

  list = (c: Context) => {
    return GetAssetVendorsQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  export = (c: Context) => {
    return GetAssetVendorsQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  import = validator("json", async (value, c) => {
    const result = await this.#generateImportData(c)
    return result
  })

  detail = createMiddleware(async (c, next) => {
    await this.#pathParamValidation(c)
    await next()
  })
}
