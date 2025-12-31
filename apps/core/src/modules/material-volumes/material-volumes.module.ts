import { NotFoundError } from "@smile/lib/error.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect, merge, associate } from "@smile/lib/utils.js"
import { FileResponse } from "@smile/lib/types/file.js"
import { Context } from "hono"
import { MaterialRepository } from "../material/material.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { MaterialVolumesRepository } from "./material-volumes.repository.js"
import {
  GetMaterialVolumesQueryParams,
  CreateMaterialVolumeRequest,
  UpdateMaterialVolumeRequest,
  RowType,
} from "./material-volumes.schema.js"
import { MaterialVolumeTemplate } from "./material-volume.excel.js"
import momentTZ from "moment-timezone"

export class MaterialVolumesModule {
  constructor(
    private readonly repo: MaterialVolumesRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly userRepo: UserRepository
  ) {}

  async list(c: Context, queryParam: GetMaterialVolumesQueryParams) {
    const { data, total } = await this.repo.findAll(c, queryParam)

    if (data.length === 0) {
      return new PaginatedResponse(queryParam)
    }

    const createdByIds = collect(data, "created_by")
    const updatedByIds = collect(data, "updated_by")

    const [users] = await Promise.all([
      this.userRepo.getByIDsMapped(
        c,
        merge(createdByIds.length ? createdByIds : [0], updatedByIds)
      ),
    ])

    const materialVolumes = data.map((res) => ({
      ...res,
      material_type_name: c.var.t(
        `material_type.label.${res.material_type_name}`
      ),
      user_created_by: users[res.created_by ?? 0]?.[0] ?? {},
      user_updated_by: users[res.updated_by ?? 0]?.[0] ?? {},
    }))

    return new PaginatedResponse(queryParam, materialVolumes, total)
  }

  async detail(c: Context, id: number) {
    const materialVolume = await this.repo.findById(c, id)
    if (!materialVolume) throw new NotFoundError("Material volume not found.")

    if (materialVolume.deleted_at) {
      throw new NotFoundError("Material volume has been deleted")
    }

    const [material, manufacture, userCreatedBy, userUpdatedBy] =
      await Promise.all([
        this.materialRepo.findById(c, materialVolume.material_id),
        this.manufactureRepo.findById(c, { id: materialVolume.manufacture_id }),
        this.userRepo.findById(c, materialVolume.created_by ?? 0),
        this.userRepo.findById(c, materialVolume.updated_by ?? 0),
      ])

    return {
      ...materialVolume,
      material: material
        ? {
            id: material.id,
            name: material.name,
            consumption_unit_per_distribution_unit:
              material.consumption_unit_per_distribution_unit,
          }
        : {},
      manufacture: manufacture
        ? { id: manufacture.id, name: manufacture.name }
        : {},
      user_created_by: userCreatedBy
        ? {
            id: userCreatedBy.id,
            username: userCreatedBy.username,
            firstname: userCreatedBy.firstname,
            lastname: userCreatedBy.lastname,
          }
        : {},
      user_updated_by: userUpdatedBy
        ? {
            id: userUpdatedBy.id,
            username: userUpdatedBy.username,
            firstname: userUpdatedBy.firstname,
            lastname: userUpdatedBy.lastname,
          }
        : {},
    }
  }

