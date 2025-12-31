import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { Context } from "hono"
import { z } from "zod"
import { AssetTypeRepository } from "./asset-type.repository.js"
import {
  AddAssetTypeRequestSchema,
  EditAssetTypeRequestSchema,
  GetAssetTypesQueryParamsSchema,
  ImportAssetTypeArrayRequestSchema,
  ImportAssetTypeRowRequest,
  AddAssetTypeRequest,
  EditAssetTypeRequest,
  GetAssetTypesQueryParams,
  ImportAssetTypeArrayRequest,
  toArrayInt,
  ImportTemplateQueryParams,
} from "./asset-type.schema.js"
import { createMiddleware } from "hono/factory"
import { ValidationError, NotFoundError } from "@smile/lib/error.js"
import { validator } from "hono/validator"
import { AssetTypeImport } from "./asset-type.excel.js"
import { formatExcelErrors } from "@smile/lib/zod.js"
import { collect } from "@smile/lib/utils.js"
import {
  ASSET_CLASSIFICATION,
  TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE,
} from "@/common/constants/assets.js"
import { TemperatureThresholdRepository } from "../temperature-threshold/temperature-threshold.repository.js"
import { AssetTypesClassificationRepository } from "../asset-types-classification/asset-types-classification.repository.js"
import { AssetModelRepository } from "../asset-model/asset-model.repository.js"
import { AssetTypesTemperatureRepository } from "../asset-types-temperature/asset-types-temperature.repository.js"
import { T } from "@faker-js/faker/dist/airline-CLphikKp.js"

export class AssetTypeMiddleware extends BaseMiddleware {
  constructor(
    private readonly repository: AssetTypeRepository,
    private readonly temperatureThresholdRepo: TemperatureThresholdRepository,
    private readonly assetTypesClassificationRepo: AssetTypesClassificationRepository,
    private readonly assetModelRepo: AssetModelRepository,
    private readonly assetTypesTemperatureRepo: AssetTypesTemperatureRepository
  ) {
    super()
  }

