import { STATUS } from "@/common/constants/general.js"
import { NotFoundError, ValidationError } from "@smile/lib/error.js"

import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect, group, merge, pick } from "@smile/lib/utils.js"
import { Context } from "hono"
import moment from "moment"
import { IntegrationRepository } from "../integration/integration.repository.js"
import { MaterialLevelRepository } from "../material-level/material-level.repository.js"
import { MaterialRelationRepository } from "../material-relation/material-relation.repository.js"
import { MaterialSubtypeRepository } from "../material-subtype/material-subtype.repository.js"
import { MaterialTypeRepository } from "../material-type/material-type.repository.js"
import { MaterialUnitRepository } from "../material-unit/material-unit.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"

import { MaterialPublisher } from "./material.publisher.js"
import { MaterialRepository } from "./material.repository.js"
import {
  CreateMaterialDTO,
  CreateMaterialRequest,
  GetMaterialsQueryParams,
  GetTemplateQueryParams,
  UpdateMaterialDTO,
  UpdateMaterialRequest,
  UpdateStatusMaterialRequest,
} from "./material.schema.js"
import { FileResponse } from "@smile/lib/types/file.js"
import { MATERIAL_LEVEL } from "@/common/constants/material.js"
import { MaterialTemplate } from "./material.excel.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"

type IdAndName = {
  id: number
  name: string
  subtype_name?: string | null
}
export class MaterialModule {
  constructor(
    private readonly repo: MaterialRepository,
    private readonly materialLevelRepo: MaterialLevelRepository,
    private readonly materialTypeRepo: MaterialTypeRepository,
    private readonly materialUnitRepo: MaterialUnitRepository,
    private readonly materialRelationRepo: MaterialRelationRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly userRepo: UserRepository,
    private readonly publisher: MaterialPublisher,
    private readonly integrationRepo: IntegrationRepository,
    private readonly materialSubtypeRepo: MaterialSubtypeRepository
  ) {}

  async list(c: Context, queryParam: GetMaterialsQueryParams) {
    const { client } = c.var
    const { data, total } = await this.repo.findAll(c, {
      ...queryParam,
      integration_client_id: client?.getId(),
    })

    if (data.length === 0) {
      return new PaginatedResponse(queryParam)
    }

    const materialIds = collect(data, "id")
    const createdByIds = collect(data, "created_by")
    const updatedByIds = collect(data, "updated_by")

    const [programs, users] = await Promise.all([
      this.workspaceRepo.getByFromMappedWorkspace(c, "material", materialIds),
      this.userRepo.getByIDsMapped(c, merge(createdByIds, updatedByIds)),
    ])

    const materials = data.map((res) => ({
      ...res,
      programs: programs[res.id] ?? [],
      user_created_by: users[res.created_by ?? 0]?.[0] ?? {},
      user_updated_by: users[res.updated_by ?? 0]?.[0] ?? {},
    }))

    return new PaginatedResponse(queryParam, materials, total)
  }

