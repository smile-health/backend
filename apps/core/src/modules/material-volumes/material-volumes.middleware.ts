import { Context } from "hono"
import { z, ZodSchema } from "zod"
import { MaterialRepository } from "../material/material.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import {
  CreateMaterialVolumeRequestSchema,
  MaterialSchema,
  CreateMaterialVolumeRequest,
  UpdateMaterialVolumeRequestSchema,
  MaterialVolumeSchema,
} from "./material-volumes.schema.js"
import { MATERIAL_LEVEL } from "@/common/constants/material.js"
import { MaterialVolumesRepository } from "./material-volumes.repository.js"
import { NotFoundError } from "@smile-health/lib/error.js"
import { getTranslateMaterialVolumeColumnsExcel } from "@/common/constants/material.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { MaterialVolumeTemplate } from "./material-volume.excel.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import { STATUS } from "@/common/constants/general.js"

export class MaterialVolumesMiddleware {
  constructor(
    private readonly materialRepo: MaterialRepository,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly materialVolumesRepo: MaterialVolumesRepository
  ) {}

  createSchema = (c: Context) => {
    return this.attachCommonRefinements(c, CreateMaterialVolumeRequestSchema)
  }

  updateSchema = async (c: Context) => {
    const id = c.req.param("id")
    const materialVolumes = await this.materialVolumesRepo.findById(
      c,
      Number(id)
    )
    if (!materialVolumes) {
      throw new NotFoundError("Material volume not found.")
    }
    return this.attachCommonRefinements(c, UpdateMaterialVolumeRequestSchema)
  }

  importSchema = (c: Context) => {
    const EXCEL_COLUMNS = getTranslateMaterialVolumeColumnsExcel(c)

    console.log("EXCEL_COLUMNS", EXCEL_COLUMNS)

    const ImportMaterialVolumeRowSchema = z.object({
      [EXCEL_COLUMNS.material_id]: MaterialVolumeSchema.shape.material_id,
      [EXCEL_COLUMNS.manufacture_id]: MaterialVolumeSchema.shape.manufacture_id,
      [EXCEL_COLUMNS.unit_per_box]: MaterialVolumeSchema.shape.unit_per_box,
      [EXCEL_COLUMNS.box_length]: MaterialVolumeSchema.shape.box_length,
      [EXCEL_COLUMNS.box_width]: MaterialVolumeSchema.shape.box_width,
      [EXCEL_COLUMNS.box_height]: MaterialVolumeSchema.shape.box_height,
    })

    const transformedMaterialVolumeRowSchema =
      ImportMaterialVolumeRowSchema.transform(async (row) => {
        const transformedRow = {
          material_id: Number(row[EXCEL_COLUMNS.material_id]),
          manufacture_id: Number(row[EXCEL_COLUMNS.manufacture_id]),
          unit_per_box: Number(row[EXCEL_COLUMNS.unit_per_box]),
          box_length: Number(row[EXCEL_COLUMNS.box_length]),
          box_width: Number(row[EXCEL_COLUMNS.box_width]),
          box_height: Number(row[EXCEL_COLUMNS.box_height]),
        }

        return transformedRow
      })

    const refinedMaterialRowSchema = this.attachCommonRefinements(
      c,
      transformedMaterialVolumeRowSchema,
      false
    )

    return z
      .array(refinedMaterialRowSchema)
      .min(1, {
        message: c.var.t("validator.rows_cannot_be_empty"),
      })
      .superRefine((rows, ctx) => {
        const seen = new Map<string, number>()

        rows.forEach((row, index) => {
          const key = `${row.material_id}_${row.manufacture_id}`

          if (seen.has(key)) {
            const firstIndex = seen.get(key)!
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `validator.duplicate_material_manufacture`,
              path: [index, "material_id"],
              params: {
                duplicateRow: firstIndex + 1,
                currentRow: index + 1,
              },
            })
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `validator.duplicate_material_manufacture`,
              path: [index, "manufacture_id"],
              params: {
                duplicateRow: firstIndex + 1,
                currentRow: index + 1,
              },
            })
          } else {
            seen.set(key, index)
          }
        })
      })
  }

  importTemplate = () => {
    const template: BaseTemplate = new MaterialVolumeTemplate(PROCESSOR.SHEETJS)
    return template
  }

  attachCommonRefinements = (
    c: Context,
    schema: ZodSchema,
    isvalidateConsumptionUnit = true
  ) => {
    return schema.superRefine(
      async (data: CreateMaterialVolumeRequest, ctx) => {
        const material = await this.materialRepo.findById(c, data.material_id)

        if (!material) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.not_exist",
            path: ["material_id"],
          })
          return
        }

        this.#isMaterialLevel3(c, ctx, material)

        if (isvalidateConsumptionUnit)
          this.#validateConsumptionUnit(
            c,
            ctx,
            material,
            data.consumption_unit_per_distribution_unit
          )

        await Promise.all([
          this.#isManufactureExistById(c, ctx, data.manufacture_id),
          this.#validateMaterialIdAndManufactureIdIsExist(
            c,
            ctx,
            data.material_id,
            data.manufacture_id
          ),
        ])
      }
    )
  }

  readonly #isMaterialLevel3 = async (
    c: Context,
    ctx: z.RefinementCtx,
    material: MaterialSchema
  ) => {
    if (material.material_level_id === MATERIAL_LEVEL.TEMPLATE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.material_must_level_3",
        path: ["material_id"],
      })
    }
  }

  readonly #isManufactureExistById = async (
    c: Context,
    ctx: z.RefinementCtx,
    manufactureId: number
  ) => {
    const manufacture = await this.manufactureRepo.findById(c, {
      id: manufactureId,
    })
    if (!manufacture) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["manufacture_id"],
      })
    }

    if (manufacture?.status === STATUS.INACTIVE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.manufacture_is_inactive",
        path: ["manufacture_id"],
      })
    }
  }

  readonly #validateConsumptionUnit = async (
    c: Context,
    ctx: z.RefinementCtx,
    material: MaterialSchema,
    consumptionUnitPerDistributionUnit: number
  ) => {
    if (!material) return

    if (
      material.consumption_unit_per_distribution_unit !==
      consumptionUnitPerDistributionUnit
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.invalid_consumption_unit",
        path: ["consumption_unit_per_distribution_unit"],
      })
    }
  }

  readonly #validateMaterialIdAndManufactureIdIsExist = async (
    c: Context,
    ctx: z.RefinementCtx,
    materialId: number,
    manufactureId: number
  ) => {
    const id = c.req.param("id")

    const result = await this.materialVolumesRepo.findOne(c, {
      material_id: materialId,
      manufacture_id: manufactureId,
    })

    if (result && result.id !== Number(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.material_and_manufacture_exist",
        path: ["material_id"],
      })
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.material_and_manufacture_exist",
        path: ["manufacture_id"],
      })
    }
  }
}
