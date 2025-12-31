import { DEVICE_TYPE } from "@/common/constants/device.js"
import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@smile/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import {
  InvalidAsset,
  InvalidRTMD,
  InvalidSensor,
  RTMDEntityMismatch,
} from "./asset-inventory.error.js"
import { AssetInventoryRepository } from "./asset-inventory.repository.js"
import {
  AddAssetInventoryRequest,
  AddAssetInventoryRequestSchema,
  DeleteAssetInventoryParams,
  EditAssetInventoryRequest,
  EditAssetInventoryRequestSchema,
  EditStatusAssetInventoryRequestSchema,
  GetAssetInventoryQueryParams,
  GetAssetInventoryQueryParamsSchema,
  UpdateAssetInventoryParams,
} from "./asset-inventory.schema.js"

export class AssetInventoryMiddleware extends BaseMiddleware {
  constructor(private readonly repository: AssetInventoryRepository) {
    super()
  }

  readonly #getAssetInventory = async (c: Context) => {
    const id = c.req.param("id")
    const assetInventory = await this.repository.getOnlyAssetInventoryById(
      c,
      Number(id)
    )

    return assetInventory
  }

  readonly #requestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddAssetInventoryRequest | EditAssetInventoryRequest
  ) => {
    const { roleId, entityId } = c.var

    if (data.asset_electricity_id) {
      const assetElectricity = await this.repository.getAssetElectricityById(
        c,
        data.asset_electricity_id
      )

      if (!assetElectricity) {
        ctx.addIssue({
          path: ["asset_electricity_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.asset_electricity_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (!data.asset_model_id && !data.other_asset_model_name) {
      throw new ValidationError(
        c.var.t("validator.must_fill_one", {
          field1: c.var.t("asset_inventory.label.asset_model_id"),
          field2: c.var.t("asset_inventory.label.other_asset_model_name"),
        })
      )
    }

    if (data.asset_model_id && data.other_asset_model_name) {
      throw new ValidationError(
        c.var.t("validator.cannot_fill_all", {
          field1: c.var.t("asset_inventory.label.asset_model_id"),
          field2: c.var.t("asset_inventory.label.other_asset_model_name"),
        })
      )
    }

    if (data.asset_model_id) {
      const assetModel = await this.repository.getAssetModelById(
        c,
        data.asset_model_id
      )

      if (!assetModel) {
        ctx.addIssue({
          path: ["asset_model_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.asset_model_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (
      data.other_asset_model_name &&
      data.other_net_capacity &&
      !data.other_gross_capacity
    ) {
      ctx.addIssue({
        path: ["other_gross_capacity"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.other_gross_capacity"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.other_asset_model_name &&
      !data.other_net_capacity &&
      data.other_gross_capacity
    ) {
      ctx.addIssue({
        path: ["other_net_capacity"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.other_net_capacity"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.other_asset_model_name &&
      data.other_net_capacity &&
      data.other_gross_capacity &&
      data.other_net_capacity > data.other_gross_capacity
    ) {
      ctx.addIssue({
        path: ["other_net_capacity"],
        message: c.var.t("validator.not_greater_than", {
          field1: c.var.t("asset_inventory.label.other_net_capacity"),
          field2: c.var.t("asset_inventory.label.other_gross_capacity"),
        }),
        code: z.ZodIssueCode.custom,
      })

      ctx.addIssue({
        path: ["other_gross_capacity"],
        message: c.var.t("validator.not_less_than", {
          field1: c.var.t("asset_inventory.label.other_gross_capacity"),
          field2: c.var.t("asset_inventory.label.other_net_capacity"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.other_asset_model_name && data.other_net_capacity) {
      ctx.addIssue({
        path: ["other_net_capacity"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.other_net_capacity"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.other_asset_model_name && data.other_gross_capacity) {
      ctx.addIssue({
        path: ["other_gross_capacity"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.other_gross_capacity"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.asset_type_id && !data.other_asset_type_name) {
      throw new ValidationError(
        c.var.t("validator.must_fill_one", {
          field1: c.var.t("asset_inventory.label.asset_type_id"),
          field2: c.var.t("asset_inventory.label.other_asset_type_name"),
        })
      )
    }

    if (data.asset_type_id && data.other_asset_type_name) {
      throw new ValidationError(
        c.var.t("validator.cannot_fill_all", {
          field1: c.var.t("asset_inventory.label.asset_type_id"),
          field2: c.var.t("asset_inventory.label.other_asset_type_name"),
        })
      )
    }

    if (data.asset_type_id) {
      const assetType = await this.repository.getAssetTypeById(
        c,
        data.asset_type_id
      )

      if (!assetType) {
        ctx.addIssue({
          path: ["asset_type_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.asset_type_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (
      data.other_asset_type_name &&
      data.other_min_temperature &&
      !data.other_max_temperature
    ) {
      ctx.addIssue({
        path: ["other_max_temperature"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.other_max_temperature"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.other_asset_type_name &&
      !data.other_min_temperature &&
      data.other_max_temperature
    ) {
      ctx.addIssue({
        path: ["other_min_temperature"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.other_min_temperature"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.other_asset_type_name &&
      data.other_min_temperature &&
      data.other_max_temperature &&
      data.other_min_temperature > data.other_max_temperature
    ) {
      ctx.addIssue({
        path: ["other_min_temperature"],
        message: c.var.t("validator.not_greater_than", {
          field1: c.var.t("asset_inventory.label.other_min_temperature"),
          field2: c.var.t("asset_inventory.label.other_max_temperature"),
        }),
        code: z.ZodIssueCode.custom,
      })

      ctx.addIssue({
        path: ["other_max_temperature"],
        message: c.var.t("validator.not_less_than", {
          field1: c.var.t("asset_inventory.label.other_max_temperature"),
          field2: c.var.t("asset_inventory.label.other_min_temperature"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.other_asset_type_name && data.other_min_temperature) {
      ctx.addIssue({
        path: ["other_min_temperature"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.other_min_temperature"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.other_asset_type_name && data.other_max_temperature) {
      ctx.addIssue({
        path: ["other_max_temperature"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.other_max_temperature"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.manufacture_id && !data.other_manufacture_name) {
      throw new ValidationError(
        c.var.t("validator.must_fill_one", {
          field1: c.var.t("asset_inventory.label.manufacture_id"),
          field2: c.var.t("asset_inventory.label.other_manufacture_name"),
        })
      )
    }

    if (data.manufacture_id && data.other_manufacture_name) {
      throw new ValidationError(
        c.var.t("validator.cannot_fill_all", {
          field1: c.var.t("asset_inventory.label.manufacture_id"),
          field2: c.var.t("asset_inventory.label.other_manufacture_name"),
        })
      )
    }

    if (data.manufacture_id) {
      const manufacture = await this.repository.getManufactureById(
        c,
        data.manufacture_id
      )

      if (!manufacture) {
        ctx.addIssue({
          path: ["manufacture_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.manufacture_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (!data.budget_source_id && !data.other_budget_source_name) {
      throw new ValidationError(
        c.var.t("validator.must_fill_one", {
          field1: c.var.t("asset_inventory.label.budget_source_id"),
          field2: c.var.t("asset_inventory.label.other_budget_source_name"),
        })
      )
    }

    if (data.budget_source_id && data.other_budget_source_name) {
      throw new ValidationError(
        c.var.t("validator.cannot_fill_all", {
          field1: c.var.t("asset_inventory.label.budget_source_id"),
          field2: c.var.t("asset_inventory.label.other_budget_source_name"),
        })
      )
    }

    if (data.budget_source_id) {
      const budgetSource = await this.repository.getBudgetSourceById(
        c,
        data.budget_source_id
      )

      if (!budgetSource) {
        ctx.addIssue({
          path: ["budget_source_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.budget_source_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.asset_working_status_id) {
      const assetWorkingStatus =
        await this.repository.getAssetWorkingStatusById(
          c,
          data.asset_working_status_id
        )

      if (!assetWorkingStatus) {
        ctx.addIssue({
          path: ["asset_working_status_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.asset_working_status_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.calibration_asset_vendor_id) {
      const calibrationVendor =
        await this.repository.getAssetVendorByCalibrationVendorId(
          c,
          data.calibration_asset_vendor_id
        )

      if (!calibrationVendor) {
        ctx.addIssue({
          path: ["calibration_asset_vendor_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.calibration_asset_vendor_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (
      data.calibration_asset_vendor_id &&
      data.calibration_last_date &&
      !data.calibration_schedule_id
    ) {
      ctx.addIssue({
        path: ["calibration_schedule_id"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.calibration_schedule_id"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.calibration_asset_vendor_id &&
      !data.calibration_last_date &&
      data.calibration_schedule_id
    ) {
      ctx.addIssue({
        path: ["calibration_last_date"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.calibration_last_date"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.calibration_asset_vendor_id &&
      data.calibration_last_date &&
      data.calibration_schedule_id
    ) {
      const calibrationSchedule =
        await this.repository.getAssetCalibrationScheduleById(
          c,
          data.calibration_schedule_id
        )

      if (!calibrationSchedule) {
        ctx.addIssue({
          path: ["calibration_schedule_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.calibration_schedule_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (!data.calibration_asset_vendor_id && data.calibration_last_date) {
      ctx.addIssue({
        path: ["calibration_last_date"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.calibration_last_date"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.calibration_asset_vendor_id && data.calibration_schedule_id) {
      ctx.addIssue({
        path: ["calibration_schedule_id"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.calibration_schedule_id"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.maintenance_asset_vendor_id) {
      const maintenanceVendor =
        await this.repository.getAssetVendorByMaintenanceVendorId(
          c,
          data.maintenance_asset_vendor_id
        )

      if (!maintenanceVendor) {
        ctx.addIssue({
          path: ["maintenance_asset_vendor_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.maintenance_asset_vendor_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (
      data.maintenance_asset_vendor_id &&
      data.maintenance_last_date &&
      !data.maintenance_schedule_id
    ) {
      ctx.addIssue({
        path: ["maintenance_schedule_id"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.maintenance_schedule_id"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.maintenance_asset_vendor_id &&
      !data.maintenance_last_date &&
      data.maintenance_schedule_id
    ) {
      ctx.addIssue({
        path: ["maintenance_last_date"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.maintenance_last_date"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.maintenance_asset_vendor_id &&
      data.maintenance_last_date &&
      data.maintenance_schedule_id
    ) {
      const maintenanceSchedule =
        await this.repository.getAssetMaintenanceScheduleById(
          c,
          data.maintenance_schedule_id
        )

      if (!maintenanceSchedule) {
        ctx.addIssue({
          path: ["maintenance_schedule_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.maintenance_schedule_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (!data.maintenance_asset_vendor_id && data.maintenance_last_date) {
      ctx.addIssue({
        path: ["maintenance_last_date"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.maintenance_last_date"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.maintenance_asset_vendor_id && data.maintenance_schedule_id) {
      ctx.addIssue({
        path: ["maintenance_schedule_id"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.maintenance_schedule_id"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.borrowed_from_entity_id && data.other_borrowed_from_entity_name) {
      throw new ValidationError(
        c.var.t("validator.cannot_fill_all", {
          field1: c.var.t("asset_inventory.label.borrowed_from_entity_id"),
          field2: c.var.t(
            "asset_inventory.label.other_borrowed_from_entity_name"
          ),
        })
      )
    }

    if (
      data.ownership_status === 1 &&
      data.borrowed_from_entity_id &&
      !data.other_borrowed_from_entity_name
    ) {
      ctx.addIssue({
        path: ["borrowed_from_entity_id"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.borrowed_from_entity_id"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.ownership_status === 1 &&
      !data.borrowed_from_entity_id &&
      data.other_borrowed_from_entity_name
    ) {
      ctx.addIssue({
        path: ["other_borrowed_from_entity_name"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t(
            "asset_inventory.label.other_borrowed_from_entity_name"
          ),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.ownership_status === 2 &&
      !data.borrowed_from_entity_id &&
      !data.other_borrowed_from_entity_name
    ) {
      throw new ValidationError(
        c.var.t("validator.must_fill_one", {
          field1: c.var.t("asset_inventory.label.borrowed_from_entity_id"),
          field2: c.var.t(
            "asset_inventory.label.other_borrowed_from_entity_name"
          ),
        })
      )
    }

    if (data.serial_number) {
      const id = c.req.param("id")
      const serialNumber =
        await this.repository.getOnlyAssetInventoryBySerialNumber(
          c,
          data.serial_number
        )

      if (
        (id && serialNumber && serialNumber.id !== Number(id)) ||
        (!id && serialNumber)
      ) {
        ctx.addIssue({
          path: ["serial_number"],
          message: c.var.t("validator.exist", {
            field: c.var.t("asset_inventory.label.serial_number"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.warranty_asset_vendor_id) {
      const warrantyVendor =
        await this.repository.getAssetVendorByWarrantyVendorId(
          c,
          data.warranty_asset_vendor_id
        )

      if (!warrantyVendor) {
        ctx.addIssue({
          path: ["warranty_asset_vendor_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("asset_inventory.label.warranty_asset_vendor_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (
      data.warranty_asset_vendor_id &&
      data.warranty_start_date &&
      !data.warranty_end_date
    ) {
      ctx.addIssue({
        path: ["warranty_end_date"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.warranty_end_date"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.warranty_asset_vendor_id &&
      !data.warranty_start_date &&
      data.warranty_end_date
    ) {
      ctx.addIssue({
        path: ["warranty_start_date"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("asset_inventory.label.warranty_start_date"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      data.warranty_asset_vendor_id &&
      data.warranty_start_date &&
      data.warranty_end_date &&
      data.warranty_start_date > data.warranty_end_date
    ) {
      ctx.addIssue({
        path: ["warranty_start_date"],
        message: c.var.t("validator.not_greater_than", {
          field1: c.var.t("asset_inventory.label.warranty_start_date"),
          field2: c.var.t("asset_inventory.label.warranty_end_date"),
        }),
        code: z.ZodIssueCode.custom,
      })

      ctx.addIssue({
        path: ["warranty_end_date"],
        message: c.var.t("validator.not_less_than", {
          field1: c.var.t("asset_inventory.label.warranty_end_date"),
          field2: c.var.t("asset_inventory.label.warranty_start_date"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.warranty_asset_vendor_id && data.warranty_start_date) {
      ctx.addIssue({
        path: ["warranty_start_date"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.warranty_start_date"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.warranty_asset_vendor_id && data.warranty_end_date) {
      ctx.addIssue({
        path: ["warranty_end_date"],
        message: c.var.t("validator.not_allowed", {
          field: c.var.t("asset_inventory.label.warranty_end_date"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.borrowed_from_entity_id) {
      const entity = await this.repository.getEntityById(c, Number(entityId))

      if (roleId && roleId === USER_ROLE.MANAGER) {
        if (
          entity?.type === ENTITY_TYPE.PROVINCE &&
          entity.province_id &&
          !entity.regency_id &&
          !entity.sub_district_id
        ) {
          const permittedProvinces =
            await this.repository.getPermittedProvinces(c)

          const provinceIds = permittedProvinces.map((item) => item.id)

          const permittedEntitiesByProvinces =
            await this.repository.getPermittedLendingEntitiesByProvinces(
              c,
              provinceIds
            )

          const entitiesByProvincesIds = permittedEntitiesByProvinces.map(
            (item) => item.id
          )

          if (!entitiesByProvincesIds.includes(data.borrowed_from_entity_id)) {
            ctx.addIssue({
              path: ["borrowed_from_entity_id"],
              message: c.var.t("validator.not_allowed", {
                field: c.var.t("asset_inventory.label.borrowed_from_entity_id"),
              }),
              code: z.ZodIssueCode.custom,
            })
          }
        }

        if (
          entity?.type === ENTITY_TYPE.KOTA &&
          entity.province_id &&
          entity.regency_id &&
          !entity.sub_district_id
        ) {
          const permittedRegencies =
            await this.repository.getPermittedRegencies(
              c,
              Number(entity.province_id)
            )

          const regencyIds = permittedRegencies.map((item) => item.id)

          const permittedEntitiesByRegencies =
            await this.repository.getPermittedLendingEntitiesByRegencies(
              c,
              entity.province_id,
              regencyIds
            )

          const entitiesByRegenciesIds = permittedEntitiesByRegencies.map(
            (item) => item.id
          )

          if (!entitiesByRegenciesIds.includes(data.borrowed_from_entity_id)) {
            ctx.addIssue({
              path: ["borrowed_from_entity_id"],
              message: c.var.t("validator.not_allowed", {
                field: c.var.t("asset_inventory.label.borrowed_from_entity_id"),
              }),
              code: z.ZodIssueCode.custom,
            })
          }
        }
      }

      if (roleId && roleId === USER_ROLE.OPERATOR) {
        if (
          entity?.type === ENTITY_TYPE.FASKES &&
          entity.province_id &&
          entity.regency_id &&
          entity.sub_district_id
        ) {
          const permittedSubDistricts =
            await this.repository.getPermittedSubDistricts(
              c,
              Number(entity.province_id)
            )

          const subDistrictIds = permittedSubDistricts.map((item) => item.id)

          const permittedEntitiesBySubDistricts =
            await this.repository.getPermittedLendingEntitiesBySubDistricts(
              c,
              entity.province_id,
              entity.regency_id,
              subDistrictIds
            )

          const entitiesBySubDistrictsIds = permittedEntitiesBySubDistricts.map(
            (item) => item.id
          )

          if (
            !entitiesBySubDistrictsIds.includes(data.borrowed_from_entity_id)
          ) {
            ctx.addIssue({
              path: ["borrowed_from_entity_id"],
              message: c.var.t("validator.not_allowed", {
                field: c.var.t("asset_inventory.label.borrowed_from_entity_id"),
              }),
              code: z.ZodIssueCode.custom,
            })
          }

          // if one field is other, then the rest must be other too
          const otherFields = [
            "other_asset_model_name",
            "other_asset_type_name",
            "other_manufacture_name",
          ]
          if (
            data.other_asset_model_name ||
            data.other_asset_type_name ||
            data.other_manufacture_name
          ) {
            for (const field of otherFields) {
              if (!data[field]) {
                const fieldName = field.replace("other_", "")
                const fieldId = fieldName.replace("_name", "_id")

                ctx.addIssue({
                  path: [fieldId],
                  message: c.var.t("validator.must_be_other", {
                    field: c.var.t(`asset_inventory.label.${fieldName}`),
                  }),
                  code: z.ZodIssueCode.custom,
                })
              }
            }
          }
        }
      }
    }

    if (data.entity_id) {
      if (
        ((roleId && roleId === USER_ROLE.MANAGER) ||
          (roleId && roleId === USER_ROLE.OPERATOR)) &&
        entityId !== data.entity_id
      ) {
        ctx.addIssue({
          path: ["entity_id"],
          message: c.var.t("validator.not_allowed", {
            field: c.var.t("asset_inventory.label.entity_id"),
          }),
          code: z.ZodIssueCode.custom,
        })
      }
    }

    if (data.production_year > data.budget_year) {
      ctx.addIssue({
        path: ["budget_year"],
        message: c.var.t("validator.greater_or_equal", {
          field1: c.var.t("asset_inventory.label.budget_year"),
          field2: c.var.t("asset_inventory.label.production_year"),
        }),
        code: z.ZodIssueCode.custom,
      })

      ctx.addIssue({
        path: ["production_year"],
        message: c.var.t("validator.lesser_or_equal", {
          field1: c.var.t("asset_inventory.label.production_year"),
          field2: c.var.t("asset_inventory.label.budget_year"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    // if one field is other, then the rest must be other too
    const otherFields = [
      "other_asset_model_name",
      "other_asset_type_name",
      "other_manufacture_name",
    ]
    if (
      data.other_asset_model_name ||
      data.other_asset_type_name ||
      data.other_manufacture_name
    ) {
      for (const field of otherFields) {
        if (!data[field]) {
          const fieldName = field.replace("other_", "")
          const fieldId = fieldName.replace("_name", "_id")

          ctx.addIssue({
            path: [fieldId],
            message: c.var.t("validator.must_be_other", {
              field: c.var.t(`asset_inventory.label.${fieldName}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }
  }

  readonly #pathParamValidation = async (c: Context) => {
    const assetInventory = await this.#getAssetInventory(c)

    if (!assetInventory) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("asset_inventory.label.id"),
        })
      )
    }

    const entityId = await this.#getEntityByRole(c)

    if (
      typeof entityId === "object" &&
      entityId.length > 0 &&
      !entityId.includes(Number(assetInventory.entity_id))
    ) {
      throw new ForbiddenError()
    }

    if (typeof entityId === "number" && entityId !== assetInventory.entity_id) {
      throw new ForbiddenError()
    }
  }

  readonly #queryParamValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetAssetInventoryQueryParams
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

  readonly #getEntityByRole = async (c: Context) => {
    const { deviceType, role: roleId } = c.var
    const userEntity = await this.repository.getEntityById(c, c.var.entityId!)

    let entityId: number | number[]

    if (
      roleId === USER_ROLE.MANAGER &&
      deviceType === DEVICE_TYPE.web &&
      userEntity.type === 1 &&
      userEntity.province_id
    ) {
      const entities = await this.repository.getEntityByProvince(
        c,
        userEntity.province_id
      )

      entityId = entities.map((item) => item.id)
    }

    if (
      roleId === USER_ROLE.MANAGER &&
      deviceType === DEVICE_TYPE.web &&
      userEntity.type === 2 &&
      userEntity.regency_id
    ) {
      const entities = await this.repository.getEntityByRegency(
        c,
        userEntity.regency_id
      )

      entityId = entities.map((item) => item.id)
    }

    if (deviceType === DEVICE_TYPE.mobile) {
      entityId = userEntity.id
    }

    return entityId
  }

  readonly checkIfAssetRelatedToDevice = async (
    c: Context,
    req: DeleteAssetInventoryParams
  ) => {
    // Check if asset is related to any RTMD (device)
    const relatedRtmds = await this.repository.getAssetInventoryRtmds(c, req.id)

    if (relatedRtmds.length > 0) {
      throw new ValidationError(
        c.var.t("validator.asset_related_to_device", {
          field: c.var.t("asset_inventory.label.asset_inventory"),
        })
      )
    }

    return req
  }

  readonly checkAssetAndDeviceData = async (
    c: Context,
    param: UpdateAssetInventoryParams
  ) => {
    const req = (await c.req.json()) as Array<{
      id: number
      sensor_qty: number
      description: string
    }>

    const [assetEntityId, deviceEntityIds] =
      await this.repository.getAssetAndRtmdEntityIds(
        c,
        param.id,
        req.map((item) => item.id)
      )

    if (!assetEntityId) {
      throw new InvalidAsset()
    }

    if (!deviceEntityIds || deviceEntityIds.length !== req.length) {
      throw new InvalidRTMD()
    }

    if (
      req.some(
        (item) =>
          !item.description &&
          (isNaN(item.sensor_qty) ||
            item.sensor_qty <= 0 ||
            item.sensor_qty > 10)
      )
    ) {
      throw new InvalidSensor()
    }

    // Check if asset and device share the same entity, throw error if not the same
    if (deviceEntityIds.some((id) => id !== assetEntityId)) {
      throw new RTMDEntityMismatch()
    }

    return param
  }

  create = (c: Context) => {
    return AddAssetInventoryRequestSchema.superRefine(async (data, ctx) => {
      await this.#requestValidation(c, ctx, data)
    })
  }

  update = (c: Context) => {
    return EditAssetInventoryRequestSchema.superRefine(async (data, ctx) => {
      await this.#pathParamValidation(c)
      await this.#requestValidation(c, ctx, data)
    })
  }

  list = (c: Context) => {
    return GetAssetInventoryQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  updateStatus = (c: Context) => {
    return EditStatusAssetInventoryRequestSchema.superRefine(
      async (data, ctx) => {
        await this.#pathParamValidation(c)
      }
    )
  }

  export = (c: Context) => {
    return GetAssetInventoryQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#queryParamValidation(c, ctx, data)
    })
  }

  detail = createMiddleware(async (c, next) => {
    await this.#pathParamValidation(c)
    await next()
  })
}