  async detail(c: Context, id: number) {
    const { client } = c.var
    const material = await this.repo.findById(c, id, client?.getId())
    if (!material) throw new NotFoundError("Material not found.")

    if (material.deleted_at) {
      throw new ValidationError("Material id has been deleted")
    }

    const [
      materialLevel,
      materialType,
      unitOfConsumption,
      unitOfDistribution,
      programs,
      userCreatedBy,
      userUpdatedBy,
      materialSubtype,
    ] = await Promise.all([
      this.materialLevelRepo.findById(c, material.material_level_id),
      this.materialTypeRepo.findById(c, material.material_type_id),
      this.materialUnitRepo.findById(c, material.unit_of_consumption_id),
      this.materialUnitRepo.findById(c, material.unit_of_distribution_id),
      this.workspaceRepo.getByFromMappedWorkspace(c, "material", [material.id]),
      this.userRepo.findById(c, material.created_by ?? 0),
      this.userRepo.findById(c, material.updated_by ?? 0),
      this.materialSubtypeRepo.findOne(c, {
        id: material.material_subtype_id ?? 0,
      }),
    ])

    const pickedMaterialLevel = pick(materialLevel, ["id", "name"])
    const pickedMaterialType = pick(materialType, ["id", "name"])
    const pickerMaterialSubtype = pick(
      (materialSubtype as { id: number; name: string }) || {},
      ["id", "name"]
    )

    const pickedMaterialConsumptionUnit = pick(unitOfConsumption, [
      "id",
      "name",
    ])
    const pickedMaterialDistributionUnit = pick(unitOfDistribution, [
      "id",
      "name",
    ])

    return {
      ...material,
      material_level: {
        ...pickedMaterialLevel,
        name: c.var.t(`material_level.label.${pickedMaterialLevel.name}`),
      },
      material_type: {
        ...pickedMaterialType,
        name: c.var.t(`material_type.label.${pickedMaterialType.name}`),
      },
      unit_of_consumption: {
        ...pickedMaterialConsumptionUnit,
        name: c.var.t(
          `material_unit.label.${pickedMaterialConsumptionUnit.name}`
        ),
      },
      unit_of_distribution: {
        ...pickedMaterialDistributionUnit,
        name: c.var.t(
          `material_unit.label.${pickedMaterialDistributionUnit.name}`
        ),
      },
      programs: programs[material.id] ?? [],
      user_created_by: pick(userCreatedBy, [
        "id",
        "username",
        "firstname",
        "lastname",
      ]),
      user_updated_by: pick(userUpdatedBy, [
        "id",
        "username",
        "firstname",
        "lastname",
      ]),
      material_subtype: Object.keys(pickerMaterialSubtype).length
        ? pickerMaterialSubtype
        : null,
    }
  }

  async detailRelation(c: Context, id: number) {
    const material = await this.repo.findById(c, id)
    if (!material) throw new NotFoundError("Material not found.")

    if (material.deleted_at) {
      throw new ValidationError("Material id has been deleted")
    }

    const [childMaterials, parentMaterials, materialLevels] = await Promise.all(
      [
        this.materialRelationRepo.findChildRelationsRecursive(c, id),
        this.materialRelationRepo.findParentRelationsRecursive(c, id),
        this.materialLevelRepo.findAllWithoutPaginate(c),
      ]
    )

    const materialRelations = merge(childMaterials, parentMaterials)
    const materialRelationsGroupByLevel = group(
      materialRelations,
      "material_level_id"
    )

    const materialHierarchy = materialLevels.data.map((materialLevel) => {
      const materials =
        materialRelationsGroupByLevel[Number(materialLevel.id)] ?? []

      return {
        id: materialLevel.id,
        name: materialLevel.name,
        materials,
      }
    })

    return {
      id: material.id,
      name: material.name,
      material_level_id: material.material_level_id,
      material_hierarchy: materialHierarchy,
    }
  }

  async create(c: Context, body: CreateMaterialRequest) {
    const { program_ids, material_parent_ids, is_hierarchy, ...createBody } =
      body
    const createData: CreateMaterialDTO = {
      ...createBody,
      is_kfa: is_hierarchy,
      status: STATUS.ACTIVE,
      min_temperature: body.min_temperature || 0,
      max_temperature: body.max_temperature || 0,
      created_by: c.var.accountID,
      updated_by: c.var.accountID,
    }

    const createdMaterial = await this.repo.create(c, createData)
    const createdMaterialId = Number(createdMaterial.insertId)

    await Promise.all([
      this.#managePrograms(c, createdMaterialId, program_ids),
      this.#manageMaterialRelations(c, createdMaterialId, material_parent_ids),
      this.integrationRepo.upsertAssociation(
        c,
        createdMaterialId,
        "material",
        undefined,
        body.integration_client_id ?? c.var.client?.getId()
      ),
    ])

    await this.publisher.processCreate(c, createdMaterialId)

    return this.detail(c, createdMaterialId)
  }

