import { DEFAULT_DATA_ENTITY_MATERIAL } from "@/common/constants/entity-material.js"
import { ValidationError } from "@smile/lib/error.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect, differ, group } from "@smile/lib/utils.js"
import { Context } from "hono"
import { ActivityRepository } from "../activity/activity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { EntityMaterialRepository } from "./entity-material.repository.js"
import {
  CreateEntityMaterialRequest,
  CudDTO,
  DeleteEntityMaterialsParams,
  EntityMasterMaterialActivitiesDTO,
  EntityMaterialDTO,
  GetEntityMaterialsParams,
  GetEntityMaterialsQueries,
  SelectEntityMaterialDTO,
  UpdateEntityMaterialRequest,
} from "./entity-material.schema.js"

export class EntityMaterialModule {
  constructor(
    private entityMaterialRepo: EntityMaterialRepository,
    private activityRepo: ActivityRepository,
    private userRepo: UserRepository,
    private materialRepo: MaterialRepository
  ) {}

  async list(
    c: Context,
    query: GetEntityMaterialsQueries,
    param: GetEntityMaterialsParams
  ) {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled || false
    const { data, total } =
      await this.entityMaterialRepo.findAllMaterialEntityGrouped(
        c,
        query,
        param,
        isKFAEnabled
      )

    if (data.length === 0) return new PaginatedResponse(query)
    const ehmm = await this.entityMaterialRepo.findAll(
      c,
      query,
      param,
      data.map((res) => res.master_material_id).filter((id) => id !== null),
      isKFAEnabled
    )

    const activityIDs = collect(ehmm, "activity_id")
    const userIDs = collect(ehmm, "updated_by")
    const materialIDs = collect(ehmm, "master_material_id")
    const entityMaterialIds = collect(ehmm, "entity_master_material_id")
    const [mapActivities, mapUsers, mapMaterials, mapEntitiyMaterials] =
      await Promise.all([
        this.activityRepo.getActivityMapped(c, activityIDs),
        this.userRepo.getBasicDetailMapped(c, userIDs),
        this.materialRepo.getMaterialMapped(c, materialIDs),
        this.entityMaterialRepo.getMaterialEntityMapped(c, entityMaterialIds),
      ])

    const ehmmMap = ehmm.map((res) => ({
      ...res,
      ...mapMaterials[res.master_material_id ?? 0],
      entity_master_material:
        mapEntitiyMaterials[res.entity_master_material_id ?? 0],
      activity: mapActivities[res.activity_id ?? 0],
      user_updated_by: mapUsers[res.updated_by ?? 0],
      entity_master_material_activities_id: res.id,
    }))
    const ehmmGroup = group(ehmmMap, "master_material_id")
    const list = data.map((res) => ({
      ...res,
      entity_master_materials: ehmmGroup[res.master_material_id ?? 0]?.sort(
        (a, b) => (a.activity_id ?? 0) - (b.activity_id ?? 0)
      ),
    }))

    return new PaginatedResponse(query, list, total)
  }

