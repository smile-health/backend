import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { MasterMaterials } from "@/common/infrastructure/database/types/db.js"
import {
  BaseMiddleware,
  DBValidationError,
} from "@smile/lib/base/middleware.js"
import { NotFoundError } from "@smile/lib/error.js"
import { MAP_ENTITY_TYPE_LABEL } from "@smile/lib/types/entity.js"
import { merge } from "@smile/lib/utils.js"
import { Context } from "hono"
import { ActivityRepository } from "../activity/activity.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import {
  MaterialLevel2TemplateV2,
  MaterialLevel3TemplateV2,
} from "./material.excel.js"
import { MaterialRepository } from "./material.repository.js"
import {
  COL,
  ImportMaterialRequestSchema,
  ImportMaterialRow,
  UpdateMaterialRequest,
  UpdateMaterialRequestSchema,
} from "./material.schema.js"

export class MaterialMiddleware extends BaseMiddleware {
  constructor(
    private materialRepo: MaterialRepository,
    private manufactureRepo: ManufactureRepository,
    private activityRepo: ActivityRepository
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
    ])

    return schema.superRefine(async (data, ctx) => {
      const material = await this.materialRepo.findOne(c, {
        id: Number(c.req.param("id")),
      })
      if (!material) {
        throw new NotFoundError("material not found")
      }

      if (
        material.kfa_level_id === KFA_LEVEL_ID.TEMPLATE ||
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

  validateMaterialLevels = async (c: Context, data: object[]) => {
    const errors: DBValidationError[] = []
    const materials = data as MasterMaterials[]
    const levelId = Number(
      c.req.query("material_level_id") ?? KFA_LEVEL_ID.VARIANT
    )

    const invalidMaterialIds = materials
      .filter((material) => material.kfa_level_id !== levelId)
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
      { type: "duplicated", key: COL.Id, repo: this.materialRepo },
      { type: "not_exist", key: COL.Manufacture, repo: this.manufactureRepo },
      { type: "not_exist", key: COL.Activity, repo: this.activityRepo },
      { type: "not_exist", key: COL.SeqActivity, repo: this.activityRepo },
      {
        type: "not_exist",
        key: COL.Id,
        repo: this.materialRepo,
        callback: this.validateMaterialLevels,
      },
      {
        type: "not_exist",
        key: COL.Companion,
        repo: this.materialRepo,
        callback: this.validateMaterialLevels,
      },
      {
        type: "not_exist",
        key: COL.Roles,
        repo: {
          find: function (c: Context, where: object) {
            return Object.values(USER_ROLE)
              .filter((role) => where["id"].includes(role))
              .map((role) => ({ id: role }))
          },
        },
      },
      {
        type: "not_exist",
        key: COL.EntityType,
        repo: {
          find: function (c: Context, where: object) {
            return Object.keys(MAP_ENTITY_TYPE_LABEL)
              .map(Number)
              .filter((entityType) => where["id"].includes(entityType))
              .map((entityType) => ({ id: entityType }))
          },
        },
      },
    ]).transform((rows) => rows.map(this.transformRowSchema))
  }

  transformRowSchema = (row: ImportMaterialRow) =>
    ({
      id: row[COL.Id],
      manufactures: row[COL.Manufacture],
      material_companion: row[COL.Companion],
      activities: merge(
        (row[COL.Activity] as number[]) ?? [],
        (row[COL.SeqActivity] as number[]) ?? []
      ).map((el) => ({
        id: el,
        is_sequence: ((row[COL.SeqActivity] as number[]) ?? [0]).includes(el)
          ? 1
          : 0,
      })),
      is_addremove: row[COL.Roles] && row[COL.EntityType] ? 1 : 0,
      addremove: {
        roles: row[COL.Roles],
        entity_types: row[COL.EntityType],
      },
    }) as UpdateMaterialRequest
}
