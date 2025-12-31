import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { Context } from "hono"
import { z } from "zod"
import { AssetModelRepository } from "./asset-model.repository.js"
import {
  AddAssetModelRequestSchema,
  EditAssetModelRequestSchema,
  GetAssetModelsQueryParamsSchema,
  ImportAssetModelArrayRequestSchema,
  ImportAssetModelRowRequest,
  AddAssetModelRequest,
  EditAssetModelRequest,
  GetAssetModelsQueryParams,
  ImportAssetModelArrayRequest,
} from "./asset-model.schema.js"
import { createMiddleware } from "hono/factory"
import { ValidationError, NotFoundError } from "@smile/lib/error.js"
import { validator } from "hono/validator"
import { AssetModelImport } from "./asset-model.excel.js"
import { formatExcelErrors } from "@smile/lib/zod.js"
import {
  ASSET_CLASSIFICATION,
  TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL,
} from "@/common/constants/assets.js"
import { WhoPqsRepository } from "../who-pqs/who-pqs.repository.js"
import { TemperatureThresholdRepository } from "../temperature-threshold/temperature-threshold.repository.js"
import { AssetTypesTemperatureRepository } from "../asset-types-temperature/asset-types-temperature.repository.js"
import { AssetInventoryRepository } from "../asset-inventory/asset-inventory.repository.js"
import { AssetMonitoringDeviceRepository } from "../asset-monitoring-device/asset-monitoring-device.repository.js"

export class AssetModelMiddleware extends BaseMiddleware {
  constructor(
    private readonly repository: AssetModelRepository,
    private readonly whoPqsRepo: WhoPqsRepository,
    private readonly temperatureThresholdRepo: TemperatureThresholdRepository,
    private readonly assetTypesTemperatureRepo: AssetTypesTemperatureRepository,
    private readonly assetInventoryRepo: AssetInventoryRepository
  ) {
    super()
  }

  readonly #generateImportData = async (c: Context) => {
    const body = await c.req.parseBody()
    const file = body.file as File
    const usedTemplate = new AssetModelImport()
    await usedTemplate.loadFromBuffer(await file.arrayBuffer())
    const rows = usedTemplate.getRows()
    const startRow = usedTemplate.getStartRow()

    const rowsResult = rows.map((obj) => {
      const newObj = {}

      if (obj[c.var.t("asset_model.label.name")]) {
        newObj["name"] = obj[c.var.t("asset_model.label.name")]
      }

      if (obj[c.var.t("asset_model.label.asset_type_name")]) {
        newObj["asset_type_id"] =
          obj[c.var.t("asset_model.label.asset_type_name")]
      }

      if (obj[c.var.t("asset_model.label.manufacture_name")]) {
        newObj["manufacture_id"] =
          obj[c.var.t("asset_model.label.manufacture_name")]
      }

      if (obj[c.var.t("asset_model.label.pqs_code")]) {
        newObj["pqs_code_id"] = obj[c.var.t("asset_model.label.pqs_code")]
      }

      if (
        obj[
          c.var.t("asset_model.label.net_capacity.temperature", {
            value: "+5",
          })
        ]
      ) {
        newObj["net_capacity_plus_5"] =
          obj[
            c.var.t("asset_model.label.net_capacity.temperature", {
              value: "+5",
            })
          ]
      }

      if (
        obj[
          c.var.t("asset_model.label.gross_capacity.temperature", {
            value: "+5",
          })
        ]
      ) {
        newObj["gross_capacity_plus_5"] =
          obj[
            c.var.t("asset_model.label.gross_capacity.temperature", {
              value: "+5",
            })
          ]
      }

      if (
        obj[
          c.var.t("asset_model.label.net_capacity.temperature", {
            value: "-20",
          })
        ]
      ) {
        newObj["net_capacity_minus_20"] =
          obj[
            c.var.t("asset_model.label.net_capacity.temperature", {
              value: "-20",
            })
          ]
      }

      if (
        obj[
          c.var.t("asset_model.label.gross_capacity.temperature", {
            value: "-20",
          })
        ]
      ) {
        newObj["gross_capacity_minus_20"] =
          obj[
            c.var.t("asset_model.label.gross_capacity.temperature", {
              value: "-20",
            })
          ]
      }

      if (
        obj[
          c.var.t("asset_model.label.net_capacity.temperature", {
            value: "-86",
          })
        ]
      ) {
        newObj["net_capacity_minus_86"] =
          obj[
            c.var.t("asset_model.label.net_capacity.temperature", {
              value: "-86",
            })
          ]
      }

      if (
        obj[
          c.var.t("asset_model.label.gross_capacity.temperature", {
            value: "-86",
          })
        ]
      ) {
        newObj["gross_capacity_minus_86"] =
          obj[
            c.var.t("asset_model.label.gross_capacity.temperature", {
              value: "-86",
            })
          ]
      }

      if (obj[c.var.t("asset_model.label.net_capacity", { value: "1" })]) {
        newObj["net_capacity_1"] =
          obj[c.var.t("asset_model.label.net_capacity", { value: "1" })]
      }

      if (obj[c.var.t("asset_model.label.gross_capacity", { value: "1" })]) {
        newObj["gross_capacity_1"] =
          obj[c.var.t("asset_model.label.gross_capacity", { value: "1" })]
      }

      if (obj[c.var.t("asset_model.label.net_capacity", { value: "2" })]) {
        newObj["net_capacity_2"] =
          obj[c.var.t("asset_model.label.net_capacity", { value: "2" })]
      }

      if (obj[c.var.t("asset_model.label.gross_capacity", { value: "2" })]) {
        newObj["gross_capacity_2"] =
          obj[c.var.t("asset_model.label.gross_capacity", { value: "2" })]
      }

      if (obj[c.var.t("asset_model.label.net_capacity", { value: "3" })]) {
        newObj["net_capacity_3"] =
          obj[c.var.t("asset_model.label.net_capacity", { value: "3" })]
      }

      if (obj[c.var.t("asset_model.label.gross_capacity", { value: "3" })]) {
        newObj["gross_capacity_3"] =
          obj[c.var.t("asset_model.label.gross_capacity", { value: "3" })]
      }

      if (obj[c.var.t("asset_model.label.have_capacity")]) {
        newObj["is_capacity"] = obj[c.var.t("asset_model.label.have_capacity")]
      }

      return newObj
    })