  /**
   * There are fields that cannot be updated when the actual material is already been
   * used in transactions:
   *   1. hierarcy
   *   2. material type
   *   3. material workspaces (can only be added, not removed)
   *
   * TO DO: Need to add validation for the above cases.
   * @param c
   * @param id
   * @param body
   * @returns
   */
  async update(c: Context, id: number, body: UpdateMaterialRequest) {
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    const { program_ids, material_parent_ids, is_hierarchy, ...updateBody } =
      body

    const material = await this.repo.findById(c, id)
    if (!material) throw new NotFoundError("Material not found.")

    const updateData: UpdateMaterialDTO = {
      ...updateBody,
      updated_by: c.var.accountID,
    }

    await Promise.all([
      await this.repo.update(c, updateData, { id }),
      await this.#managePrograms(c, material.id, program_ids),
      await this.#manageMaterialRelations(c, id, material_parent_ids),
      this.integrationRepo.upsertAssociation(
        c,
        id,
        "material",
        undefined,
        body.integration_client_id ?? c.var.client?.getId()
      ),
    ])

    await this.publisher.processUpdate(c, id)

    return this.detail(c, id)
  }

  /**
   * When a material status is updated, all its child material down to the latest level
   * is also updated with below conditions in mind.
   *
   * TO DO: The current logic does not yet include the fact that the
   * child materials could already be used in transactions, if it happens the parent
   * material status cannot be updated.
   *
   * @param c Hono Context
   * @param id: Material ID
   * @param body: Request Body
   * @returns
   */
  async updateStatus(
    c: Context,
    id: number,
    body: UpdateStatusMaterialRequest
  ) {
    const material = await this.repo.findById(c, id)
    if (!material) throw new NotFoundError("Material not found.")

    const childMaterials =
      await this.materialRelationRepo.findChildRelationsRecursive(c, id)
    const childMaterialIds = childMaterials.map(
      (childMaterial) => childMaterial.id
    )

    const materialIds = merge([material.id], childMaterialIds)

    await this.repo.updateStatus(c, materialIds, body.status)

    return this.detail(c, id)
  }

