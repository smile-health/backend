import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { NotFoundError, ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { AssetMonitoringTemperatureRepository } from "./asset-monitoring-temperature.repository.js"
import {
  GetAssetMonitoringTemperatureQuerySchema,
  GetTemperatureHistoryQueries,
  GetTemperatureHistoryQueriesSchema,
  PushTemperatureHistoryDTOSchema,
  PushWarehouseTemperatureHistoryDTOSchema,
  UpdateOperationalStatusRequestDTO,
  UpdateOperationalStatusRequestSchema,
  UpdateTemperatureRangeRequestSchema,
} from "./asset-monitoring-temperature.schema.js"

export class AssetMonitoringTemperatureMiddleware extends BaseMiddleware {
  constructor(
    private readonly repository: AssetMonitoringTemperatureRepository
  ) {
    super()
  }

  readonly #temperatureHistoryValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: z.infer<typeof PushTemperatureHistoryDTOSchema>
  ) => {
    // Validate each item in the array
    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      const prefix = i.toString()

      // Validate device_id is required and not empty
      if (!item.device_id || item.device_id.trim() === "") {
        ctx.addIssue({
          path: [prefix, "device_id"],
          message: c.var.t("validator.required", {
            field: c.var.t("asset_monitoring_temperature.label.device_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      // Validate curr_temp is required and valid number
      if (
        item.curr_temp === undefined ||
        item.curr_temp === null ||
        isNaN(item.curr_temp)
      ) {
        ctx.addIssue({
          path: [prefix, "curr_temp"],
          message: c.var.t("validator.required", {
            field: c.var.t("asset_monitoring_temperature.label.curr_temp"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      // Validate actual_date format if provided
      if (item.actual_date) {
        const actualTime = new Date(item.actual_date)
        if (isNaN(actualTime.getTime())) {
          ctx.addIssue({
            path: [prefix, "actual_date"],
            message: c.var.t("validator.invalid_date_format", {
              field: c.var.t("asset_monitoring_temperature.label.actual_date"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }

      // Battery and signal validation removed - these fields are now optional without range validation

      // Validate device exists if device_id is provided
      if (item.device_id && item.device_id.trim() !== "") {
        // Check if device exists in asset_rtmds table by serial_number
        const rtmdDevice = await c.var.trx
          .selectFrom("asset_rtmds")
          .select(["id", "serial_number"])
          .where("serial_number", "=", item.device_id.trim())
          .where("deleted_at", "is", null)
          .executeTakeFirst()

        if (!rtmdDevice) {
          ctx.addIssue({
            path: [prefix, "device_id"],
            message: `Device with ID '${item.device_id}' not found. Please ensure the device is registered in the system.`,
            code: z.ZodIssueCode.custom,
          })
          return // Exit early for this item
        }

        // Check if device is connected to an asset inventory
        const connectionExists = await c.var.trx
          .selectFrom("asset_inventory_rtmds")
          .select("asset_inventory_id")
          .where("asset_rtmd_id", "=", rtmdDevice.id)
          .where("deleted_at", "is", null)
          .executeTakeFirst()

        if (!connectionExists) {
          ctx.addIssue({
            path: [prefix, "device_id"],
            message: `Device '${item.device_id}' is not connected to any asset inventory. Please connect the device to an asset first.`,
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }
  }

  pushTemperatureHistory = (c: Context) => {
    return PushTemperatureHistoryDTOSchema.superRefine(async (data, ctx) => {
      await this.#temperatureHistoryValidation(c, ctx, data)
    })
  }

  pushWarehouseTemperatureHistory = (c: Context) => {
    return PushWarehouseTemperatureHistoryDTOSchema.superRefine(
      async (data, ctx) => {
        await this.#temperatureHistoryValidation(c, ctx, data)
      }
    )
  }

  readonly #temperatureCapacityValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: {
      asset_model_temperature_capacity_id?: number
      from_date?: string
      to_date?: string
      page?: number
      paginate?: number
    }
  ) => {
    if (data.asset_model_temperature_capacity_id) {
      const capacity =
        await this.repository.getAssetModelTemperatureCapacityById(
          c,
          data.asset_model_temperature_capacity_id
        )

      if (!capacity) {
        ctx.addIssue({
          path: ["temperature_threshold_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t(
              "asset_monitoring_temperature.label.temperature_capacity"
            ),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.from_date || data.to_date) {
      const fromDate = data.from_date ? new Date(data.from_date) : null
      const toDate = data.to_date ? new Date(data.to_date) : null

      if (fromDate && toDate && fromDate > toDate) {
        ctx.addIssue({
          path: ["from_date"],
          message: c.var.t("validator.date_range_invalid", {
            field: c.var.t("asset_monitoring_temperature.label.date_range"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }

      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      if (fromDate && fromDate < oneYearAgo) {
        ctx.addIssue({
          path: ["from_date"],
          message: c.var.t("validator.date_too_old", {
            field: c.var.t("asset_monitoring_temperature.label.from_date"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.page && data.page < 1) {
      ctx.addIssue({
        path: ["page"],
        message: c.var.t("validator.invalid_page"),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.paginate && (data.paginate < 1 || data.paginate > 100)) {
      ctx.addIssue({
        path: ["paginate"],
        message: c.var.t("validator.invalid_paginate"),
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #pathParamValidation = async (c: Context) => {
    const id = Number(c.req.param("id"))

    if (isNaN(id) || id <= 0) {
      throw new ValidationError(
        c.var.t("validator.invalid_id", {
          field: c.var.t("asset_monitoring_temperature.label.id"),
        })
      )
    }

    const asset = await this.repository.findAssetByAssetId(c, id)
    if (!asset) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("asset_monitoring_temperature.label.asset"),
        })
      )
    }
  }

  readonly #queryParamValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: {
      sort_by?: string
      sort_type?: string
    }
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
    return GetAssetMonitoringTemperatureQuerySchema.superRefine(
      async (
        data: {
          keyword?: string
          province_id?: string
          regency_id?: string
          health_center_id?: number
          working_status_id?: number
          is_device_related?: number
          asset_type_ids?: number[]
          manufacture_ids?: number[]
          entity_tag_ids?: number[]
          asset_model_ids?: number[]
          sort_by?: string
          sort_type?: string
          page?: number
          paginate?: number
        },
        ctx: z.RefinementCtx
      ) => {
        await this.#temperatureCapacityValidation(c, ctx, data)
        await this.#queryParamValidation(c, ctx, data)
      }
    )
  }

  historyList = (c: Context) => {
    return GetTemperatureHistoryQueriesSchema.superRefine(
      async (
        data: {
          device_id?: string
          asset_id?: string
          from_date?: string
          to_date?: string
          page?: number
          paginate?: number
          sort_by?: string
          sort_type?: string
        },
        ctx: z.RefinementCtx
      ) => {
        await this.#temperatureCapacityValidation(c, ctx, data)
        await this.#queryParamValidation(c, ctx, data)
      }
    )
  }

  historyByRtmdIdList = (c: Context) => {
    return GetTemperatureHistoryQueriesSchema.superRefine(
      async (
        data: {
          device_id?: string
          asset_id?: string
          from_date?: string
          to_date?: string
          page?: number
          paginate?: number
          sort_by?: string
          sort_type?: string
        },
        ctx: z.RefinementCtx
      ) => {
        // Validate RTMD ID parameter from path
        const rtmdId = c.req.param("id")
        if (!rtmdId || isNaN(Number(rtmdId)) || Number(rtmdId) <= 0) {
          throw new ValidationError(
            c.var.t("validator.invalid_id", {
              field: c.var.t("asset_monitoring_temperature.label.rtmd_id"),
            })
          )
        }

        // Check if RTMD device exists
        const rtmdDevice = await c.var.trx
          .selectFrom("asset_rtmds")
          .select("id")
          .where("id", "=", Number(rtmdId))
          .where("deleted_at", "is", null)
          .executeTakeFirst()

        if (!rtmdDevice) {
          throw new NotFoundError(
            c.var.t("validator.not_exist", {
              field: c.var.t("asset_monitoring_temperature.label.rtmd_device"),
            })
          )
        }

        await this.#temperatureCapacityValidation(c, ctx, data)
        await this.#queryParamValidation(c, ctx, data)
      }
    )
  }

  readonly #operationalStatusValidation = async (
    c: Context,
    data: UpdateOperationalStatusRequestDTO
  ) => {
    const id = Number(data.working_status_id)

    const status = await this.repository.findOperationalStatusId(c, id)
    if (!status) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t(
            "asset_monitoring_temperature.label.operational_status"
          ),
        })
      )
    }
  }

  update = (c: Context) => {
    return UpdateTemperatureRangeRequestSchema.superRefine(
      async (
        data: {
          temperature_threshold_id: number
        },
        ctx: z.RefinementCtx
      ) => {
        await this.#pathParamValidation(c)

        if (
          !data.temperature_threshold_id ||
          data.temperature_threshold_id <= 0
        ) {
          ctx.addIssue({
            path: ["temperature_threshold_id"],
            message: c.var.t("validator.required", {
              field: c.var.t(
                "asset_monitoring_temperature.label.temperature_threshold"
              ),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        const capacity =
          await this.repository.getAssetModelTemperatureCapacityById(
            c,
            data.temperature_threshold_id
          )

        if (!capacity) {
          ctx.addIssue({
            path: ["temperature_threshold_id"],
            message: c.var.t("validator.not_exist", {
              field: c.var.t(
                "asset_monitoring_temperature.label.temperature_threshold"
              ),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }
    )
  }

  export = (c: Context) => {
    return GetTemperatureHistoryQueriesSchema.superRefine(
      async (data: GetTemperatureHistoryQueries, ctx: z.RefinementCtx) => {
        if (data.from_date || data.to_date) {
          const fromDate = data.from_date ? new Date(data.from_date) : null
          const toDate = data.to_date ? new Date(data.to_date) : null

          if (fromDate && toDate && fromDate > toDate) {
            ctx.addIssue({
              path: ["from_date"],
              message: c.var.t("validator.date_range_invalid", {
                field: c.var.t("asset_monitoring_temperature.label.date_range"),
              }),
              code: z.ZodIssueCode.custom,
            })
          }

          const oneYearAgo = new Date()
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

          if (fromDate && fromDate < oneYearAgo) {
            ctx.addIssue({
              path: ["from_date"],
              message: c.var.t("validator.date_too_old", {
                field: c.var.t("asset_monitoring_temperature.label.from_date"),
              }),
              code: z.ZodIssueCode.custom,
            })
          }
        }

        if (data.page && (data.page < 1 || data.page > 1000)) {
          ctx.addIssue({
            path: ["page"],
            message: c.var.t("validator.invalid_page"),
            code: z.ZodIssueCode.custom,
          })
        }

        if (data.paginate && (data.paginate < 1 || data.paginate > 100)) {
          ctx.addIssue({
            path: ["paginate"],
            message: c.var.t("validator.invalid_paginate"),
            code: z.ZodIssueCode.custom,
          })
        }
      }
    )
  }

  detail = createMiddleware(async (c, next) => {
    await this.#pathParamValidation(c)
    await next()
  })

  updateOperationalStatus = (c: Context) => {
    return UpdateOperationalStatusRequestSchema.superRefine(async (data) => {
      await this.#pathParamValidation(c)
      await this.#operationalStatusValidation(c, data)
    })
  }
}