  readonly #generateImportData = async (
    c: Context,
    params: ImportTemplateQueryParams
  ) => {
    const body = await c.req.parseBody()
    const file = body.file as File
    const usedTemplate = new AssetTypeImport()
    await usedTemplate.loadFromBuffer(await file.arrayBuffer())
    const rows = usedTemplate.getRows()
    const startRow = usedTemplate.getStartRow()

    const rowsResult = rows.map((obj) => {
      const newObj = {}

      if (obj[c.var.t("asset_type.label.name")]) {
        newObj["name"] = obj[c.var.t("asset_type.label.name")]
      }

      if (obj[c.var.t("asset_type.label.description")]) {
        newObj["description"] = obj[c.var.t("asset_type.label.description")]
      }

      if (obj[c.var.t("asset_type.label.is_cce")]) {
        newObj["is_cce"] = obj[c.var.t("asset_type.label.is_cce")]
      }

      if (obj[c.var.t("asset_type.label.temperature_thresholds")]) {
        newObj["temperature_thresholds"] =
          obj[c.var.t("asset_type.label.temperature_thresholds")]
      }

      if (obj[c.var.t("asset_type.label.is_adjustable")]) {
        newObj["is_temperature_adjustable"] =
          obj[c.var.t("asset_type.label.is_adjustable")]
      }

      if (obj[c.var.t("asset_type.label.is_cce_warehouse")]) {
        newObj["is_cce_warehouse"] =
          obj[c.var.t("asset_type.label.is_cce_warehouse")]
      }

      return newObj
    })

    const usedSchema = ImportAssetTypeArrayRequestSchema.superRefine(
      async (data, ctx) => {
        if (data.length === 0) {
          this.#rowsCannotEmpty(c, ctx)
        }
        await this.#multipleRequestValidation(c, ctx, data, params)
      }
    ).transform((rows) =>
      rows.map((row) =>
        this.transformRowSchema(row, params as ImportTemplateQueryParams)
      )
    )

    const result = await usedSchema.safeParseAsync(rowsResult)

    if (!result.success) {
      const newError: any = { issues: [] }

      for (const err of result.error.issues) {
        if (err.message === "Required") {
          newError.issues.push({
            path: err.path,
            message: c.var.t("validator.required", {
              field: c.var.t(`asset_type.label.${err.path[1]}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        } else {
          newError.issues.push({
            path: err.path,
            message: c.var.t(err.message, {
              field: c.var.t(`asset_type.label.${err.path[1]}`),
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

  transformRowSchema = (
    row: ImportAssetTypeRowRequest,
    params: ImportTemplateQueryParams
  ) => {
    return {
      name: row["name"],
      description: row["description"],
      temperature_thresholds: row["temperature_thresholds"],
      is_cce: row["is_cce"],
      is_temperature_adjustable: row["is_temperature_adjustable"],
      is_cce_warehouse: row["is_cce_warehouse"],
      is_warehouse:
        params.type_download_template ===
        TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_WAREHOUSE
          ? 1
          : 0,
    }
  }

  readonly #rowsCannotEmpty = (c: Context, ctx) => {
    ctx.addIssue({
      path: ["rows"],
      message: c.var.t("validator.not_empty", {
        field: c.var.t("common.rows"),
      }),
      code: z.ZodIssueCode.custom,
    })
  }

  readonly #validateAssetTypeModification = async (
    c: Context,
    data: EditAssetTypeRequest
  ) => {
    const id = c.req.param("id")

    const assetModelUsingThisType = await this.assetModelRepo.findOne(c, {
      asset_type_id: id,
    })

    // If not used, allow any modification
    if (!assetModelUsingThisType) return

    const existingThresholds = await this.assetTypesTemperatureRepo.find(c, {
      asset_type_id: id,
    })

    const newThresholds = data.temperature_thresholds || []

    // Validation: if attempting to change the number of thresholds
    if (newThresholds.length !== existingThresholds.length) {
      throw new ValidationError(
        c.var.t("validator.asset_type.already_on_asset_model")
      )
    }

    // Validation: if attempting to change which temperature thresholds are used
    const existingThresholdIds = new Set(
      existingThresholds.map((t) => t.temperature_threshold_id)
    )

    const hasChangedThresholds = newThresholds.some(
      (newT) => !existingThresholdIds.has(newT.id)
    )

    if (hasChangedThresholds) {
      throw new ValidationError(
        c.var.t("validator.asset_type.already_on_asset_model")
      )
    }
  }

  readonly #singleRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddAssetTypeRequest | EditAssetTypeRequest,
    isUpdate: boolean = false
  ) => {
    let temperatureThresholdIds: number[] | null = null

    if (data.temperature_thresholds !== undefined) {
      this.#isDuplicateTemperatureThreshold(c, ctx, data.temperature_thresholds)
    }

    if (
      Array.isArray(data.temperature_thresholds) &&
      data.temperature_thresholds.length > 0
    ) {
      temperatureThresholdIds = collect(data.temperature_thresholds, "id")
      this.#isTemperatureThresholdValid(
        c,
        ctx,
        temperatureThresholdIds,
        data.temperature_thresholds,
        data.is_cce_warehouse === 1 ? 1 : 0
      )
    }

    if (isUpdate === true) {
      await this.#isNotChangeClassification(
        c,
        ctx,
        data.is_cce ?? 0,
        data.is_temperature_adjustable ?? 0,
        data.temperature_thresholds || [],
        data.is_cce_warehouse ?? 0,
        data.is_warehouse ?? 0
      )
      await this.#validateAssetTypeModification(c, data)
    }

    if (data.is_cce === 1 && data.is_cce_warehouse === 1) {
      ctx.addIssue({
        path: ["is_warehouse"],
        message: c.var.t("validator.asset_type.between-wirehouse-or-not"),
        code: z.ZodIssueCode.custom,
      })
      ctx.addIssue({
        path: ["is_cce"],
        message: c.var.t("validator.asset_type.between-wirehouse-or-not"),
        code: z.ZodIssueCode.custom,
      })
    }

    // validation for asset type not wirehouse
    if (data.is_warehouse === 0) {
      if (
        data.is_cce === 1 &&
        (!Array.isArray(data.temperature_thresholds) ||
          data.temperature_thresholds.length === 0)
      ) {
        ctx.addIssue({
          path: ["temperature_thresholds"],
          message: c.var.t("validator.required", {
            field: "temperature_thresholds",
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        data.is_cce === 0 &&
        Array.isArray(data.temperature_thresholds) &&
        data.temperature_thresholds.length > 0
      ) {
        ctx.addIssue({
          path: ["is_cce"],
          message: c.var.t("validator.must_be_equal", {
            field: "is_cce",
            value: "1",
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        data.is_temperature_adjustable === 1 &&
        Array.isArray(data.temperature_thresholds) &&
        data.temperature_thresholds.length === 1
      ) {
        ctx.addIssue({
          path: ["is_temperature_adjustable"],
          message: c.var.t("validator.range_of_must_be_greater_than", {
            field: c.var.t("asset_type.label.temperature_thresholds"),
            value: 1,
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        data.is_cce === 1 &&
        data.is_temperature_adjustable === 0 &&
        Array.isArray(data.temperature_thresholds) &&
        data.temperature_thresholds.length > 1
      ) {
        ctx.addIssue({
          path: ["is_cce"],
          message: c.var.t("validator.range_of_must_be_equal", {
            field: c.var.t("asset_type.label.temperature_thresholds"),
            value: 1,
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        data.is_temperature_adjustable === 1 &&
        isUpdate === false &&
        data.is_cce !== 1
      ) {
        ctx.addIssue({
          path: ["is_temperature_adjustable"],
          message: c.var.t("validator.must_be_equal", {
            field: "is_temperature_adjustable",
            value: "0",
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }
    // validation for asset type wirehouse
    else if (data.is_warehouse === 1) {
      if (
        data.is_cce_warehouse === 1 &&
        (!Array.isArray(data.temperature_thresholds) ||
          data.temperature_thresholds.length === 0)
      ) {
        ctx.addIssue({
          path: ["temperature_thresholds"],
          message: c.var.t("validator.required", {
            field: "temperature_thresholds",
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        data.is_cce_warehouse === 0 &&
        Array.isArray(data.temperature_thresholds) &&
        data.temperature_thresholds.length > 0
      ) {
        ctx.addIssue({
          path: ["is_cce_warehouse"],
          message: c.var.t("validator.must_be_equal", {
            field: "is_cce_warehouse",
            value: "1",
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        data.is_temperature_adjustable === 1 &&
        Array.isArray(data.temperature_thresholds) &&
        data.temperature_thresholds.length === 1
      ) {
        ctx.addIssue({
          path: ["is_temperature_adjustable"],
          message: c.var.t("validator.range_of_must_be_greater_than", {
            field: c.var.t("asset_type.label.temperature_thresholds"),
            value: 1,
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        data.is_cce_warehouse === 1 &&
        data.is_temperature_adjustable === 0 &&
        Array.isArray(data.temperature_thresholds) &&
        data.temperature_thresholds.length > 1
      ) {
        ctx.addIssue({
          path: ["is_cce_warehouse"],
          message: c.var.t("validator.range_of_must_be_equal", {
            field: c.var.t("asset_type.label.temperature_thresholds"),
            value: 1,
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        data.is_temperature_adjustable === 1 &&
        isUpdate === false &&
        data.is_cce_warehouse !== 1
      ) {
        ctx.addIssue({
          path: ["is_temperature_adjustable"],
          message: c.var.t("validator.must_be_equal", {
            field: "is_temperature_adjustable",
            value: "0",
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.name) {
      const id = c.req.param("id")
      const assetType = await this.repository.getAssetTypeByName(c, data.name)

      if (
        (id && assetType && assetType.id !== Number(id)) ||
        (!id && assetType)
      ) {
        ctx.addIssue({
          path: ["name"],
          message: c.var.t("validator.exist", {
            field: c.var.t("asset_type.label.name"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #pathParamValidation = async (c: Context) => {
    const id = c.req.param("id")
    const assetType = await this.repository.getOnlyAssetTypeById(c, Number(id))

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

  readonly #isTemperatureThresholdValid = async (
    c: Context,
    ctx: z.RefinementCtx,
    ids: number[],
    data: { id: number }[],
    is_wherehouse: number = 0
  ) => {
    const getListTemperatureThresholds =
      await this.temperatureThresholdRepo.find(c, {
        id: ids,
        is_predefined: is_wherehouse === 1 ? 2 : 1,
      })

    for (const [index, item] of data.entries()) {
      const threshold = getListTemperatureThresholds.find(
        (t) => t.id === item.id
      )
      if (!threshold) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.not_exist", {
            field: "id",
          }),
          path: ["temperature_thresholds", `${index}`, "id"],
        })
      }
    }
  }

  readonly #isDuplicateTemperatureThreshold = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: { id: number }[]
  ) => {
    const seenIds = new Set<number>()
    for (const [index, item] of data.entries()) {
      if (seenIds.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.duplicated", {
            field: "id",
          }),
          path: ["temperature_thresholds", index, "id"],
        })
      }
      seenIds.add(item.id)
    }
  }

  #isNotChangeClassification = async (
    c: Context,
    ctx: z.RefinementCtx,
    is_cce: number,
    is_temperature_adjustable: number,
    temperature_thresholds: { id: number }[],
    is_cce_warehouse: number,
    is_warehouse: number
  ) => {
    const id = c.req.param("id")
    const assetTypeClassification =
      await this.assetTypesClassificationRepo.find(c, {
        asset_type_id: Number(id),
      })
    const assetTypeIsCCE = assetTypeClassification?.find(
      (ac) => ac.asset_classifications_id === ASSET_CLASSIFICATION.CCE
    )
    const assetTypeIsSelection = assetTypeClassification?.find(
      (ac) => ac.asset_classifications_id === ASSET_CLASSIFICATION.SELECTION
    )

    const isWarehouse = assetTypeClassification?.find(
      (ac) => ac.asset_classifications_id === ASSET_CLASSIFICATION.WAREHOUSE
    )

    const isCCEWarehouse = assetTypeClassification?.find(
      (ac) => ac.asset_classifications_id === ASSET_CLASSIFICATION.CCE_WAREHOUSE
    )

    if (isWarehouse && (is_cce === 1 || is_warehouse === 0)) {
      throw new ValidationError(
        c.var.t("validator.asset_type.is_not_change_cce_warehouse")
      )
    }

    if (assetTypeIsCCE && is_warehouse === 1) {
      throw new ValidationError(
        c.var.t("validator.asset_type.is_not_change_cce_warehouse")
      )
    }

    // For Asset Not Warehouse
    if (!isWarehouse) {
      if (
        assetTypeIsCCE &&
        assetTypeIsCCE.asset_classifications_id === ASSET_CLASSIFICATION.CCE &&
        is_cce === 0
      ) {
        throw new ValidationError(
          c.var.t("validator.asset_type.is_not_change_cce")
        )
      }

      if (!assetTypeIsCCE && is_cce === 1) {
        throw new ValidationError(
          c.var.t("validator.asset_type.is_not_change_cce")
        )
      }

      if (
        assetTypeIsSelection &&
        assetTypeIsSelection.asset_classifications_id ===
          ASSET_CLASSIFICATION.SELECTION &&
        is_temperature_adjustable === 0
      ) {
        throw new ValidationError(
          c.var.t("validator.asset_type.is_not_change_cce")
        )
      }

      if (is_cce === 1 && is_temperature_adjustable === 0) {
        const assetTypeTemp = await this.assetTypesTemperatureRepo.findOne(c, {
          asset_type_id: Number(id),
        })

        if (
          temperature_thresholds[0]?.id !==
          assetTypeTemp?.temperature_threshold_id
        ) {
          throw new ValidationError(
            c.var.t("validator.cannot_change_temperature")
          )
        }
      }
    }
    // For Asset Warehouse
    else {
      if (
        isCCEWarehouse &&
        isCCEWarehouse.asset_classifications_id ===
          ASSET_CLASSIFICATION.CCE_WAREHOUSE &&
        is_cce_warehouse === 0
      ) {
        throw new ValidationError(
          c.var.t("validator.asset_type.warehouse.is_not_change_cce_warehouse")
        )
      }

      if (!isCCEWarehouse && is_cce_warehouse === 1) {
        throw new ValidationError(
          c.var.t("validator.asset_type.warehouse.is_not_change_cce_warehouse")
        )
      }

      if (
        assetTypeIsSelection &&
        assetTypeIsSelection.asset_classifications_id ===
          ASSET_CLASSIFICATION.SELECTION &&
        is_temperature_adjustable === 0
      ) {
        throw new ValidationError(
          c.var.t("validator.asset_type.is_not_change_cce_warehouse")
        )
      }

      const assetTypeTemp = await this.assetTypesTemperatureRepo.findOne(c, {
        asset_type_id: Number(id),
      })

      if (isCCEWarehouse && is_temperature_adjustable === 0) {
        if (
          temperature_thresholds[0]?.id !==
          assetTypeTemp?.temperature_threshold_id
        ) {
          throw new ValidationError(
            c.var.t("validator.cannot_change_temperature")
          )
        }
      }
    }
  }

  readonly #multipleRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: ImportAssetTypeArrayRequest,
    params: ImportTemplateQueryParams
  ) => {
    const seenNames = new Set<string>()
    for (const [index, d] of data.entries()) {
      if (d["name"]) {
        //check if name duplicate in sheet
        const normalizedName = d["name"]?.trim().toUpperCase()

        if (seenNames.has(normalizedName)) {
          ctx.addIssue({
            path: [index, "name"],
            message: c.var.t("validator.duplicated", {
              field: c.var.t("asset_type.label.name"),
            }),
            code: z.ZodIssueCode.custom,
          })
        } else {
          seenNames.add(normalizedName)
        }

        // check if name exist in DB
        const assetType = await this.repository.getAssetTypeByName(c, d["name"])
        if (assetType) {
          ctx.addIssue({
            path: [index, "name"],
            message: c.var.t("validator.exist", {
              field: c.var.t("asset_type.label.name"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }

      if (
        Number(params.type_download_template) ===
        TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_CCE
      ) {
        if (d["is_cce"] === 1 && !d["temperature_thresholds"]) {
          ctx.addIssue({
            path: [index, "temperature_thresholds"],
            message: c.var.t("validator.required", {
              field: c.var.t("asset_type.label.temperature_thresholds"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        if (
          (d["is_cce"] === null || d["is_cce"] === 0) &&
          d["temperature_thresholds"]
        ) {
          ctx.addIssue({
            path: [index, "temperature_thresholds"],
            message: c.var.t("validator.not_required", {
              field: c.var.t("asset_type.label.temperature_thresholds"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        if (d["temperature_thresholds"]) {
          let isSearch = true
          const temperatureThresholds = toArrayInt(d["temperature_thresholds"])

          // check if temperature_thresholds duplicate
          const uniqueThresholds = [...new Set(temperatureThresholds)]
          if (temperatureThresholds.length !== uniqueThresholds.length) {
            isSearch = false
            ctx.addIssue({
              path: [index, "temperature_thresholds"],
              message: c.var.t("validator.duplicated", {
                field: c.var.t("asset_type.label.temperature_thresholds"),
              }),
              code: z.ZodIssueCode.custom,
            })
          }

          if (isSearch === true) {
            const temperatureThresholdsList =
              await this.temperatureThresholdRepo.find(c, {
                id: temperatureThresholds,
                is_predefined: 1,
              })

            if (
              temperatureThresholdsList.length !== temperatureThresholds.length
            ) {
              ctx.addIssue({
                path: [index, "temperature_thresholds"],
                message: c.var.t("validator.has_value_not_exist", {
                  field: c.var.t("asset_type.label.temperature_thresholds"),
                }),
                code: z.ZodIssueCode.custom,
              })
            }
          }
          if (
            d["is_cce"] === 1 &&
            d["is_temperature_adjustable"] === 0 &&
            d["temperature_thresholds"] &&
            toArrayInt(d["temperature_thresholds"]).length > 1
          ) {
            ctx.addIssue({
              path: [index, "temperature_thresholds"],
              message: c.var.t("validator.range_of_must_be_equal", {
                row: c.var.t("asset_type.label.temperature_thresholds"),
                value: "1",
              }),
              code: z.ZodIssueCode.custom,
            })
          }

          if (
            d["is_temperature_adjustable"] === 1 &&
            d["temperature_thresholds"] &&
            toArrayInt(d["temperature_thresholds"]).length === 1
          ) {
            ctx.addIssue({
              path: [index, "temperature_thresholds"],
              message: c.var.t("validator.range_of_must_be_greater_than", {
                row: c.var.t("asset_type.label.temperature_thresholds"),
                value: "1",
              }),
              code: z.ZodIssueCode.custom,
            })
          }

          if (
            (d["is_cce"] === 0 || d["is_cce"] === null) &&
            d["is_temperature_adjustable"] === 1
          ) {
            ctx.addIssue({
              path: [index, "is_cce"],
              message: c.var.t("validator.must_be_equal", {
                row: c.var.t("asset_type.label.is_cce"),
                value: "1",
              }),
              code: z.ZodIssueCode.custom,
            })
          }
        }
      } else {
        // validation for asset type  wirehouse
        if (d["is_cce_warehouse"] === 1 && !d["temperature_thresholds"]) {
          ctx.addIssue({
            path: [index, "temperature_thresholds"],
            message: c.var.t("validator.required", {
              field: c.var.t("asset_type.label.temperature_thresholds"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        if (
          (d["is_cce_warehouse"] === null || d["is_cce_warehouse"] === 0) &&
          d["temperature_thresholds"]
        ) {
          ctx.addIssue({
            path: [index, "temperature_thresholds"],
            message: c.var.t("validator.not_required", {
              field: c.var.t("asset_type.label.temperature_thresholds"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        if (d["temperature_thresholds"]) {
          let isSearch = true
          const temperatureThresholds = toArrayInt(d["temperature_thresholds"])

          // check if temperature_thresholds duplicate
          const uniqueThresholds = [...new Set(temperatureThresholds)]
          if (temperatureThresholds.length !== uniqueThresholds.length) {
            isSearch = false
            ctx.addIssue({
              path: [index, "temperature_thresholds"],
              message: c.var.t("validator.duplicated", {
                field: c.var.t("asset_type.label.temperature_thresholds"),
              }),
              code: z.ZodIssueCode.custom,
            })
          }

          if (isSearch === true) {
            const temperatureThresholdsList =
              await this.temperatureThresholdRepo.find(c, {
                id: temperatureThresholds,
                is_predefined:
                  Number(params.type_download_template) ===
                  TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_WAREHOUSE
                    ? TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_WAREHOUSE
                    : TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_CCE,
              })

            if (
              temperatureThresholdsList.length !== temperatureThresholds.length
            ) {
              ctx.addIssue({
                path: [index, "temperature_thresholds"],
                message: c.var.t("validator.has_value_not_exist", {
                  field: c.var.t("asset_type.label.temperature_thresholds"),
                }),
                code: z.ZodIssueCode.custom,
              })
            }
          }
          if (
            d["is_cce_warehouse"] === 1 &&
            d["is_temperature_adjustable"] === 0 &&
            d["temperature_thresholds"] &&
            toArrayInt(d["temperature_thresholds"]).length > 1
          ) {
            ctx.addIssue({
              path: [index, "temperature_thresholds"],
              message: c.var.t("validator.range_of_must_be_equal", {
                row: c.var.t("asset_type.label.temperature_thresholds"),
                value: "1",
              }),
              code: z.ZodIssueCode.custom,
            })
          }

          if (
            d["is_temperature_adjustable"] === 1 &&
            d["temperature_thresholds"] &&
            toArrayInt(d["temperature_thresholds"]).length === 1
          ) {
            ctx.addIssue({
              path: [index, "temperature_thresholds"],
              message: c.var.t("validator.range_of_must_be_greater_than", {
                row: c.var.t("asset_type.label.temperature_thresholds"),
                value: "1",
              }),
              code: z.ZodIssueCode.custom,
            })
          }

          if (
            (d["is_cce_warehouse"] === 0 || d["is_cce_warehouse"] === null) &&
            d["is_temperature_adjustable"] === 1
          ) {
            ctx.addIssue({
              path: [index, "is_cce_warehouse"],
              message: c.var.t("validator.must_be_equal", {
                row: c.var.t("asset_type.label.is_cce_warehouse"),
                value: "1",
              }),
              code: z.ZodIssueCode.custom,
            })
          }
        }
      }
    }
  }

  create = (c: Context) => {
    return AddAssetTypeRequestSchema.superRefine(async (data, ctx) => {
      await this.#singleRequestValidation(c, ctx, data)
    })
  }

  update = (c: Context) => {
    return EditAssetTypeRequestSchema.superRefine(async (data, ctx) => {
      await this.#pathParamValidation(c)
      await this.#singleRequestValidation(c, ctx, data, true)
    })
  }

  list = (c: Context) => {
    return GetAssetTypesQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  export = (c: Context) => {
    return GetAssetTypesQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  import = validator("json", async (value, c) => {
    const params = c.req.query() as unknown as ImportTemplateQueryParams

    const result = await this.#generateImportData(c, params)
    return result
  })

  detail = createMiddleware(async (c, next) => {
    await this.#pathParamValidation(c)
    await next()
  })
}