  async export(
    c: Context,
    queryParam: GetMaterialsQueryParams
  ): Promise<FileResponse> {
    const title = "Material"
    const excelTemplate = new MaterialTemplate(PROCESSOR.SHEETJS)

    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.initSheet(title)

    excelTemplate.setColumns([
      { key: "id", header: c.var.t("material.label.id"), width: 10 },
      { key: "name", header: c.var.t("material.label.name"), width: 60 },
      {
        header: c.var.t("material.label.description"),
        width: 30,
      },
      { header: c.var.t("material.label.code"), width: 30 },
      {
        header: c.var.t("material.label.hierarchy_code"),
        width: 30,
      },
      {
        header: c.var.t("common.program"),
        width: 40,
      },
      {
        header: c.var.t("material.label.material_level"),
        width: 30,
      },
      {
        header: c.var.t("material.label.parent_hierarchy_code"),
        width: 30,
      },
      {
        header: c.var.t("material.label.parent_material"),
        width: 30,
      },
      {
        header: c.var.t(
          "material.label.consumption_unit_per_distribution_unit"
        ),
        width: 30,
      },
      {
        header: c.var.t("material.label.unit_of_consumption"),
        width: 30,
      },
      {
        header: c.var.t("material.label.unit_of_distribution"),
        width: 30,
      },
      {
        header: c.var.t("material.label.is_temperature_sensitive"),
        width: 30,
      },
      {
        header: c.var.t("material.label.min_temperature"),
        width: 30,
      },
      {
        header: c.var.t("material.label.max_temperature"),
        width: 30,
      },
      {
        header: c.var.t("material.label.material_type"),
        width: 30,
      },
      {
        header: c.var.t("material.label.material_subtype"),
        width: 30,
      },
      {
        header: c.var.t("material.label.is_managed_in_batch"),
        width: 30,
      },
      {
        header: c.var.t("material.label.min_retail_price"),
        width: 30,
      },
      {
        header: c.var.t("material.label.max_retail_price"),
        width: 30,
      },
      {
        header: c.var.t("material.label.is_stock_opname_mandatory"),
        width: 30,
      },
      { header: c.var.t("material.label.status"), width: 30 },
      {
        header: c.var.t("material.label.updated_at"),
        width: 30,
      },
      {
        header: c.var.t("material.label.user_updated_by"),
        width: 30,
      },
    ])

    const { data: materials, total } = await this.repo.findAll(c, queryParam, {
      paginate: false,
    })
    if (total === 0) {
      return await excelTemplate.generate()
    }

    const materialIds = collect(materials, "id")
    const createdByIds = collect(materials, "created_by")
    const updatedByIds = collect(materials, "updated_by")

    const [
      parentMaterials,
      materialLevels,
      materialTypes,
      materialSubtypes,
      materialUnits,
      users,
    ] = await Promise.all([
      this.materialRelationRepo.findParentRelation(c, materialIds),
      this.materialLevelRepo.findAllWithoutPaginate(c),
      this.materialTypeRepo.findAllWithoutPaginate(c),
      this.materialSubtypeRepo.findAllWithoutPaginate(c),
      this.materialUnitRepo.findAllWithoutPaginate(c),
      this.userRepo.getByIDsMapped(c, merge(createdByIds, updatedByIds)),
      this.workspaceRepo.getByFromMappedWorkspace(c, "material", materialIds),
    ])

    await excelTemplate.addRows(
      title,
      materials.map((material) => {
        const parentMaterial = parentMaterials.find(
          (parentMaterial) => parentMaterial.child_material_id === material.id
        )
        const materialLevel = materialLevels.data.find(
          (materialLevel) => materialLevel.id === material.material_level_id
        )
        const materialType = materialTypes.data.find(
          (materialType) => materialType.id === material.material_type_id
        )
        const materialSubtype = materialSubtypes.data.find(
          (materialSubtype) =>
            materialSubtype.id === material.material_subtype_id
        )
        const materialConsumptionUnit = materialUnits.data.find(
          (materialUnit) => materialUnit.id === material.unit_of_consumption_id
        )
        const materialDistributionUnit = materialUnits.data.find(
          (materialUnit) => materialUnit.id === material.unit_of_distribution_id
        )

        return {
          id: material.id,
          name: material.name,
          description: material.description || "-",
          code: material.code,
          hierarchy_code: material.hierarchy_code || "-",
          material_level: materialLevel?.name || "-",
          parent_hierarchy_code: parentMaterial?.hierarchy_code || "-",
          parent_material: parentMaterial?.name || "-",
          consumption_unit_per_distribution_unit:
            material.consumption_unit_per_distribution_unit ?? "-",
          unit_of_consumption: materialConsumptionUnit?.name ?? "-",
          unit_of_distribution: materialDistributionUnit?.name ?? "-",
          is_temperature_sensitive: material.is_temperature_sensitive
            ? c.var.t("common.yes")
            : c.var.t("common.no"),
          min_temperature: material.min_temperature ?? "-",
          max_temperature: material.max_temperature ?? "-",
          material_type: materialType?.name
            ? c.var.t(`material_type.label.${materialType.name}`)
            : "-",
          material_subtype: materialSubtype?.name
            ? c.var.t(`material_subtype.label.${materialSubtype.name}`)
            : "-",
          is_managed_in_batch: material.is_managed_in_batch
            ? c.var.t("common.yes")
            : c.var.t("common.no"),
          min_retail_price: material.min_retail_price ?? "-",
          max_retail_price: material.max_retail_price ?? "-",
          is_stock_opname_mandatory: material.is_stock_opname_mandatory
            ? c.var.t("common.yes")
            : c.var.t("common.no"),
          status: material.status
            ? c.var.t("common.active")
            : c.var.t("common.inactive"),
          updated_at: material.updated_at ?? "-",
          user_updated_by: users[material.updated_by]?.[0]?.firstname ?? "-",
        }
      })
    )

    const formatDate =
      moment().format("MM-DD-YYYY HH_mm_ss") +
      " GMT" +
      moment().format("Z").replace(":00", "")
    const filename = `${title} ${formatDate}`

    return await excelTemplate.generate(filename)
  }