  readonly #getMaterialsMapped = async (
    c: Context,
    ids: (string | number | Date)[]
  ) => {
    const numericIds = ids
      .map((id) => (typeof id === "number" ? id : Number(id)))
      .filter((id) => !isNaN(id))
    if (numericIds.length === 0) return {}

    const materials = await c.var.trx
      .selectFrom("materials")
      .where("id", "in", numericIds)
      .where("deleted_at", "is", null)
      .select(["id", "name"])
      .execute()
    return associate(materials, "id")
  }

  readonly #getManufacturesMapped = async (
    c: Context,
    ids: (string | number | Date)[]
  ) => {
    const numericIds = ids
      .map((id) => (typeof id === "number" ? id : Number(id)))
      .filter((id) => !isNaN(id))
    if (numericIds.length === 0) return {}

    const manufactures = await c.var.trx
      .selectFrom("manufactures")
      .where("id", "in", numericIds)
      .where("deleted_at", "is", null)
      .select(["id", "name"])
      .execute()

    return associate(manufactures, "id")
  }

  async create(c: Context, data: CreateMaterialVolumeRequest) {
    const userId = c.get("user")?.id

    const createData = {
      manufacture_id: data.manufacture_id,
      material_id: data.material_id,
      unit_per_box: data.unit_per_box,
      box_width: data.box_width,
      box_height: data.box_height,
      box_length: data.box_length,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const result = await this.repo.create(c, createData)
    return { id: Number(result.insertId) }
  }

  async update(c: Context, id: number, data: UpdateMaterialVolumeRequest) {
    const userId = c.get("user")?.id

    const updateData = {
      manufacture_id: data.manufacture_id,
      material_id: data.material_id,
      unit_per_box: data.unit_per_box,
      box_width: data.box_width,
      box_height: data.box_height,
      box_length: data.box_length,
      updated_by: userId,
      updated_at: new Date(),
    }

    await this.repo.update(c, updateData, { id })

    return {}
  }

  async template(c: Context) {
    const language = c.var.language
    const excelTemplate = new MaterialVolumeTemplate()
    const title = c.var.t("title.template_import.material_volume")
    const fileName = `material_volume_${language.toLowerCase()}.xlsx`

    excelTemplate.setTitle(`${title}`)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.loadTemplateFile(fileName)

    const listMasterMaterial = this.repo.getStreamMaterials(c)
    async function* generateMasterDataRows() {
      for await (const material of listMasterMaterial) {
        const row: (string | number | null)[] = [
          material.child_id,
          material.child_name,
          material.child_description,
          material.child_code,
          material.child_hierarchy_code,
          c.var.t(`material.level.${material.child_material_level}`),
          material.parent_hierarchy_code,
          material.parent_name,
          material.consumption_unit_per_distribution_unit,
          material.unit_of_consumption,
          material.unit_of_distribution,
          material.child_is_temperature_sensitive === 1
            ? c.var.t("common.yes")
            : c.var.t("common.no"),
          material.child_min_temperature,
          material.child_max_temperature,
        ]
        yield row
      }
    }

    const rowsListMasterMaterials = generateMasterDataRows()

    await Promise.all([
      excelTemplate.populateMasterData(
        c.var.t("material_volumes.sheet.list_material"),
        rowsListMasterMaterials
      ),
      excelTemplate.populateMasterData(
        c.var.t("material_volumes.sheet.list_manufacture"),
        this.repo.getStreamManufactures(c)
      ),
    ])
    const generatedFile = await excelTemplate.generate(title)

    return generatedFile
  }

  async export(c: Context, queryParam: GetMaterialVolumesQueryParams) {
    const stream = await this.repo.getStreamMaterialVolumes(c, queryParam)
    const rows: RowType[][] = []
    const timezone = c.req.header("Timezone") || "UTC"

    for await (const item of stream) {
      const row = [
        item.id,
        item.material_id,
        item.material_name,
        item.manufacture_id,
        item.manufacture_name,
        item.unit_per_box,
        item.consumption_unit_per_distribution_unit,
        item.box_length,
        item.box_width,
        item.box_height,
        item.updated_at
          ? momentTZ(item.updated_at).tz(timezone).format("DD/MM/YYYY HH:mm")
          : null,
        item.updated_by_name,
      ]
      rows.push(row)
    }

    const columns = [
      {
        key: "material-volume.label.id",
        header: c.var.t("material-volume.label.id"),
        width: 15,
      },
      {
        key: "material_id",
        header: c.var.t("material.label.material_id"),
        width: 15,
      },
      {
        key: "material_name",
        header: c.var.t("entity_material.label.material_name"),
        width: 30,
      },
      {
        key: "manufacture_id",
        header: c.var.t("material.label.manufacture_id"),
        width: 15,
      },
      {
        key: "manufacture_name",
        header: c.var.t("download-report.column.manufacture_name"),
        width: 30,
      },
      {
        key: "unit_per_box",
        header: c.var.t("material.label.unit_per_box"),
        width: 15,
      },
      {
        key: "consumption_unit_per_distribution_unit",
        header: c.var.t(
          "material-volumes.label.consumption_unit_per_distribution_unit"
        ),
        width: 15,
      },
      {
        key: "box_length",
        header: c.var.t("material-volumes.label.box_length"),
        width: 15,
      },
      {
        key: "box_width",
        header: c.var.t("material-volumes.label.box_width"),
        width: 15,
      },
      {
        key: "box_height",
        header: c.var.t("material-volumes.label.box_height"),
        width: 15,
      },
      {
        key: "updated_at",
        header: c.var.t("material-volumes.label.updated_at"),
        width: 15,
      },
      {
        key: "updated_by_name",
        header: c.var.t("material-volumes.label.updated_by"),
        width: 15,
      },
    ]

    const sheet = c.var.t("material_volumes.sheet.material_volumes")
    const excelTemplate = new MaterialVolumeTemplate()
    const language = c.var.language || "en"
    await excelTemplate.initSheet(sheet)

    excelTemplate.setLanguage(language)
    excelTemplate.setTitle(c.var.t("material_volumes.sheet.material_volumes"))
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setColumns(columns)
    await excelTemplate.addRows(sheet, rows)

    return excelTemplate.generate()
  }

  async import(c: Context, rows: CreateMaterialVolumeRequest[]) {
    for (const row of rows) {
      this.create(c, row)
    }

    return rows.length
  }
}
