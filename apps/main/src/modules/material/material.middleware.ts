import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { WsMaterials } from "@/common/infrastructure/database/types/db.js"
import {
  BaseMiddleware,
  DBValidationError,
} from "@smile/lib/base/middleware.js"
import { NotFoundError } from "@smile/lib/error.js"
import { Context } from "hono"
import { ActivityRepository } from "../activity/activity.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import {
  MaterialLevel2TemplateV2,
  MaterialLevel3TemplateV2,
} from "./material.excel.js"
import { MaterialRepository } from "./material.repository.js"
import {
  ImportMaterialRequestSchema,
  UpdateMaterialRequestSchema,
} from "./material.schema.js"

export class MaterialMiddleware extends BaseMiddleware {
  constructor(
    private readonly materialRepo: MaterialRepository,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly activityRepo: ActivityRepository
  ) {
    super()
  }

  importMaterialTemplate = (c: Context) => {
    return Number(c.req.query("material_level_id")) === KFA_LEVEL_ID.TEMPLATE
      ? new MaterialLevel2TemplateV2()
      : new MaterialLevel3TemplateV2()
  }

  updateMaterialSchema = (c: Context) => {
    const schema = this.applyDBValidation(c, UpdateMaterialRequestSchema, [
      { type: "not_exist", key: "manufactures", repo: this.manufactureRepo },
      { type: "not_exist", key: "material_companion", repo: this.materialRepo },
      { type: "not_exist", key: "activities", repo: this.activityRepo },
    ])

    return schema.superRefine(async (data, ctx) => {
      const material = await this.materialRepo.findOne(c, {
        id: Number(c.req.param("id")),
      })

      if (!material) {
        throw new NotFoundError("material not found")
      }

      // we put the validation here because the validation dependent on the material level which need to be fetched
      if (
        material.material_level_id === KFA_LEVEL_ID.TEMPLATE ||
        !data.is_addremove
      ) {
        return
      }

      if (!data.addremove) {
        ctx.addIssue({
          code: "custom",
          message: `validator.not_empty`,
          path: ["addremove"],
        })
      }

      if (data.addremove.roles.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `validator.not_empty`,
          path: ["roles"],
        })
      }

      if (data.addremove.entity_types.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `validator.not_empty`,
          path: ["entity_types"],
        })
      }
    })
  }

  validateMaterialLevels = async (
    c: Context,
    data: object[],
    errors: DBValidationError[]
  ) => {
    const materials = data as WsMaterials[]
    const levelId = Number(
      c.req.query("material_level_id") ?? KFA_LEVEL_ID.VARIANT
    )

    const invalidMaterialIds = materials
      .filter((material) => material.material_level_id !== levelId)
      .map((material) => material.id)

    if (invalidMaterialIds.length > 0) {
      errors.push({
        items: invalidMaterialIds,
        message: "validator.invalid_levels",
      })
    }

    return errors
  }

  importMaterialSchema = async (c: Context) => {
    return this.applyExcelDBValidation(c, ImportMaterialRequestSchema, [
      { type: "duplicated", key: "id", repo: this.materialRepo },
      { type: "not_exist", key: "manufactures", repo: this.manufactureRepo },
      { type: "not_exist", key: "activities", repo: this.activityRepo },
      {
        type: "not_exist",
        key: "id",
        repo: this.materialRepo,
        callback: this.validateMaterialLevels,
      },
      {
        type: "not_exist",
        key: "material_companion",
        repo: this.materialRepo,
        callback: this.validateMaterialLevels,
      },
    ])
  }
}