  async template(c: Context, queryParam: GetTemplateQueryParams) {
    const languange = c.var.language
    const excelTemplate = new MaterialTemplate()

    let title = ""
    let fileName = ""
    if (
      queryParam.is_hierarchy &&
      queryParam.material_level_id === MATERIAL_LEVEL.TEMPLATE
    ) {
      fileName = `material_hr_2_${languange}.xlsx`
      title = c.var.t("material_level.label.template")
    } else if (
      queryParam.is_hierarchy &&
      queryParam.material_level_id === MATERIAL_LEVEL.VARIANT
    ) {
      fileName = `material_hr_3_${languange}.xlsx`
      title = c.var.t("material_level.label.variant")
    } else if (
      !queryParam.is_hierarchy &&
      queryParam.material_level_id === MATERIAL_LEVEL.VARIANT
    ) {
      fileName = `material_nhr_3_${languange}.xlsx`
    }

    excelTemplate.setTitle(`Template Material ${title}`)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.loadTemplateFile(fileName)

    const materialTypesTranslation: IdAndName[] = []
    const consumationUnitsTranslation: IdAndName[] = []
    const distributionUnitsTranslation: IdAndName[] = []
    const materialSubTypesUnitsTranslation: IdAndName[] = []

    const [
      materialTypes,
      consumsionUnits,
      distributionUnits,
      materialSubtypes,
    ] = await Promise.all([
      this.materialTypeRepo.getStreamData(c),
      this.materialUnitRepo.getStreamData(c, "consumption"),
      this.materialUnitRepo.getStreamData(c, "distribution"),
      this.materialSubtypeRepo.getStreamData(c),
    ])

    for await (const item of materialTypes) {
      materialTypesTranslation.push({
        ...item,
        name: c.var.t(`material_type.label.${item.name}`),
        subtype_name: item.subtype_name
          ? c.var.t(`material_subtype.label.${item.subtype_name}`)
          : null,
      })
    }

    for await (const item of consumsionUnits) {
      consumationUnitsTranslation.push({
        ...item,
        name: c.var.t(`material_unit.label.${item.name}`),
      })
    }

    for await (const item of distributionUnits) {
      distributionUnitsTranslation.push({
        ...item,
        name: c.var.t(`material_unit.label.${item.name}`),
      })
    }

    for await (const item of materialSubtypes) {
      materialSubTypesUnitsTranslation.push({
        ...item,
        name: c.var.t(`material_subtype.label.${item.name}`),
      })
    }

    await Promise.allSettled([
      excelTemplate.populateMasterData(
        c.var.t("material.sheet.list_program"),
        this.workspaceRepo.getStreamData(c, queryParam.is_hierarchy)
      ),
      excelTemplate.populateMasterData(
        c.var.t("material.sheet.list_material_type"),
        this.#arrayToAsyncIterator(materialTypesTranslation)
      ),
      excelTemplate.populateMasterData(
        c.var.t("material.sheet.list_consumption_unit"),
        this.#arrayToAsyncIterator(consumationUnitsTranslation)
      ),
      excelTemplate.populateMasterData(
        c.var.t("material.sheet.list_distribution_unit"),
        this.#arrayToAsyncIterator(distributionUnitsTranslation)
      ),
      excelTemplate.populateMasterData(
        c.var.t("material.sheet.list_material_subtype"),
        this.#arrayToAsyncIterator(materialSubTypesUnitsTranslation)
      ),
    ])

    return await excelTemplate.generate()
  }

  async import(c: Context, rows: CreateMaterialRequest[]) {
    for (const row of rows) {
      this.create(c, row)
    }

    return rows.length
  }

  readonly #managePrograms = async (
    c: Context,
    materialId: number,
    programIds: number[] | null | undefined
  ) => {
    if (programIds && programIds.length > 0) {
      const materialWorkspaceData = (programIds ?? []).map((program_id) => ({
        material_id: materialId,
        workspace_id: program_id,
      }))

      await this.workspaceRepo.attachWithMaterialId(
        c,
        materialId,
        materialWorkspaceData
      )
    }
  }

  readonly #manageMaterialRelations = async (
    c: Context,
    materialId: number,
    materialParentIds: number[] | null | undefined
  ) => {
    if (materialParentIds && materialParentIds.length > 0) {
      const materialRelationData = materialParentIds.map(
        (materialParentId) => ({
          child_material_id: materialId,
          parent_material_id: materialParentId,
        })
      )

      await this.materialRelationRepo.syncMaterialRelations(
        c,
        materialId,
        materialRelationData
      )
    }
  }

  #arrayToAsyncIterator<T>(array: T[]): AsyncIterableIterator<T> {
    return (async function* () {
      for (const item of array) {
        yield item
      }
    })()
  }
}
