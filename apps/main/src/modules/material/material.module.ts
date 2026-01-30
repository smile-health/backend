import {
  IMMUN_FILENAME,
  KFA_LEVEL_FILENAME,
  KFA_LEVEL_ID,
  KFA_LEVEL_LABEL,
} from "@/common/constants/material.js"
import { NotFoundError, ValidationError } from "@smile-health/lib/error.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { collect, group, merge, pick } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { ActivityRepository } from "../activity/activity.repository.js"
import { EntityTypeRepository } from "../entity-type/entity-type.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { MaterialLevelRepository } from "../material-level/material-level.repository.js"
import { MaterialUnitRepository } from "../material-unit/material-unit.repository.js"
import { UserRepository } from "../user/user.repository.js"
import {
  MaterialLevel2TemplateV2,
  MaterialLevel3TemplateV2,
} from "./material.excel.js"
import { MaterialPublisher } from "./material.publisher.js"
import { MaterialRepository } from "./material.repository.js"
import {
  GetMaterialsQueries,
  UpdateMaterialRequest,
  UpdateStatusRequest,
} from "./material.schema.js"

export class MaterialModule {
  constructor(
    private readonly materialRepo: MaterialRepository,
    private readonly materialLevelRepo: MaterialLevelRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly materialUnitRepo: MaterialUnitRepository,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly userRepo: UserRepository,
    private readonly entityTypeRepo: EntityTypeRepository,
    private readonly publisher: MaterialPublisher
  ) {}

  async detail(c: Context, id: number) {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled
    const material = await this.materialRepo.findOne(c, { id })
    if (!material) {
      throw new NotFoundError("Material not found")
    }

    const [manufactures, activities, companions, conditions, parent] =
      await Promise.all([
        this.manufactureRepo.getByMaterialId(c, id, c.var.programId),
        this.activityRepo.getByMaterialId(c, id),
        this.materialRepo.findCompanions(c, id),
        this.materialRepo.findConditions(c, id),
        this.materialRepo.findOne(c, { global_id: material.parent_global_id }),
      ])

    const resp = {
      ...pick(material, [
        "id",
        "global_id",
        "name",
        "unit_of_distribution",
        "unit_of_consumption",
        "consumption_unit_per_distribution_unit",
        "is_temperature_sensitive",
        "min_temperature",
        "max_temperature",
        "is_managed_in_batch",
        "status",
        "is_open_vial",
        "code",
        "description",
        "hierarchy_code",
        "material_level_id",
        "min_retail_price",
        "max_retail_price",
        "is_stock_opname_mandatory",
      ]),
      material_type: {
        id: material.material_type_id,
        name: c.var.t(`material_type.label.${material.material_type}`),
      },
      material_level: {
        id: material.material_level_id,
        name: c.var.t(`material_level.label.${material.material_level}`),
      },
      manufactures,
      material_activities: activities,
      material_companion: companions,
      material_parent:
        isKFAEnabled && parent ? pick(parent, ["id", "name"]) : null,
      material_hierarchy: isKFAEnabled
        ? await this.hierarchyDetail(c, material.global_id)
        : null,
      material_subtype: {
        id: material.material_subtype_id,
        name: c.var.t(`material_subtype.label.${material.material_subtype}`),
      },
    }

    if (material.material_level_id === KFA_LEVEL_ID.TEMPLATE) {
      return resp
    }

    const addRemove = conditions["addremove"]
    const entityTypes = await this.entityTypeRepo.findByIds(
      c,
      addRemove?.entity_types
    )

    return {
      ...resp,
      addremove: addRemove
        ? {
            entity_types: entityTypes,
            roles: addRemove.roles,
          }
        : null,
      is_addremove: material.is_addremove,
    }
  }

