import {
  IMMUN_FILENAME,
  KFA_LEVEL_FILENAME,
  KFA_LEVEL_ID,
  KFA_LEVEL_LABEL,
} from "@/common/constants/material.js"
import { NotFoundError } from "@smile/lib/error.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect, pick } from "@smile/lib/utils.js"
import { Context } from "hono"
import { UpdateResult } from "kysely"
import { ActivityRepository } from "../activity/activity.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { UserRepository } from "../user/user.repository.js"
import {
  MaterialLevel2TemplateV2,
  MaterialLevel3TemplateV2,
} from "./material.excel.js"
import { MaterialRepository } from "./material.repository.js"
import {
  GetMaterialsQueries,
  ImportMaterialRequest,
  UpdateMaterialRequest,
  UpdateStatusRequest,
} from "./material.schema.js"

export class MaterialModule {
  constructor(
    private materialRepo: MaterialRepository,
    private activityRepo: ActivityRepository,
    private manufactureRepo: ManufactureRepository,
    private userRepo: UserRepository
  ) {}

  async detail(c: Context, id: number) {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled
    const material = await this.materialRepo.findOne(c, { id })
    if (!material) {
      throw new NotFoundError("Material not found")
    }

    const [manufactures, activities, companions, type, conditions, levels] =
      await Promise.all([
        this.manufactureRepo.getByMaterialId(c, id),
        this.activityRepo.getByMaterialId(c, id),
        this.materialRepo.findCompanions(c, id),
        this.materialRepo.findMaterialType(c, material.is_vaccine),
        this.materialRepo.findConditions(c, id),
        this.materialRepo.findLevelMapping(c, id),
      ])

    const { is_addremove, ...materialResp } = material
    const resp = {
      ...materialResp,
      manufactures,
      material_activities: activities,
      material_companion: companions,
      material_type: type,
      mapping_master_material: isKFAEnabled ? levels : null,
    }

    if (material.kfa_level_id === KFA_LEVEL_ID.TEMPLATE) {
      return resp
    }

    return {
      ...resp,
      ...conditions,
      is_addremove,
    }
  }

  async list(c: Context, params: GetMaterialsQueries) {
    const { data, total } = await this.materialRepo.findAll(c, params)
    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const materialIDs = collect(data, "id")
    const userIDs = collect(data, "updated_by")
    const [mapActivities, mapUsers] = await Promise.all([
      this.activityRepo.getByMaterialIdMapped(c, materialIDs),
      this.userRepo.getBasicDetailMapped(c, userIDs),
    ])

    const list = data.map((res) => ({
      ...pick(res, [
        "id",
        "name",
        "code",
        "kfa_code",
        "kfa_level_id",
        "temperature_min",
        "temperature_max",
        "status",
      ]),
      material_type: this.materialRepo.findMaterialType(c, res.is_vaccine),
      material_activities: mapActivities[res.id],
      user_updated_by: mapUsers[res.updated_by ?? 0],
    }))

    return new PaginatedResponse(params, list, total)
  }

  async template(c: Context, params: GetMaterialsQueries) {
    let excelTemplate = new MaterialLevel3TemplateV2()
    if (params.material_level_id === KFA_LEVEL_ID.TEMPLATE) {
      excelTemplate = new MaterialLevel2TemplateV2()
    }

    let title = IMMUN_FILENAME
    if (c.var.config?.material.is_hierarchy_enabled) {
      title =
        KFA_LEVEL_FILENAME[params.material_level_id ?? KFA_LEVEL_ID.VARIANT]
    }
    excelTemplate.setTitle(`Template ${title}`)
    excelTemplate.setTimezone(c.req.header("Timezone"))

    await excelTemplate.loadFile()
    await Promise.all([
      excelTemplate.setActivities(this.activityRepo.getStreamData(c)),
      excelTemplate.setManufactures(this.manufactureRepo.getStreamData(c)),
      excelTemplate.setMaterials(this.materialRepo.getStreamData(c, params)),
    ])

    return await excelTemplate.generate()
  }

  async import(
    c: Context,
    params: GetMaterialsQueries,
    rows: ImportMaterialRequest
  ) {
    const bulkProcess: Promise<void | UpdateResult[]>[] = []
    for (const row of rows) {
      bulkProcess.push(
        this.materialRepo.update(
          c,
          { is_addremove: row.is_addremove },
          { id: row.id }
        )
      )
      bulkProcess.push(
        this.manufactureRepo.syncMaterialManufactures(
          c,
          row.id,
          row.manufactures
        )
      )
      bulkProcess.push(this.activityRepo.syncMaterialActivities(c, row.id, row))
      bulkProcess.push(
        this.materialRepo.syncMaterialCompanions(
          c,
          row.id,
          row.material_companion
        )
      )
      bulkProcess.push(
        this.materialRepo.syncMaterialConditions(
          c,
          row.id,
          row.is_addremove ? { addremove: row.addremove } : {}
        )
      )
    }

    await Promise.all(bulkProcess)

    return rows.length
  }