  #createWithKFA = async (
    c: Context,
    dataEntityMaterial: SelectEntityMaterialDTO,
    body: CreateEntityMaterialRequest
  ) => {
    const userID = c.var.userId
    const cudDefault: Omit<CudDTO, "deleted_by"> = {
      created_by: userID ?? 0,
      created_at: new Date(),
      updated_by: userID ?? 0,
      updated_at: new Date(),
      deleted_at: null,
    }
    const deletedNull = {
      created_by: userID ?? 0,
      created_at: new Date(),
      updated_by: userID ?? 0,
      updated_at: new Date(),
      deleted_by: null,
      deleted_at: null,
    }
    const materialChilds = await this.entityMaterialRepo.getMaterialChild(
      c,
      [body.master_material_id],
      body.activity_id
    )
    const entityMaterialChilds = await Promise.all(
      materialChilds.map(async (materialChild) => {
        return this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
          c,
          body.entity_id,
          materialChild.id
        )
      })
    )
    const entityMaterialChildsFiltered = entityMaterialChilds.filter(
      (child) => child !== undefined
    )
    const materialChildIDs = collect(materialChilds, "id")
    const materialChildExistIDs = collect(
      entityMaterialChildsFiltered,
      "master_material_id"
    )
    const materialChildDifferences = differ(
      materialChildIDs,
      materialChildExistIDs
    )
    const entityMaterialChildsIDs = collect(entityMaterialChildsFiltered, "id")
    let entityMaterialActivity: EntityMasterMaterialActivitiesDTO[] = []
    if (entityMaterialChildsIDs.length !== 0) {
      entityMaterialActivity =
        await this.entityMaterialRepo.findDynamicEntityMaterialActivity(
          c,
          "entity_master_material_id",
          "in",
          entityMaterialChildsIDs
        )
    }
    await Promise.all([
      ...entityMaterialChilds.map(async (ehmm) => {
        return ehmm?.deleted_at
          ? this.entityMaterialRepo.updateEntityMaterial(c, ehmm?.id, {
              ...deletedNull,
            })
          : null
      }),
      ...entityMaterialActivity.map(async (emma) => {
        return emma.deleted_at
          ? this.entityMaterialRepo.updateEntityMaterialActivity(c, emma.id, {
              ...deletedNull,
            })
          : null
      }),
    ])

    const dataEntityMaterialCreate: EntityMaterialDTO[] = []
    for (const materialChild of materialChildDifferences) {
      dataEntityMaterialCreate.push({
        ...DEFAULT_DATA_ENTITY_MATERIAL,
        entity_id: body.entity_id,
        master_material_id: materialChild,
        ...deletedNull,
      })
    }

    const resEntityMaterial = await Promise.all(
      dataEntityMaterialCreate.map(async (ehmm) => {
        return this.entityMaterialRepo.createEntityMaterial(c, ehmm)
      })
    )
    const resEntityMaterialIds: number[] = resEntityMaterial.map((item) =>
      Number(item[0]?.insertId)
    )
    await Promise.all(
      resEntityMaterialIds.map(async (emma) => {
        return this.entityMaterialRepo.createEntityMaterialActivity(c, {
          entity_master_material_id: emma,
          activity_id: body.activity_id,
          consumption_rate: body.consumption_rate ?? 0,
          retailer_price: body.retailer_price ?? 0,
          tax: body.tax ?? 0,
          min: body.min ?? 0,
          max: body.max ?? 0,
          allocated: 0,
          stock_on_hand: 0,
          ...cudDefault,
        })
      })
    )
    return this.entityMaterialRepo.getEntityMaterialActivity(
      c,
      [],
      [body.activity_id],
      [...resEntityMaterialIds, dataEntityMaterial?.id ?? 0]
    )
  }

  #createWithoutKFA = async (
    c: Context,
    dataEntityMaterial: SelectEntityMaterialDTO,
    body: CreateEntityMaterialRequest
  ) => {
    const userID = c.var.userId
    const cudDefault: Omit<CudDTO, "deleted_by"> = {
      created_by: userID ?? 0,
      created_at: new Date(),
      updated_by: userID ?? 0,
      updated_at: new Date(),
      deleted_at: null,
    }
    const entityMaterialActivity =
      await this.entityMaterialRepo.getEntityMaterialActivity(
        c,
        [],
        [body.activity_id],
        [dataEntityMaterial?.id ?? 0],
        true
      )

    if (entityMaterialActivity.length === 0) {
      await this.entityMaterialRepo.createEntityMaterialActivity(c, {
        entity_master_material_id: Number(dataEntityMaterial?.id),
        activity_id: Number(body.activity_id),
        consumption_rate: body.consumption_rate ?? 0,
        retailer_price: body.retailer_price ?? 0,
        tax: body.tax ?? 0,
        min: body.min ?? 0,
        max: body.max ?? 0,
        allocated: 0,
        stock_on_hand: 0,
        ...cudDefault,
      })
    } else if (
      entityMaterialActivity.length > 0 &&
      entityMaterialActivity[0]?.deleted_at
    ) {
      await this.entityMaterialRepo.updateEntityMaterialActivity(
        c,
        entityMaterialActivity[0].id,
        {
          min: body.min,
          max: body.max,
          consumption_rate: body.consumption_rate,
          retailer_price: body.retailer_price,
          tax: body.tax,
          ...cudDefault,
        }
      )
    } else {
      throw new ValidationError("Activity already exist")
    }

    return this.entityMaterialRepo.getEntityMaterialActivity(
      c,
      [],
      [body.activity_id],
      [dataEntityMaterial?.id ?? 0]
    )
  }

  async create(c: Context, body: CreateEntityMaterialRequest) {
    const userId = c.var.userId
    const entityMaterialId = body.entityMaterialId ?? 0
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled || false

    let response = {}
    let dataEntityMaterial: SelectEntityMaterialDTO
    if (entityMaterialId === 0) {
      await this.entityMaterialRepo.createEntityMaterial(c, {
        ...DEFAULT_DATA_ENTITY_MATERIAL,
        entity_id: Number(body.entity_id),
        master_material_id: Number(body.master_material_id),
        created_by: userId,
        created_at: new Date(),
        updated_by: userId,
        updated_at: new Date(),
      })
      dataEntityMaterial =
        await this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
          c,
          body.entity_id,
          body.master_material_id
        )
    } else {
      dataEntityMaterial = { id: entityMaterialId }
    }

    if (!isKFAEnabled) {
      response = await this.#createWithoutKFA(c, dataEntityMaterial, body)
    } else {
      await this.#createWithoutKFA(c, dataEntityMaterial, body)
      response = await this.#createWithKFA(c, dataEntityMaterial, body)
    }

    return response[0]
  }

  #deleteWithoutKfa = async (
    c: Context,
    dataEmma: EntityMasterMaterialActivitiesDTO[]
  ) => {
    const userId = c.var.userId ?? 0
    const deletedNull = { deleted_at: new Date(), deleted_by: userId }

    const dataEhmm = await this.entityMaterialRepo.findDynamicEntityMaterial(
      c,
      "id",
      "=",
      dataEmma[0]?.entity_master_material_id ?? 0,
      true
    )

    const emmaExists =
      await this.entityMaterialRepo.findDynamicEntityMaterialActivity(
        c,
        "entity_master_material_id",
        "=",
        dataEhmm[0]?.id ?? 0
      )

    if (emmaExists.length === 0) {
      await this.entityMaterialRepo.updateEntityMaterial(
        c,
        Number(dataEhmm[0]?.id),
        deletedNull
      )
    }

    return dataEmma[0]
  }

  #deleteWithKfa = async (
    c: Context,
    dataEmma: EntityMasterMaterialActivitiesDTO[]
  ) => {
    const userId = c.var.userId ?? 0
    const deletedNull = { deleted_at: new Date(), deleted_by: userId }

    const dataEhmm = await this.entityMaterialRepo.findDynamicEntityMaterial(
      c,
      "id",
      "=",
      dataEmma[0]?.entity_master_material_id ?? 0,
      true
    )

    const entityMaterialActivities =
      await this.entityMaterialRepo.getEntityMaterialActivityWithEntityIdAndParentMaterialId(
        c,
        dataEhmm[0]?.entity_id ?? 0,
        dataEmma[0]?.activity_id ?? 0,
        [dataEhmm[0]?.master_material_id ?? 0]
      )

    const ehmmId = entityMaterialActivities.map((emma) => emma.ehmm_id)
    ehmmId.push(dataEhmm[0]?.id ?? 0)

    await Promise.all(
      entityMaterialActivities.map(async (emma) => {
        return this.entityMaterialRepo.updateEntityMaterialActivity(
          c,
          emma.emma_id,
          {
            deleted_at: new Date(),
          }
        )
      })
    )

    if (ehmmId.length !== 0) {
      const emmaExists =
        await this.entityMaterialRepo.findDynamicEntityMaterialActivity(
          c,
          "entity_master_material_id",
          "in",
          ehmmId.filter((id) => id !== null)
        )

      const ehmmIdExists = collect(emmaExists, "entity_master_material_id")
      const ehmmDifferences = differ(ehmmId, ehmmIdExists)

      await Promise.all(
        ehmmDifferences.map(async (id) => {
          return this.entityMaterialRepo.updateEntityMaterial(c, id ?? 0, {
            ...deletedNull,
          })
        })
      )
    }

    return dataEmma[0]
  }

  async delete(c: Context, params: DeleteEntityMaterialsParams) {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled || false

    const dataEmma =
      await this.entityMaterialRepo.findDynamicEntityMaterialActivity(
        c,
        "id",
        "=",
        params.entityMasterMaterialActivityId,
        true
      )

    await this.entityMaterialRepo.updateEntityMaterialActivity(
      c,
      params.entityMasterMaterialActivityId,
      {
        deleted_at: new Date(),
      }
    )

    if (isKFAEnabled) {
      return await this.#deleteWithKfa(c, dataEmma)
    } else {
      return await this.#deleteWithoutKfa(c, dataEmma)
    }
  }

  async update(
    c: Context,
    body: UpdateEntityMaterialRequest,
    param: GetEntityMaterialsParams
  ) {
    const entityId = param.entityId
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled || false
    const userId = c.var.userId ?? 0

    const [response] = await Promise.all([
      this.entityMaterialRepo.findDynamicEntityMaterialActivity(
        c,
        "id",
        "=",
        body.entity_master_material_activities_id
      ),
      this.entityMaterialRepo.updateEntityMaterialActivity(
        c,
        body.entity_master_material_activities_id,
        {
          consumption_rate: body.consumption_rate,
          retailer_price: body.retailer_price,
          tax: body.tax,
          min: body.min,
          max: body.max,
          updated_by: userId,
          updated_at: new Date(),
        }
      ),
    ])

    if (!isKFAEnabled) return response[0]

    const ehmmChild =
      await this.entityMaterialRepo.getEntityMaterialWithEntityIdAndParentMaterialId(
        c,
        entityId,
        body.master_material_id
      )

    const ehmmChildId = collect(ehmmChild, "ehmm_id")
    const emma =
      await this.entityMaterialRepo.findDynamicEntityMaterialActivity(
        c,
        "entity_master_material_id",
        "in",
        ehmmChildId
      )
    const emmaIds = collect(emma, "id")
    await Promise.all(
      emmaIds.map(async (id) => {
        this.entityMaterialRepo.updateEntityMaterialActivity(c, id, {
          consumption_rate: body.consumption_rate,
          retailer_price: body.retailer_price,
          tax: body.tax,
          min: body.min,
          max: body.max,
          updated_by: userId,
          updated_at: new Date(),
        })
      })
    )

    return response[0]
  }
}
