import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { Context } from "hono"
import { z } from "zod"
import {
  AddAssetMonitoringDeviceRequestSchema,
  EditAssetMonitoringDeviceRequestSchema,
  GetAssetMonitoringDevicesQueryParamsSchema,
  BulkDeleteAssetMonitoringDeviceRequestSchema,
  DeleteAssetMonitoringDeviceParamSchema,
  AddAssetMonitoringDeviceRequest,
  EditAssetMonitoringDeviceRequest,
  GetAssetMonitoringDevicesQueryParams,
} from "./asset-monitoring-device.schema.js"
import { createMiddleware } from "hono/factory"
import { NotFoundError } from "@smile-health/lib/error.js"
import { AssetMonitoringDeviceRepository } from "./asset-monitoring-device.repository.js"

export class AssetMonitoringDeviceMiddleware extends BaseMiddleware {
  constructor(private readonly repository: AssetMonitoringDeviceRepository) {
    super()
  }

  readonly #createRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddAssetMonitoringDeviceRequest
  ) => {
    // Validate required fields for create operation
    if (!data.serial_number) {
      ctx.addIssue({
        path: ["serial_number"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.serial_number"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.asset_type_id) {
      ctx.addIssue({
        path: ["asset_type_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.asset_type"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.asset_model_id) {
      ctx.addIssue({
        path: ["asset_model_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.asset_model"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.manufacture_id) {
      ctx.addIssue({
        path: ["manufacture_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.manufacture"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.asset_vendor_id) {
      ctx.addIssue({
        path: ["asset_vendor_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.asset_vendor"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.asset_communication_provider_id) {
      ctx.addIssue({
        path: ["asset_communication_provider_id"],
        message: c.var.t("validator.required", {
          field: c.var.t(
            "asset_monitoring_device.label.asset_communication_provider"
          ),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.asset_rtmd_status_id) {
      ctx.addIssue({
        path: ["asset_rtmd_status_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.asset_rtmd_status"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.entity_id) {
      ctx.addIssue({
        path: ["entity_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.entity"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.budget_year) {
      ctx.addIssue({
        path: ["budget_year"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.budget_year"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.budget_source_id) {
      ctx.addIssue({
        path: ["budget_source_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.budget_source"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.production_year) {
      ctx.addIssue({
        path: ["production_year"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.production_year"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #updateRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: EditAssetMonitoringDeviceRequest
  ) => {
    // Validate that required fields cannot be null on update
    if (data.serial_number !== undefined) {
      if (data.serial_number === null || data.serial_number.trim() === "") {
        ctx.addIssue({
          path: ["serial_number"],
          message: c.var.t("validator.required", {
            field: c.var.t("asset_monitoring_device.label.serial_number"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.asset_type_id !== undefined && data.asset_type_id === null) {
      ctx.addIssue({
        path: ["asset_type_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.asset_type"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.asset_model_id !== undefined && data.asset_model_id === null) {
      ctx.addIssue({
        path: ["asset_model_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.asset_model"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.manufacture_id !== undefined && data.manufacture_id === null) {
      ctx.addIssue({
        path: ["manufacture_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.manufacture"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.asset_vendor_id !== undefined && data.asset_vendor_id === null) {
      ctx.addIssue({
        path: ["asset_vendor_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.asset_vendor"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.asset_communication_provider_id !== undefined &&
      data.asset_communication_provider_id === null
    ) {
      ctx.addIssue({
        path: ["asset_communication_provider_id"],
        message: c.var.t("validator.required", {
          field: c.var.t(
            "asset_monitoring_device.label.asset_communication_provider"
          ),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.asset_rtmd_status_id !== undefined &&
      data.asset_rtmd_status_id === null
    ) {
      ctx.addIssue({
        path: ["asset_rtmd_status_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.asset_rtmd_status"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.entity_id !== undefined && data.entity_id === null) {
      ctx.addIssue({
        path: ["entity_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.entity"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.budget_year !== undefined && data.budget_year === null) {
      ctx.addIssue({
        path: ["budget_year"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.budget_year"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.budget_source_id !== undefined && data.budget_source_id === null) {
      ctx.addIssue({
        path: ["budget_source_id"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.budget_source"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.production_year !== undefined && data.production_year === null) {
      ctx.addIssue({
        path: ["production_year"],
        message: c.var.t("validator.required", {
          field: c.var.t("asset_monitoring_device.label.production_year"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #commonValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddAssetMonitoringDeviceRequest | EditAssetMonitoringDeviceRequest,
    excludeId?: number
  ) => {
    if ("serial_number" in data && data.serial_number) {
      const isSerialNumberUnique = await this.repository.validateSerialNumber(
        c,
        data.serial_number,
        excludeId
      )
      if (!isSerialNumberUnique) {
        ctx.addIssue({
          path: ["serial_number"],
          message: c.var.t("validator.exist", {
            field: c.var.t("asset_monitoring_device.label.serial_number"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    // Production year validation removed - allow any year

    if (data.budget_year) {
      const currentYear = new Date().getFullYear()
      if (data.budget_year < 2000 || data.budget_year > currentYear + 10) {
        ctx.addIssue({
          path: ["budget_year"],
          message: c.var.t("validator.invalid_year_range", {
            field: c.var.t("asset_monitoring_device.label.budget_year"),
            min: 2000,
            max: currentYear + 10,
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.contact_persons) {
      if (data.contact_persons.length === 0) {
        ctx.addIssue({
          path: ["contact_persons"],
          message: c.var.t("validator.at_least_one_required", {
            field: c.var.t("asset_monitoring_device.label.contact_persons"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      if (data.contact_persons.length > 3) {
        ctx.addIssue({
          path: ["contact_persons"],
          message: c.var.t("validator.max_items", {
            field: c.var.t("asset_monitoring_device.label.contact_persons"),
            max: 3,
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      for (const [index, cp] of data.contact_persons.entries()) {
        if (!cp.name) {
          ctx.addIssue({
            path: ["contact_persons", index, "name"],
            message: c.var.t("validator.required", {
              field: c.var.t(
                "asset_monitoring_device.label.contact_person_name"
              ),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        if (!cp.phone) {
          ctx.addIssue({
            path: ["contact_persons", index, "phone"],
            message: c.var.t("validator.required", {
              field: c.var.t(
                "asset_monitoring_device.label.contact_person_phone"
              ),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        if (cp.phone && !/^[+]?[\d\s\-()]+$/.test(cp.phone)) {
          ctx.addIssue({
            path: ["contact_persons", index, "phone"],
            message: c.var.t("validator.invalid_phone_format"),
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }

    // Validate individual field existence in database
    if (data.asset_type_id) {
      const isValidAssetType = await this.repository.validateAssetType(
        c,
        data.asset_type_id
      )
      if (!isValidAssetType) {
        ctx.addIssue({
          path: ["asset_type_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_monitoring_device.label.asset_type"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.asset_model_id) {
      const isValidAssetModel = await this.repository.validateAssetModel(
        c,
        data.asset_model_id
      )
      if (!isValidAssetModel) {
        ctx.addIssue({
          path: ["asset_model_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_monitoring_device.label.asset_model"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.manufacture_id) {
      const isValidManufacture = await this.repository.validateManufacture(
        c,
        data.manufacture_id
      )
      if (!isValidManufacture) {
        ctx.addIssue({
          path: ["manufacture_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_monitoring_device.label.manufacture"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.asset_vendor_id) {
      const isValidAssetVendor = await this.repository.validateAssetVendor(
        c,
        data.asset_vendor_id
      )
      if (!isValidAssetVendor) {
        ctx.addIssue({
          path: ["asset_vendor_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_monitoring_device.label.asset_vendor"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.asset_communication_provider_id) {
      const isValidCommunicationProvider =
        await this.repository.validateCommunicationProvider(
          c,
          data.asset_communication_provider_id
        )
      if (!isValidCommunicationProvider) {
        ctx.addIssue({
          path: ["asset_communication_provider_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t(
              "asset_monitoring_device.label.asset_communication_provider"
            ),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.asset_rtmd_status_id) {
      const isValidRtmdStatus = await this.repository.validateAssetRtmdStatus(
        c,
        data.asset_rtmd_status_id
      )
      if (!isValidRtmdStatus) {
        ctx.addIssue({
          path: ["asset_rtmd_status_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_monitoring_device.label.asset_rtmd_status"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.entity_id) {
      const isValidEntity = await this.repository.validateEntity(
        c,
        data.entity_id
      )
      if (!isValidEntity) {
        ctx.addIssue({
          path: ["entity_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_monitoring_device.label.entity"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.budget_source_id) {
      const isValidBudgetSource = await this.repository.validateBudgetSource(
        c,
        data.budget_source_id
      )
      if (!isValidBudgetSource) {
        ctx.addIssue({
          path: ["budget_source_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_monitoring_device.label.budget_source"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    // Validate asset relationship: asset_type + manufacture + asset_model combination
    if (data.asset_type_id && data.manufacture_id && data.asset_model_id) {
      const isValidRelationship =
        await this.repository.validateAssetRelationship(
          c,
          data.asset_type_id,
          data.manufacture_id,
          data.asset_model_id
        )

      if (!isValidRelationship) {
        ctx.addIssue({
          path: ["asset_model_id"],
          message: c.var.t("validator.invalid_asset_combination", {
            asset_type: c.var.t("asset_monitoring_device.label.asset_type"),
            manufacture: c.var.t("asset_monitoring_device.label.manufacture"),
            asset_model: c.var.t("asset_monitoring_device.label.asset_model"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #pathParamValidation = async (c: Context) => {
    const id = Number(c.req.param("id"))
    const device = await this.repository.existsById(c, id)

    if (!device) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("asset_monitoring_device.label.id"),
        })
      )
    }
  }

  readonly #queryParamValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetAssetMonitoringDevicesQueryParams
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

  create = (c: Context) => {
    return AddAssetMonitoringDeviceRequestSchema.superRefine(
      async (data: AddAssetMonitoringDeviceRequest, ctx: z.RefinementCtx) => {
        await this.#createRequestValidation(c, ctx, data)
        await this.#commonValidation(c, ctx, data, undefined)
      }
    )
  }

  update = (c: Context) => {
    return EditAssetMonitoringDeviceRequestSchema.superRefine(
      async (data: EditAssetMonitoringDeviceRequest, ctx: z.RefinementCtx) => {
        const id = Number(c.req.param("id"))
        await this.#pathParamValidation(c)
        await this.#updateRequestValidation(c, ctx, data)
        await this.#commonValidation(c, ctx, data, id)
      }
    )
  }

  list = (c: Context) => {
    return GetAssetMonitoringDevicesQueryParamsSchema.superRefine(
      async (
        data: GetAssetMonitoringDevicesQueryParams,
        ctx: z.RefinementCtx
      ) => {
        await this.#queryParamValidation(c, ctx, data)
      }
    )
  }

  export = (c: Context) => {
    return GetAssetMonitoringDevicesQueryParamsSchema.superRefine(
      async (
        data: GetAssetMonitoringDevicesQueryParams,
        ctx: z.RefinementCtx
      ) => {
        await this.#queryParamValidation(c, ctx, data)
      }
    )
  }

  detail = createMiddleware(async (c, next) => {
    await this.#pathParamValidation(c)
    await next()
  })

  delete = (c: Context) => {
    return DeleteAssetMonitoringDeviceParamSchema.superRefine(
      async (data, ctx) => {
        await this.#pathParamValidation(c)

        const id = Number(data.id)
        const isRelated = await this.repository.isDeviceRelated(c, id)

        if (isRelated) {
          ctx.addIssue({
            path: ["id"],
            message: c.var.t("validator.cannot_delete_related", {
              field: c.var.t("asset_monitoring_device.label.device"),
            }) || "Device cannot be deleted because it is already related to an asset",
            code: z.ZodIssueCode.custom,
          })
        }
      }
    )
  }

  bulkDelete = (c: Context) => {
    return BulkDeleteAssetMonitoringDeviceRequestSchema.superRefine(
      async (data, ctx) => {
        for (const id of data.ids) {
          const exists = await this.repository.existsById(c, id)
          if (!exists) {
            ctx.addIssue({
              path: ["ids"],
              message: `Asset monitoring device with ID ${id} is not exist`,
              code: z.ZodIssueCode.custom,
            })
            continue
          }

          const isRelated = await this.repository.isDeviceRelated(c, id)
          if (isRelated) {
            ctx.addIssue({
              path: ["ids"],
              message: `Asset monitoring device with ID ${id} cannot be deleted because it is already related to an asset`,
              code: z.ZodIssueCode.custom,
            })
          }
        }
      }
    )
  }
}