  async export(c: Context, params: GetMaterialsQueries) {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled
    let title = IMMUN_FILENAME

    if (isKFAEnabled) {
      title =
        KFA_LEVEL_FILENAME[params.material_level_id ?? KFA_LEVEL_ID.VARIANT]
    }

    const excelTemplate = new MaterialLevel2TemplateV2()
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.initSheet(title)

    let columns = [
      { key: "id", header: "Id", width: 15 },
      { key: "name", header: "Name", width: 50 },
      { key: "description", header: "Description", width: 20 },
      { key: "code", header: "Material Code", width: 20 },
      { key: "kfa_code", header: "Hierarchy Code", width: 20 },
      { key: "level", header: "Level", width: 20 },
      {
        key: "parent_hierarchy_code",
        header: "Parent Hierarchy Code",
        width: 20,
      },
      { key: "parent_name", header: "Parent Material", width: 20 },
      { key: "pieces_per_unit", header: "Pieces Per Unit", width: 20 },
      { key: "unit", header: "Consumption Unit", width: 20 },
      { key: "unit_of_distribution", header: "Distribution Unit", width: 20 },
      {
        key: "temperature_sensitive",
        header: "Temperature Sensitive",
        width: 20,
      },
      { key: "temperature_min", header: "Temperature Min", width: 20 },
      { key: "temperature_max", header: "Temperature Max", width: 20 },
      { key: "material_type", header: "Material Type", width: 20 },
      { key: "managed_in_batch", header: "Manage by Batch", width: 20 },
      { key: "min_retail_price", header: "Min Retail Price", width: 20 },
      { key: "max_retail_price", header: "Max Retail Price", width: 20 },
      { key: "companions", header: "Material Companion", width: 20 },
      { key: "manufactures", header: "Manufactures", width: 20 },
      { key: "activities", header: "Activities", width: 20 },
      { key: "status", header: "Status", width: 20 },
      { key: "updated_at", header: "updated_at", width: 20 },
      { key: "updated_by", header: "updated_by", width: 20 },
    ]
    if (!isKFAEnabled) {
      columns = columns.filter(
        (column) =>
          !["parent_hierarchy_code", "parent_name"].includes(column.key)
      )
    }
    excelTemplate.setColumns(columns)

    const { data } = await this.materialRepo.findAll(c, params, false)
    if (data.length === 0) {
      return await excelTemplate.generate()
    }

    const materialIDs = collect(data, "id")
    const userIDs = collect(data, "updated_by")
    const [mapCompanions, mapActivities, mapManufactures, mapUsers] =
      await Promise.all([
        this.materialRepo.findCompanionsGroupByMaterialId(c, materialIDs),
        this.activityRepo.getByMaterialIdMapped(c, materialIDs),
        this.manufactureRepo.getByMaterialIdMapped(c, materialIDs),
        this.userRepo.getBasicDetailMapped(c, userIDs),
      ])

    await excelTemplate.addRows(
      title,
      data.map((material) => ({
        id: material.id,
        name: material.name,
        description: material.description,
        code: material.code,
        kfa_code: material.kfa_code,
        level: KFA_LEVEL_LABEL[material.kfa_level_id ?? 3],
        ...(isKFAEnabled
          ? {
              parent_hierarchy_code: material.parent_hierarchy_code,
              parent_name: material.parent_name,
            }
          : {}),
        pieces_per_unit: material.pieces_per_unit,
        unit: material.unit,
        unit_of_distribution: material.unit_of_distribution,
        temperature_sensitive: material.temperature_sensitive,
        temperature_min: material.temperature_min,
        temperature_max: material.temperature_max,
        material_type: this.materialRepo.findMaterialType(
          c,
          material.is_vaccine
        )?.name,
        managed_in_batch: material.managed_in_batch,
        min_retail_price: material.min_retail_price,
        max_retail_price: material.max_retail_price,
        companions: collect(
          mapCompanions[material.id] ?? [],
          "master_material_id"
        ).toString(),
        manufactures: collect(
          mapManufactures[material.id] ?? [],
          "name"
        ).toString(),
        activities: collect(
          mapActivities[material.id] ?? [],
          "name"
        ).toString(),
        status: material.status > 0 ? "ACTIVE" : "NOT ACTIVE",
        updated_at: material.updated_at.toLocaleString(),
        updated_by: mapUsers[material.updated_by ?? 0]?.firstname,
      }))
    )

    return await excelTemplate.generate()
  }

  async update(c: Context, id: number, req: UpdateMaterialRequest) {
    await Promise.all([
      this.materialRepo.update(
        c,
        { is_addremove: req.is_addremove },
        { id: id }
      ),
      this.manufactureRepo.syncMaterialManufactures(c, id, req.manufactures),
      this.activityRepo.syncMaterialActivities(c, id, req),
      this.materialRepo.syncMaterialCompanions(c, id, req.material_companion),
      this.materialRepo.syncMaterialConditions(
        c,
        id,
        req.is_addremove ? { addremove: req.addremove } : {}
      ),
    ])

    // TODO: save entity master material?

    return this.detail(c, id)
  }

  async updateStatus(c: Context, id: number, req: UpdateStatusRequest) {
    const material = await this.materialRepo.findOne(c, { id })
    if (!material) {
      throw new NotFoundError("Material not found")
    }

    return await this.materialRepo.update(c, req, { id: id })
  }
}