    const usedSchema = ImportAssetModelArrayRequestSchema.superRefine(
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
              field: c.var.t(`asset_model.label.${err.path[1]}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        } else {
          newError.issues.push({
            path: err.path,
            message: c.var.t(err.message, {
              field: c.var.t(`asset_model.label.${err.path[1]}`),
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

  transformRowSchema = (row: ImportAssetModelRowRequest) => {
    const toArrayInt = (values: string | null | undefined) =>
      values ? values.split(";").map(Number) : null

    return {
      name: row["name"],
      asset_type_id: row["asset_type_id"],
      manufacture_id: row["manufacture_id"],
      pqs_code_id: row["pqs_code_id"],
      net_capacity_plus_5: row["net_capacity_plus_5"],
      gross_capacity_plus_5: row["gross_capacity_plus_5"],
      net_capacity_minus_20: row["net_capacity_minus_20"],
      gross_capacity_minus_20: row["gross_capacity_minus_20"],
      net_capacity_minus_86: row["net_capacity_minus_86"],
      gross_capacity_minus_86: row["gross_capacity_minus_86"],
      net_capacity_1: row["net_capacity_1"],
      gross_capacity_1: row["gross_capacity_1"],
      net_capacity_2: row["net_capacity_2"],
      gross_capacity_2: row["gross_capacity_2"],
      net_capacity_3: row["net_capacity_3"],
      gross_capacity_3: row["gross_capacity_3"],
      is_capacity: row["is_capacity"],
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

  getDiffProgram = (programIds: number[], selectedIds: number[]) => {
    const diff = [
      ...programIds.filter((x) => !selectedIds.includes(x)),
      ...selectedIds.filter((x) => !programIds.includes(x)),
    ]

    const result = diff.join(",")
    return result
  }

  getInactiveProgram = (data) => {
    const result = data
      .filter((item) => item.status === 0)
      .map((item) => item.workspace_id)
      .join(",")

    return result
  }

  private addIssue = (
    path: (string | number)[],
    message: string,
    ctx: z.RefinementCtx
  ) => {
    ctx.addIssue({
      path,
      message,
      code: z.ZodIssueCode.custom,
    })
  }

  readonly #checkRelationsData = (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddAssetModelRequest | EditAssetModelRequest,
    assetMonitoringDevices,
    assetInventories,
    modelCapacitiesTemperature,
    modelCapacitiesNonTemperature,
    assetModelById
  ) => {
    const relatedAsset = assetMonitoringDevices || assetInventories

    if (!relatedAsset) return

    const throwRelationError = () => {
      const errorKey = assetMonitoringDevices
        ? "validator.cannot_update_asset_model_asset_monitoring_device"
        : "validator.cannot_update_asset_model_asset_inventory"

      throw new ValidationError(c.var.t(errorKey, { value: relatedAsset.id }))
    }

    const modelCapacities = modelCapacitiesTemperature?.length
      ? modelCapacitiesTemperature
      : modelCapacitiesNonTemperature

    const newCapacities = data.asset_model_capacity?.capacities ?? []

    // Validation 1: Different capacities
    if (newCapacities.length !== (modelCapacities?.length ?? 0)) {
      throwRelationError()
    }

    // Validation 2: Changes to critical fields
    const hasCriticalFieldChanges =
      assetModelById.manufacture_id !== data.manufacture_id ||
      assetModelById.asset_type_id !== data.asset_type_id ||
      assetModelById.pqs_code_id !== data.asset_model_capacity?.pqs_code_id

    if (hasCriticalFieldChanges) {
      throwRelationError()
    }

    // Validation 3: All existing capacities remain in place
    const newCapacityIds = new Set(newCapacities.map((cap) => cap.id))
    const hasDeletedCapacity = modelCapacities?.some(
      (capacity) => !newCapacityIds.has(capacity.id)
    )

    // Validation 4: All net capacities are unchanged
    const newNetCapacities = newCapacities.map((cap) => cap.net_capacity)
    const oldNetCapacities = modelCapacities?.map((cap) => cap.net_capacity)

    // Validation 5: All gross capacities are unchanged
    const newGrossCapacities = newCapacities.map((cap) => cap.gross_capacity)
    const oldGrossCapacities = modelCapacities?.map((cap) => cap.gross_capacity)

    if (newGrossCapacities.join(",") !== oldGrossCapacities?.join(",")) {
      throwRelationError()
    }

    if (newNetCapacities.join(",") !== oldNetCapacities?.join(",")) {
      throwRelationError()
    }

    if (hasDeletedCapacity) {
      throwRelationError()
    }
  }

  readonly #singleRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddAssetModelRequest | EditAssetModelRequest,
    isUpdate: boolean = false
  ) => {
    const { t } = c.var
    const paramId = isUpdate ? Number(c.req.param("id")) : null

    const throwError = (message: string): never => {
      throw new ValidationError(message)
    }

    // === STEP 1: Parallel Data Fetching ===
    const [
      assetModelById,
      assetModel,
      assetType,
      manufacture,
      whoPqs,
      temperatureThreshold,
      assetTypesTemperature,
      pqsNetCapacities,
      modelCapacitiesTemperature,
      modelCapacitiesNonTemperature,
      assetMonitoringDevices,
      assetInventories,
    ] = await Promise.all([
      isUpdate ? this.repository.findOne(c, { id: paramId }) : null,
      data.name && data.manufacture_id && data.asset_type_id
        ? this.repository.findOne(c, {
            name: data.name,
            manufacture_id: data.manufacture_id,
            asset_type_id: data.asset_type_id,
          })
        : null,
      data.asset_type_id
        ? this.repository.getAssetTypeById(c, data.asset_type_id)
        : null,
      data.manufacture_id
        ? this.repository.getManufactureById(c, data.manufacture_id)
        : null,
      data.asset_model_capacity?.pqs_code_id
        ? this.whoPqsRepo.findOne(c, {
            id: data.asset_model_capacity.pqs_code_id,
          })
        : null,
      data.asset_model_capacity?.pqs_code_id
        ? this.temperatureThresholdRepo.find(c, { is_predefined: 1 })
        : null,
      data.asset_type_id
        ? this.assetTypesTemperatureRepo.find(c, {
            asset_type_id: data.asset_type_id,
          })
        : [],
      data.asset_model_capacity?.pqs_code_id
        ? this.whoPqsRepo.getListPqsNetCapacities(c, [
            data.asset_model_capacity.pqs_code_id,
          ])
        : null,
      isUpdate
        ? this.repository.getCapacityTemperatureByAssetModelId(c, [paramId!])
        : null,
      isUpdate
        ? this.repository.getCapacityNonTemperatureByAssetModelIds(c, [
            paramId!,
          ])
        : null,
      isUpdate
        ? this.repository.findAssetMonitoringDeviceByAssetModelId(c, paramId!)
        : null,
      isUpdate
        ? this.assetInventoryRepo.findOne(c, { asset_model_id: paramId! })
        : null,
    ])

    if (isUpdate) {
      this.#checkRelationsData(
        c,
        ctx,
        data,
        assetMonitoringDevices,
        assetInventories,
        modelCapacitiesTemperature,
        modelCapacitiesNonTemperature,
        assetModelById
      )
    }

    // === STEP 2: Pre-compute Reusable Values ===
    const capacities = data.asset_model_capacity?.capacities || []
    const countRowsDataCapacities =
      modelCapacitiesTemperature?.length ||
      modelCapacitiesNonTemperature?.length ||
      0
    const isCCE =
      assetType?.asset_classifications_id === ASSET_CLASSIFICATION.CCE
    const modelCapacities = modelCapacitiesTemperature?.length
      ? modelCapacitiesTemperature
      : modelCapacitiesNonTemperature

    // Build capacity lookup map for O(1) access
    const capacityMap = new Map(
      modelCapacities?.map((cap) => [cap.id, cap]) || []
    )

    // === STEP 3: Basic Validations ===
    // Unique Asset Model validation
    if (data.name && assetModel) {
      if (!isUpdate || assetModel.id !== paramId) {
        throwError(t("validator.exist", { field: "Asset Model" }))
      }
    }

    // Prevent Asset Type change when capacities exist
    if (
      isUpdate &&
      data.asset_type_id &&
      data.asset_type_id !== assetModelById?.asset_type_id &&
      countRowsDataCapacities > 0
    ) {
      throwError(t("validator.cannot_change", { field: "Asset Type" }))
    }

    // Prevent PQS Code change when capacities exist
    if (
      isUpdate &&
      data.asset_model_capacity?.pqs_code_id &&
      data.asset_model_capacity.pqs_code_id !== assetModelById?.pqs_code_id &&
      countRowsDataCapacities > 0
    ) {
      throwError(t("validator.cannot_change", { field: "PQS Code" }))
    }

    // Existence validations
    if (data.asset_type_id && !assetType) {
      this.addIssue(
        ["asset_type_id"],
        t("validator.not_exist", {
          field: t("asset_model.label.asset_type_id"),
        }),
        ctx
      )
    }
    if (data.manufacture_id && !manufacture) {
      this.addIssue(
        ["manufacture_id"],
        t("validator.not_exist", {
          field: t("asset_model.label.manufacture_id"),
        }),
        ctx
      )
    }
    if (data.asset_model_capacity?.pqs_code_id && !whoPqs) {
      this.addIssue(
        ["asset_model_capacity.pqs_code_id"],
        t("validator.not_exist", { field: t("asset_model.label.pqs_code_id") }),
        ctx
      )
    }

    // === STEP 4: Non-CCE Validation ===
    if (!isCCE) {
      const hasTemperatureData =
        capacities.some((cap) => cap.id_temperature_threshold != null) || whoPqs

      if (hasTemperatureData) {
        this.addIssue(
          ["asset_type_id"],
          t("validator.asset_type.excluding_cce", {
            value: data.asset_type_id,
          }),
          ctx
        )
      }
      if (data.asset_model_capacity?.pqs_code_id) {
        this.addIssue(
          ["asset_model_capacity", "pqs_code_id"],
          t("validator.not_required", { field: t("pqs_code_id") }),
          ctx
        )
      }

      let countData = countRowsDataCapacities
      capacities.forEach((cap, idx) => {
        if (cap.id_temperature_threshold != null) {
          this.addIssue(
            [
              "asset_model_capacity",
              "capacities",
              idx,
              "id_temperature_threshold",
            ],
            t("validator.not_required", {
              field: t("id_temperature_threshold"),
            }),
            ctx
          )
        }

        if (cap.id != null && !capacityMap.has(cap.id) && isUpdate) {
          this.addIssue(
            ["asset_model_capacity", "capacities", idx, "id"],
            t("validator.not_exist", { field: "id" }),
            ctx
          )
        }

        if (cap.id === null && isUpdate) {
          countData++
          if (countData > 3) {
            this.addIssue(
              ["asset_model_capacity", "capacities", idx, "id"],
              t("validator.more_than", { row: "Capacities", value: 3 }),
              ctx
            )
          }
        }
      })
      return
    }

    // === STEP 5: CCE Validation ===
    const hasPqsCode = data.asset_model_capacity?.pqs_code_id != null

    // Capacity count must match threshold count
    if (hasPqsCode && capacities.length !== assetTypesTemperature?.length) {
      throwError(t("validator.asset_type.data_net_capacity_mismatch"))
    }

    // Build threshold sets for O(1) lookup
    const validGlobalThresholdIds = new Set(
      temperatureThreshold?.map((t) => t.id) || []
    )
    const allowedThresholdIds = new Set(
      assetTypesTemperature
        .map((att) => att.temperature_threshold_id)
        .filter((id): id is number => id != null)
    )

    // Check WHO compliance
    const invalidThresholds = Array.from(allowedThresholdIds).filter(
      (id) => !validGlobalThresholdIds.has(id)
    )
    if (invalidThresholds.length > 0 && hasPqsCode) {
      throwError(
        t("validator.temperature_range_does_not_comply_with_who_standards", {
          invalidIds: invalidThresholds.join(", "),
        })
      )
    }

    // Build PQS net capacity map
    const pqsNetCapacityMap = new Map(
      pqsNetCapacities?.map((item) => [
        item.temperature_threshold_id,
        item.net_capacity,
      ]) || []
    )

    // Validate each capacity
    const seenThresholdIds = new Set<number>()
    let countData = countRowsDataCapacities

    capacities.forEach((capacity, idx) => {
      const { id_temperature_threshold, net_capacity, gross_capacity, id } =
        capacity
      const findIdCapacity = id != null ? capacityMap.get(id) : undefined

      // Mandatory threshold
      if (id_temperature_threshold == null) {
        this.addIssue(
          [
            "asset_model_capacity",
            "capacities",
            idx,
            "id_temperature_threshold",
          ],
          t("validator.must_be_filled", {
            field: t("id_temperature_threshold"),
          }),
          ctx
        )
        return
      }

      // Duplicate threshold check
      if (seenThresholdIds.has(id_temperature_threshold)) {
        this.addIssue(
          [
            "asset_model_capacity",
            "capacities",
            idx,
            "id_temperature_threshold",
          ],
          t("validator.field_value_duplicated", {
            field: "id_temperature_threshold",
            values: id_temperature_threshold,
          }),
          ctx
        )
      } else {
        seenThresholdIds.add(id_temperature_threshold)
      }

      // WHO threshold existence
      if (
        hasPqsCode &&
        !validGlobalThresholdIds.has(id_temperature_threshold)
      ) {
        this.addIssue(
          [
            "asset_model_capacity",
            "capacities",
            idx,
            "id_temperature_threshold",
          ],
          t("validator.not_exist", { field: t("id_temperature_threshold") }),
          ctx
        )
      }

      // Allowed threshold for asset type
      if (!allowedThresholdIds.has(id_temperature_threshold)) {
        this.addIssue(
          [
            "asset_model_capacity",
            "capacities",
            idx,
            "id_temperature_threshold",
          ],
          t("validator.not_exist", { field: t("id_temperature_threshold") }),
          ctx
        )
      }

      // Net <= Gross validation
      if (
        net_capacity != null &&
        gross_capacity != null &&
        net_capacity > gross_capacity
      ) {
        this.addIssue(
          ["asset_model_capacity", "capacities", idx, "net_capacity"],
          t("validator.not_greater_than", {
            field1: t("asset_model.label.net_capacity"),
            field2: t("asset_model.label.gross_capacity"),
          }),
          ctx
        )
        this.addIssue(
          ["asset_model_capacity", "capacities", idx, "gross_capacity"],
          t("validator.not_less_than", {
            field1: t("asset_model.label.gross_capacity"),
            field2: t("asset_model.label.net_capacity"),
          }),
          ctx
        )
      }

      // PQS net capacity match
      if (whoPqs && pqsNetCapacities) {
        const expectedNet = pqsNetCapacityMap.get(id_temperature_threshold)
        if (
          expectedNet != null &&
          net_capacity != null &&
          net_capacity !== expectedNet &&
          allowedThresholdIds.has(id_temperature_threshold)
        ) {
          this.addIssue(
            ["asset_model_capacity", "capacities", idx, "net_capacity"],
            t("validator.net_capacity_does_not_match_net_capacity_pqs", {
              values: expectedNet,
            }),
            ctx
          )
        }
      }

      // Asset type temperature validation
      if (
        !assetTypesTemperature.some(
          (att) => att.temperature_threshold_id === id_temperature_threshold
        )
      ) {
        this.addIssue(
          ["asset_model_capacity", "capacities", idx, "net_capacity"],
          t(
            "validator.asset_type.selected_net_capacity_vs_capacity_in_asset_type"
          ),
          ctx
        )
      }

      // Capacity ID validation on update
      if (id != null && !findIdCapacity && isUpdate) {
        this.addIssue(
          ["asset_model_capacity", "capacities", idx, "id"],
          t("validator.not_exist", { field: "id" }),
          ctx
        )
      }

      // Threshold ID must match existing ID
      if (id != null && isUpdate && findIdCapacity) {
        const existingThresholdId =
          "temperature_threshold_id" in findIdCapacity
            ? (findIdCapacity as any).temperature_threshold_id
            : null
        if (existingThresholdId !== id_temperature_threshold) {
          this.addIssue(
            [
              "asset_model_capacity",
              "capacities",
              idx,
              "id_temperature_threshold",
            ],
            t("validator.is_not_match", {
              field1: "id",
              field2: "id_temperature_threshold",
              value: existingThresholdId,
            }),
            ctx
          )
        }
      }

      // Count new capacities
      if (id === null && isUpdate) {
        countData++
        if (countData > countRowsDataCapacities) {
          this.addIssue(
            ["asset_model_capacity", "capacities", idx, "id"],
            t("validator.more_than", {
              row: "Capacities",
              value: countRowsDataCapacities,
            }),
            ctx
          )
        }
      }
    })

    // PQS Code required validation
    if (
      assetModelById?.pqs_code_id &&
      data.asset_model_capacity?.pqs_code_id == null &&
      isUpdate &&
      countRowsDataCapacities > 0
    ) {
      this.addIssue(
        ["pqs_code_id"],
        t("validator.must_be_filled", { field: "pqs_code_id" }),
        ctx
      )
    }
  }

  readonly #pathParamValidation = async (c: Context) => {
    const id = c.req.param("id")
    const assetVendor = await this.repository.getOnlyAssetModelById(
      c,
      Number(id)
    )

    if (!assetVendor) {
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

  readonly #multipleRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: ImportAssetModelArrayRequest
  ) => {
    const type = Number((c.req.queries("type") ?? [])[0] ?? 0)
    const seen = new Set<string>()

    for (const [index, d] of data.entries()) {
      // Fetch all required data in parallel
      const [
        assetModel,
        assetType,
        manufacture,
        whoPqs,
        temperatureThreshold,
        assetTypesTemperature,
        pqsNetCapacities,
      ] = await Promise.all([
        this.repository.findOne(c, {
          name: d["name"],
          manufacture_id: d["manufacture_id"],
          asset_type_id: d["asset_type_id"],
        }),
        this.repository.getAssetTypeById(c, d["asset_type_id"]),
        this.repository.getManufactureById(c, d["manufacture_id"]),
        d["pqs_code_id"]
          ? this.whoPqsRepo.findOne(c, { id: d["pqs_code_id"] })
          : null,
        this.temperatureThresholdRepo.find(c, { is_predefined: 1 }),
        d["asset_type_id"]
          ? this.assetTypesTemperatureRepo.find(c, {
              asset_type_id: d["asset_type_id"],
            })
          : null,
        d["pqs_code_id"]
          ? this.whoPqsRepo.getListPqsNetCapacities(c, [d["pqs_code_id"]])
          : null,
      ])

      const isCCE =
        assetType?.asset_classifications_id === ASSET_CLASSIFICATION.CCE

      // Basic validations
      if (d["name"] && d["manufacture_id"] && d["asset_type_id"]) {
        // Check duplicate in sheet
        const key = `${d.name.toUpperCase()}-${d.asset_type_id}-${d.manufacture_id}`
        if (seen.has(key)) {
          ctx.addIssue({
            path: [index, "name"],
            message: c.var.t("validator.duplicated", {
              field: `${c.var.t("asset_model.label.name")}, ${c.var.t(
                "asset_model.label.asset_type_name"
              )}, ${c.var.t("asset_model.label.manufacture_name")}`,
            }),
            code: z.ZodIssueCode.custom,
          })
        } else {
          seen.add(key)
        }

        // CCE type validation
        if (
          !isCCE &&
          (type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITH_PQS ||
            type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITHOUT_PQS)
        ) {
          ctx.addIssue({
            path: [index, "asset_type_id"],
            message: c.var.t("validator.asset_type.not_cce", {
              field: c.var.t("asset_model.label.asset_type_name"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        if (isCCE && type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.NON_CCE) {
          ctx.addIssue({
            path: [index, "asset_type_id"],
            message: c.var.t("validator.asset_type.cce", {
              field: c.var.t("asset_model.label.asset_type_name"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        // Check if asset model already exists
        if (assetModel) {
          ctx.addIssue({
            path: [index, "name"],
            message: c.var.t("validator.exist", {
              field: c.var.t("asset_model.label.name"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        // Validate asset type existence
        if (d["asset_type_id"] && !assetType) {
          ctx.addIssue({
            path: [index, "asset_type_id"],
            message: c.var.t("validator.not_exist", {
              field: c.var.t("asset_model.label.asset_type_id"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        // Validate manufacture existence
        if (d["manufacture_id"] && !manufacture) {
          ctx.addIssue({
            path: [index, "manufacture_id"],
            message: c.var.t("validator.not_exist", {
              field: c.var.t("asset_model.label.manufacture_id"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }

      // Skip CCE validation for NON_CCE type
      if (type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.NON_CCE && !isCCE) {
        const capacities = [
          {
            id_temperature_threshold: null,
            net_capacity: d["net_capacity_1"],
            gross_capacity: d["gross_capacity_1"],
          },
          {
            id_temperature_threshold: null,
            net_capacity: d["net_capacity_2"],
            gross_capacity: d["gross_capacity_2"],
          },
          {
            id_temperature_threshold: null,
            net_capacity: d["net_capacity_3"],
            gross_capacity: d["gross_capacity_3"],
          },
        ]

        const hasTemperatureData =
          capacities.some((cap) => cap.id_temperature_threshold != null) ||
          whoPqs

        if (hasTemperatureData) {
          this.addIssue(
            ["asset_type_id"],
            c.var.t("validator.asset_type.excluding_cce", {
              value: d["asset_type_id"],
            }),
            ctx
          )
        }
        if (d["pqs_code_id"]) {
          this.addIssue(
            ["asset_model_capacity", "pqs_code_id"],
            c.var.t("validator.not_required", {
              field: c.var.t("asset_model.label.pqs_code"),
            }),
            ctx
          )
        }

        if (d["net_capacity_1"] === null && d["is_capacity"] === 1) {
          this.addIssue(
            [index, "net_capacity_1"],
            c.var.t("validator.must_be_filled", {
              field: c.var.t("asset_model.label.net_capacity", { value: "1" }),
            }),
            ctx
          )
        }

        if (d["gross_capacity_1"] === null && d["is_capacity"] === 1) {
          this.addIssue(
            [index, "gross_capacity_1"],
            c.var.t("validator.must_be_filled", {
              field: c.var.t("asset_model.label.gross_capacity", {
                value: "1",
              }),
            }),
            ctx
          )
        }

        if (
          capacities.filter((cap) => cap.net_capacity != null).length > 0 &&
          d["is_capacity"] === 0
        ) {
          this.addIssue(
            [index, "is_capacity"],
            c.var.t("validator.must_be_filled", {
              field: c.var.t("asset_model.label.have_capacity"),
            }),
            ctx
          )
        }

        // Net <= Gross validation
        capacities.forEach((cap, idx) => {
          if (
            cap.net_capacity != null &&
            cap.gross_capacity != null &&
            cap.net_capacity > cap.gross_capacity
          ) {
            ctx.addIssue({
              path: [index, `net_capacity${idx + 1}`],
              message: c.var.t("validator.not_greater_than", {
                field1: c.var.t("asset_model.label.net_capacity", {
                  value: `${idx + 1}`,
                }),
                field2: c.var.t("asset_model.label.gross_capacity", {
                  value: `${idx + 1}`,
                }),
              }),
              code: z.ZodIssueCode.custom,
            })
            ctx.addIssue({
              path: [index, `gross_capacity${idx + 1}`],
              message: c.var.t("validator.not_less_than", {
                field1: c.var.t("asset_model.label.gross_capacity", {
                  value: `${idx + 1}`,
                }),
                field2: c.var.t("asset_model.label.net_capacity", {
                  value: `${idx + 1}`,
                }),
              }),
              code: z.ZodIssueCode.custom,
            })
          }
        })

        return
      }

      // CCE-specific validation
      const hasPqsCode = d["pqs_code_id"] != null

      // Temperature threshold mapping
      const mapping = [
        {
          key: "plus_5",
          id:
            temperatureThreshold.find(
              (t) => t.min_temperature === 2 && t.max_temperature === 8
            )?.id ?? 0,
        },
        {
          key: "minus_20",
          id:
            temperatureThreshold.find(
              (t) => t.min_temperature === -25 && t.max_temperature === -15
            )?.id ?? 0,
        },
        {
          key: "minus_86",
          id:
            temperatureThreshold.find(
              (t) => t.min_temperature === -86 && t.max_temperature === -40
            )?.id ?? 0,
        },
      ]

      // Build capacity array
      const capacities = mapping
        .map(({ key, id }) => ({
          id_temperature_threshold: id,
          net_capacity: d[`net_capacity_${key}`],
          gross_capacity: d[`gross_capacity_${key}`],
        }))
        .filter((c) => c.net_capacity !== null && c.gross_capacity !== null)

      // Validate capacity count matches asset type temperature requirements
      if (
        hasPqsCode &&
        capacities.filter((c) => c.id_temperature_threshold !== 0).length !==
          assetTypesTemperature?.length
      ) {
        ctx.addIssue({
          path: [index, "asset_type_id"],
          message: c.var.t("validator.asset_type.data_net_capacity_mismatch"),
          code: z.ZodIssueCode.custom,
        })
      }

      // Build threshold sets for efficient lookup
      const validGlobalThresholdIds = new Set(
        temperatureThreshold.map((t) => t.id)
      )
      const allowedThresholdIds = new Set(
        assetTypesTemperature?.map((att) => att.temperature_threshold_id) ?? []
      )

      // Check WHO compliance
      const invalidThresholds = Array.from(allowedThresholdIds).filter(
        (id) => !validGlobalThresholdIds.has(id)
      )

      if (invalidThresholds.length > 0 && hasPqsCode) {
        ctx.addIssue({
          path: [index, "asset_type_id"],
          message: c.var.t(
            "validator.temperature_range_does_not_comply_with_who_standards",
            {
              invalidIds: invalidThresholds.join(", "),
            }
          ),
          code: z.ZodIssueCode.custom,
        })
      }

      // Build PQS net capacity map
      const pqsNetCapacityMap = new Map(
        pqsNetCapacities?.map((item) => [
          item.temperature_threshold_id,
          item.net_capacity,
        ]) ?? []
      )

      if (
        type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITH_PQS &&
        !d["pqs_code_id"]
      ) {
        ctx.addIssue({
          path: [index, "pqs_code_id"],
          message: c.var.t("validator.must_be_filled", {
            field: c.var.t("asset_model.label.pqs_code"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITHOUT_PQS &&
        d["pqs_code_id"]
      ) {
        ctx.addIssue({
          path: [index, "pqs_code_id"],
          message: c.var.t("validator.not_required", {
            field: c.var.t("asset_model.label.pqs_code"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        (type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITH_PQS ||
          type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITHOUT_PQS) &&
        capacities.length === 0
      ) {
        ctx.addIssue({
          path: [index, "capacities"],
          message: c.var.t("validator.must_be_filled", {
            field: c.var.t("Capacities"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
      // Validate each capacity
      capacities.forEach((capacity, idx) => {
        const { id_temperature_threshold, net_capacity, gross_capacity } =
          capacity
        const mappingKey = mapping.find(
          (m) => m.id === id_temperature_threshold
        )?.key

        if (!mappingKey) return
        const convertMappingKey =
          mappingKey === "plus_5"
            ? "+5"
            : mappingKey === "minus_20"
              ? "-20"
              : "-86"

        // WHO threshold existence validation
        if (
          hasPqsCode &&
          !validGlobalThresholdIds.has(id_temperature_threshold)
        ) {
          ctx.addIssue({
            path: [index, `net_capacity_${mappingKey}`],
            message: c.var.t("validator.not_exist", {
              field: c.var.t("asset_model.label.net_capacity.temperature", {
                value: convertMappingKey,
              }),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        // Allowed threshold for asset type validation
        if (!allowedThresholdIds.has(id_temperature_threshold)) {
          ctx.addIssue({
            path: [index, `net_capacity_${mappingKey}`],
            message: c.var.t("validator.not_exist", {
              field: c.var.t("asset_model.label.net_capacity.temperature", {
                value: convertMappingKey,
              }),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        // Net <= Gross validation
        if (
          net_capacity != null &&
          gross_capacity != null &&
          net_capacity > gross_capacity
        ) {
          ctx.addIssue({
            path: [index, `net_capacity_${mappingKey}`],
            message: c.var.t("validator.not_greater_than", {
              field1: c.var.t("asset_model.label.net_capacity.temperature", {
                value: convertMappingKey,
              }),
              field2: c.var.t("asset_model.label.gross_capacity.temperature", {
                value: convertMappingKey,
              }),
            }),
            code: z.ZodIssueCode.custom,
          })

          ctx.addIssue({
            path: [index, `gross_capacity_${mappingKey}`],
            message: c.var.t("validator.not_less_than", {
              field1: c.var.t("asset_model.label.gross_capacity.temperature", {
                value: convertMappingKey,
              }),
              field2: c.var.t("asset_model.label.net_capacity.temperature", {
                value: convertMappingKey,
              }),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        // PQS net capacity match validation
        if (whoPqs && pqsNetCapacities) {
          const pqsCapacity = pqsNetCapacityMap.get(id_temperature_threshold)
          if (
            pqsCapacity != null &&
            net_capacity != null &&
            net_capacity !== pqsCapacity &&
            allowedThresholdIds.has(id_temperature_threshold)
          ) {
            ctx.addIssue({
              path: [index, `net_capacity_${mappingKey}`],
              message: c.var.t(
                "validator.net_capacity_does_not_match_net_capacity_pqs",
                {
                  values: pqsCapacity,
                  field: c.var.t(
                    "asset_model.label.gross_capacity.temperature",
                    {
                      value: convertMappingKey,
                    }
                  ),
                }
              ),
              code: z.ZodIssueCode.custom,
            })
          }
        }

        // Asset type temperature validation
        if (
          !assetTypesTemperature?.some(
            (att) => att.temperature_threshold_id === id_temperature_threshold
          )
        ) {
          ctx.addIssue({
            path: [index, "asset_type_id"],
            message: c.var.t(
              "validator.asset_type.selected_net_capacity_vs_capacity_in_asset_type"
            ),
            code: z.ZodIssueCode.custom,
          })
        }

        // Gross capacity required when net capacity exists
        if (
          d[`net_capacity_${mappingKey}`] != null &&
          d[`gross_capacity_${mappingKey}`] == null
        ) {
          ctx.addIssue({
            path: [index, `gross_capacity_${mappingKey}`],
            message: c.var.t("validator.must_be_filled", {
              field: c.var.t(`asset_model.label.gross_capacity_${mappingKey}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        // Net capacity required when gross capacity exists
        if (
          d[`gross_capacity_${mappingKey}`] != null &&
          d[`net_capacity_${mappingKey}`] == null
        ) {
          ctx.addIssue({
            path: [index, `net_capacity_${mappingKey}`],
            message: c.var.t("validator.must_be_filled", {
              field: c.var.t(`asset_model.label.net_capacity_${mappingKey}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      })
    }
  }

  create = (c: Context) => {
    return AddAssetModelRequestSchema.superRefine(async (data, ctx) => {
      await this.#singleRequestValidation(c, ctx, data)
    })
  }

  update = (c: Context) => {
    return EditAssetModelRequestSchema.superRefine(async (data, ctx) => {
      await this.#pathParamValidation(c)
      await this.#singleRequestValidation(c, ctx, data, true)
    })
  }

  list = (c: Context) => {
    return GetAssetModelsQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  export = (c: Context) => {
    return GetAssetModelsQueryParamsSchema.superRefine(async (data, ctx) => {
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