  private async hierarchyDetail(c: Context, globalId: number) {
    const [childMaterials, parentMaterials, materialLevels] = await Promise.all(
      [
        this.materialRepo.findChildRelationsRecursive(c, globalId),
        this.materialRepo.findParentRelationsRecursive(c, globalId),
        this.materialLevelRepo.find(c, {}),
      ]
    )

    const materialRelations = merge(childMaterials, parentMaterials)
    const materialRelationsGroupByLevel = group(
      materialRelations,
      "material_level_id"
    )

    return materialLevels.map((materialLevel) => {
      const materials =
        materialRelationsGroupByLevel[Number(materialLevel.id)] ?? []

      return {
        id: materialLevel.id,
        name: materialLevel.name,
        materials,
      }
    })
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
        "hierarchy_code",
        "description",
        "unit_of_consumption",
        "material_level_id",
        "min_temperature",
        "max_temperature",
        "status",
      ]),
      material_activities: mapActivities[res.id] ?? [],
      material_type: {
        id: res.material_type_id,
        name: c.var.t(`material_type.label.${res.material_type}`),
      },
      material_level: {
        id: res.material_level_id,
        name: c.var.t(`material_level.label.${res.material_level}`),
      },
      user_updated_by: mapUsers[res.updated_by ?? 0],
      material_subtype: {
        id: res.material_subtype_id,
        name: c.var.t(`material_subtype.label.${res.material_subtype}`),
      },
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
    title = c.var.t(`${title}`)

    excelTemplate.setTitle(`Template Material ${title}`)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setLanguage(c.var.language)

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
    rows: UpdateMaterialRequest[]
  ) {
    await Promise.all(
      rows.map((row) => {
        const item = {
          ...row,
          material_activities: row.activities
            ? row.activities.map((id) => ({ id, is_patient_needed: 0 }))
            : [],
        }
        return this.update(c, row.id, item, false)
      })
    )
    return rows.length
  }

  async export(c: Context, params: GetMaterialsQueries) {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled
    let title = IMMUN_FILENAME

    if (isKFAEnabled) {
      if (isKFAEnabled) {
        const materialLevelId: number =
          Number(params?.material_level_id) || KFA_LEVEL_ID.VARIANT
        title =
          KFA_LEVEL_FILENAME[materialLevelId] ||
          KFA_LEVEL_FILENAME[KFA_LEVEL_ID.VARIANT]
      }
    }
    title = c.var.t(`${title}`)

    const excelTemplate = new MaterialLevel2TemplateV2()
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.initSheet(title)

    let columns = [
      { key: "id", header: c.var.t("material.label.id"), width: 15 },
      { key: "name", header: c.var.t("material.label.name"), width: 50 },
      {
        key: "description",
        header: c.var.t("material.label.description"),
        width: 20,
      },
      { key: "code", header: c.var.t("material.label.code"), width: 20 },
      {
        key: "kfa_code",
        header: c.var.t("material.label.hierarchy_code"),
        width: 20,
      },
      {
        key: "level",
        header: c.var.t("material.label.material_level"),
        width: 20,
      },
      {
        key: "parent_hierarchy_code",
        header: c.var.t("material.label.parent_hierarchy_code"),
        width: 20,
      },
      {
        key: "parent_name",
        header: c.var.t("material.label.parent_material"),
        width: 20,
      },
      {
        key: "pieces_per_unit",
        header: c.var.t(
          "material.label.consumption_unit_per_distribution_unit"
        ),
        width: 20,
      },
      {
        key: "unit",
        header: c.var.t("material.label.unit_of_consumption"),
        width: 20,
      },
      {
        key: "unit_of_distribution",
        header: c.var.t("material.label.unit_of_distribution"),
        width: 20,
      },
      {
        key: "temperature_sensitive",
        header: c.var.t("material.label.is_temperature_sensitive"),
        width: 20,
      },
      {
        key: "temperature_min",
        header: c.var.t("material.label.min_temperature"),
        width: 20,
      },
      {
        key: "temperature_max",
        header: c.var.t("material.label.max_temperature"),
        width: 20,
      },
      {
        key: "material_type",
        header: c.var.t("material.label.material_type"),
        width: 20,
      },
      {
        key: "managed_in_batch",
        header: c.var.t("material.label.is_managed_in_batch"),
        width: 20,
      },
      {
        key: "min_retail_price",
        header: c.var.t("material.label.min_retail_price"),
        width: 20,
      },
      {
        key: "max_retail_price",
        header: c.var.t("material.label.max_retail_price"),
        width: 20,
      },
      {
        key: "companions",
        header: c.var.t("material.label.material_companion"),
        width: 20,
      },
      {
        key: "manufactures",
        header: c.var.t("material.label.manufacture"),
        width: 20,
      },
      {
        key: "activities",
        header: c.var.t("material.label.activity"),
        width: 20,
      },
      {
        key: "status",
        header: c.var.t("material.label.status"),
        width: 20,
      },
      {
        key: "updated_at",
        header: c.var.t("material.label.updated_at"),
        width: 20,
      },
      {
        key: "updated_by",
        header: c.var.t("material.label.user_updated_by"),
        width: 20,
      },
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
    const [
      mapCompanions,
      mapActivities,
      materialUnits,
      mapManufactures,
      mapUsers,
    ] = await Promise.all([
      this.materialRepo.findCompanionsGroupByMaterialId(c, materialIDs),
      this.activityRepo.getByMaterialIdMapped(c, materialIDs),
      this.materialUnitRepo.findAllWithoutPaginate(c),
      this.manufactureRepo.getByMaterialIdMapped(
        c,
        materialIDs,
        c.var.programId
      ),
      this.userRepo.getBasicDetailMapped(c, userIDs),
    ])

    await excelTemplate.addRows(
      title,
      data.map(async (material) => {
        const materialConsumptionUnit = materialUnits.data.find(
          (materialUnit) => materialUnit.id === material.unit_of_consumption_id
        )
        const materialDistributionUnit = materialUnits.data.find(
          (materialUnit) => materialUnit.id === material.unit_of_distribution_id
        )

        return {
          id: material.id,
          name: material.name,
          description: material.description,
          code: material.code,
          kfa_code: material.hierarchy_code,
          level: KFA_LEVEL_LABEL[material.material_level_id ?? 3],
          ...(isKFAEnabled
            ? {
                parent_hierarchy_code: material.parent_hierarchy_code,
                parent_name: material.parent_name,
              }
            : {}),
          pieces_per_unit: material.consumption_unit_per_distribution_unit,
          unit: materialConsumptionUnit?.name ?? "",
          unit_of_distribution: materialDistributionUnit?.name ?? "",
          temperature_sensitive: material.is_temperature_sensitive,
          temperature_min: material.min_temperature,
          temperature_max: material.max_temperature,
          material_type: (
            await this.materialRepo.findMaterialType(
              c,
              material.material_type_id
            )
          )?.name,
          managed_in_batch: material.is_managed_in_batch,
          min_retail_price: material.min_retail_price,
          max_retail_price: material.max_retail_price,
          companions: collect(
            mapCompanions[material.id] ?? [],
            "companion_id"
          ).toString(),
          manufactures: collect(
            mapManufactures[material.id] ?? [],
            "name"
          ).toString(),
          activities: collect(
            mapActivities[material.id] ?? [],
            "name"
          ).toString(),
          status: (material.status ?? 1 > 0) ? "ACTIVE" : "NOT ACTIVE",
          updated_at: c.toLocalDate(material.updated_at),
          updated_by: mapUsers[material.updated_by ?? 0]?.fullname,
        }
      })
    )

    return await excelTemplate.generate()
  }

  async update(
    c: Context,
    id: number,
    req: UpdateMaterialRequest,
    returnDetail = true
  ) {
    await Promise.all([
      this.materialRepo.updateIsAddRemove(c, id, Number(req.is_addremove)),
      this.manufactureRepo.syncMaterialManufactures(c, id, req.manufactures),
      this.activityRepo.syncMaterialActivities(c, id, req.material_activities),
      this.materialRepo.syncMaterialCompanions(c, id, req.material_companion),
      this.materialRepo.syncMaterialConditions(
        c,
        id,
        req.is_addremove ? { addremove: req.addremove } : {}
      ),
    ])

    this.publisher.processUpdate(c, id, req)

    return returnDetail && this.detail(c, id)
  }

  async updateStatus(c: Context, id: number, req: UpdateStatusRequest) {
    const material = await this.materialRepo.findOne(c, { id })
    if (!material) {
      throw new NotFoundError("Material not found")
    }

    const materialTrx = await this.materialRepo.findInTransaction(c, id)

    // can't make material inactive if it has transaction
    if (req.status === 0 && materialTrx) {
      throw new ValidationError(
        c.var.t("validator.update_has_transaction", { field: "status" })
      )
    }

    return await this.materialRepo.updateStatus(c, material.id, req.status)
  }
}
