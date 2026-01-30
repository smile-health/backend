import { ValidationError } from "@smile-health/lib/error.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { collect, group, pick } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { ActivityRepository } from "../activity/activity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { StockRepository } from "../stock/stock.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { EntityMaterialPublisher } from "./entity-material.publisher.js"
import { EntityMaterialRepository } from "./entity-material.repository.js"
import {
  CreateEntityMaterialRequest,
  DeleteEntityMaterialsParams,
  GetEntityMaterialsParams,
  GetEntityMaterialsQueries,
  SelectEntityMaterialDTO,
  UpdateEntityMaterialRequest,
} from "./entity-material.schema.js"

export class EntityMaterialModule {
  constructor(
    private readonly entityMaterialRepo: EntityMaterialRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly userRepo: UserRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly stockRepo: StockRepository,
    private readonly publisher: EntityMaterialPublisher
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
        c.get("programId"),
        isKFAEnabled
      )

    if (data.length === 0) return new PaginatedResponse(query)
    const ehmm = await this.entityMaterialRepo.findAll(
      c,
      query,
      param,
      data.map((res) => res.material_id).filter((id) => id !== null),
      c.get("programId"),
      isKFAEnabled
    )

    const activityIDs = collect(ehmm, "activity_id")
    const userIDs = collect(ehmm, "updated_by")
    const materialIDs = collect(ehmm, "material_id")
    const entityMaterialIds = collect(ehmm, "id")
    const [
      mapActivities,
      mapUsers,
      mapMaterials,
      mapEntitiyMaterials,
      mapMaterialCompanion,
    ] = await Promise.all([
      this.activityRepo.getActivityMapped(c, activityIDs),
      this.userRepo.getBasicDetailMapped(c, userIDs),
      this.materialRepo.getMaterialMapped(c, materialIDs),
      this.entityMaterialRepo.getMaterialEntityMapped(
        c,
        entityMaterialIds,
        materialIDs,
        c.get("programId")
      ),
      this.materialRepo.findMaterialCompanionsGroup(c, materialIDs),
    ])

    const ehmmMap = ehmm.map((res) => ({
      ...res,
      ...mapMaterials[res.material_id ?? 0],
      material_companions: mapMaterialCompanion[res.material_id ?? 0]
        ? mapMaterialCompanion[res.material_id ?? 0]?.map((comp) => ({
            ...pick(comp, ["id", "name"]),
          }))
        : [],
      entity_master_material: mapEntitiyMaterials[res.id ?? 0],
      activity: mapActivities[res.activity_id ?? 0],
      user_updated_by: mapUsers[res.updated_by ?? 0],
      entity_master_material_activities_id: res.id,
      created_at: res.created_at,
      updated_at: res.updated_at,
    }))
    const ehmmGroup = group(ehmmMap, "material_id")
    const list = data.map((res) => ({
      ...res,
      entity_master_materials: ehmmGroup[res.material_id ?? 0],
    }))

    return new PaginatedResponse(query, list, total)
  }

  readonly #createWithoutKFA = async (
    c: Context,
    dataEntityMaterial: SelectEntityMaterialDTO,
    body: CreateEntityMaterialRequest
  ) => {
    const userID = c.var.userId
    const cudDefault = {
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
        c.get("programId"),
        true
      )

    if (entityMaterialActivity.length === 0) {
      const emma = {
        entity_id: Number(body.entity_id),
        material_id: Number(body.material_id),
        activity_id: Number(body.activity_id),
        consumption_rate: body.consumption_rate,
        retailer_price: body.retailer_price,
        tax: body.tax,
        min: body.min,
        max: body.max,
        ...cudDefault,
      }

      await Promise.all([
        this.entityMaterialRepo.createEntityMaterial(c, emma).then((res) => {
          return this.publisher.processCreate(c, {
            id: Number(res[0]?.insertId),
            program_id: c.var.programId,
            is_hierarchy: c.var.config?.material.is_hierarchy_enabled,
            ...emma,
          })
        }),
        this.entityMaterialRepo.updateUserAndDateEntity(
          c,
          Number(body.entity_id),
          {
            updated_at: new Date(),
            updated_by: userID,
          }
        ),
      ])
    } else if (
      entityMaterialActivity.length > 0 &&
      entityMaterialActivity[0]?.deleted_at
    ) {
      await Promise.all([
        this.entityMaterialRepo.updateEntityMaterialActivity(
          c,
          entityMaterialActivity[0].id,
          {
            min: body.min,
            max: body.max,
            consumption_rate: body.consumption_rate,
            retailer_price: body.retailer_price,
            tax: body.tax,
            updated_at: new Date(),
            updated_by: userID,
            deleted_at: null,
            deleted_by: null,
          }
        ),
        this.entityMaterialRepo.updateUserAndDateEntity(
          c,
          Number(body.entity_id),
          {
            updated_at: new Date(),
            updated_by: userID,
          }
        ),
      ])
    } else {
      throw new ValidationError("Activity already exist")
    }

    return await this.entityMaterialRepo.getEntityMaterialActivities(
      c,
      body.entity_id,
      body.material_id,
      body.activity_id,
      c.get("programId")
    )
  }

  async create(c: Context, body: CreateEntityMaterialRequest) {
    // const userId = c.var.userId
    const entityMaterialId = body.entityMaterialId ?? 0
    let dataEntityMaterial: SelectEntityMaterialDTO
    if (entityMaterialId === 0) {
      dataEntityMaterial =
        await this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
          c,
          c.get("programId"),
          body.entity_id,
          body.material_id
        )
    } else {
      dataEntityMaterial = { id: entityMaterialId }
    }

    return await this.#createWithoutKFA(c, dataEntityMaterial, body)
  }

  async delete(c: Context, params: DeleteEntityMaterialsParams) {
    const userId = c.var.userId ?? 0
    await this.entityMaterialRepo.updateEntityMaterialActivity(
      c,
      params.entityMasterMaterialActivityId,
      {
        deleted_at: new Date(),
        deleted_by: userId,
      }
    )

    return true
  }

  async update(c: Context, body: UpdateEntityMaterialRequest) {
    const userId = c.var.userId ?? 0
    const updateData = {
      min: body.min,
      max: body.max,
      consumption_rate: body.consumption_rate,
      retailer_price: body.retailer_price,
      tax: body.tax,
      updated_at: new Date(),
      updated_by: userId,
    }

    await Promise.all([
      this.entityMaterialRepo
        .updateEntityMaterialActivity(
          c,
          body.entity_master_material_activities_id,
          updateData
        )
        .then(() => {
          return this.publisher.processUpdate(c, {
            id: body.entity_master_material_activities_id,
            program_id: c.var.programId,
            activity_id: body.activity_id,
            is_hierarchy: c.var.config?.material.is_hierarchy_enabled,
            ...updateData,
          })
        }),
      this.entityMaterialRepo.updateUserAndDateEntity(
        c,
        Number(body.entity_id),
        {
          updated_at: new Date(),
          updated_by: userId,
        }
      ),
    ])

    return await this.entityMaterialRepo.findDynamicEntityMaterialActivity(
      c,
      "id",
      "=",
      body.entity_master_material_activities_id,
      c.get("programId")
    )
  }
}
