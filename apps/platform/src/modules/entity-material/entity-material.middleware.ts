import { DEFAULT_DATA_ENTITY_MATERIAL } from "@/common/constants/entity-material.js"
import { ValidationError } from "@smile/lib/error.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { ActivityRepository } from "../activity/activity.repository.js"
import { EntityMaterialRepository } from "./entity-material.repository.js"
import {
  CreateSchema,
  DetailSchema,
  EntityMaterialDTO,
  UpdateSchema,
} from "./entity-material.schema.js"

export class EntityMaterialMiddleware {
  constructor(
    private readonly repository: EntityMaterialRepository,
    private readonly activityRepo: ActivityRepository
  ) {}

  #isEntityIdExist = async (c: Context, id: string) => {
    const exists = await this.repository.findDynamicEntity<string>(
      c,
      "id",
      "=",
      id
    )
    if (exists.length === 0) {
      throw new ValidationError("Entity ID not found")
    }
  }

  #isEntityMaterialActivityExist = async (
    c: Context,
    id: string,
    withDeleted: boolean = true
  ) => {
    const exists =
      await this.repository.findDynamicEntityMaterialActivity<string>(
        c,
        "id",
        "=",
        id,
        withDeleted
      )
    if (exists.length === 0) {
      throw new ValidationError("Entity Material Activity ID not found")
    }
  }

  #isInOrderOrTransaction = async (
    c: Context,
    entityId: number,
    materialIds: number[]
  ) => {
    const [countActiveOrder, countActiveTransaction] = await Promise.all([
      this.repository.getEntityMaterialActiveOrder(c, entityId, materialIds),
      this.repository.getEntityMaterialActiveTransaction(
        c,
        entityId,
        materialIds
      ),
    ])

    if (countActiveOrder.total) {
      throw new ValidationError("Data have active order, cannot be deleted")
    } else if (countActiveTransaction.total) {
      throw new ValidationError("Data is in transaction, cannot be deleted")
    }
  }

  #getEmmaAndEhmm = async (c: Context, id: string) => {
    const emma =
      await this.repository.findDynamicEntityMaterialActivity<string>(
        c,
        "id",
        "=",
        id,
        true
      )
    const ehmm = await this.repository.findDynamicEntityMaterial<number>(
      c,
      "id",
      "=",
      emma[0]?.entity_master_material_id ?? 0,
      true
    )
    return ehmm
  }

  #isActiveOrderExist = async (c: Context, id: string) => {
    const ehmm = await this.#getEmmaAndEhmm(c, id)
    await this.#isInOrderOrTransaction(c, Number(ehmm[0]?.entity_id), [
      Number(ehmm[0]?.master_material_id),
    ])
  }

  #isActiveOrderExistWithKfa = async (c: Context, id: string) => {
    const ehmm = await this.#getEmmaAndEhmm(c, id)
    const ehmmChild =
      await this.repository.getEntityMaterialWithEntityIdAndParentMaterialId(
        c,
        Number(ehmm[0]?.entity_id),
        Number(ehmm[0]?.master_material_id)
      )
    const ehmmChildMaterialIds = collect(ehmmChild, "id")
    await this.#isInOrderOrTransaction(
      c,
      Number(ehmm[0]?.entity_id),
      ehmmChildMaterialIds
    )
  }

  list = (c: Context) => {
    return DetailSchema.superRefine(async (data, ctx) => {
      const exists = await this.repository.findDynamicEntity<number>(
        c,
        "id",
        "=",
        data.entityId
      )
      if (exists.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "validator.not_exist",
          path: ["entity_id"],
        })
      }
    })
  }

  #isNotExist = (ctx, state: boolean, path: string) => {
    if (state) {
      ctx.addIssue({
        code: "custom",
        message: "validator.not_exist",
        path: [path],
      })
    }
  }

  #isExistEmma = async (c: Context, data) => {
    const entityMaterialActivity =
      await this.repository.getEntityMaterialActivity(
        c,
        [],
        [data.activity_id],
        [data.entityMaterialId ?? 0],
        true
      )

    if (
      entityMaterialActivity.length > 0 &&
      !entityMaterialActivity[0]?.deleted_at
    ) {
      throw new ValidationError(
        c.var.t("validator.exist", {
          field: c.var.t("entity_material.label.entity_material_activity"),
        })
      )
    }
  }

  #isExistEhmm = async (c, ehmm, emma, data, materialHasActivity) => {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled || false
    const userID = c.var.userId
    if (ehmm) {
      if (ehmm.deleted_at) {
        const updateEntityMaterial: EntityMaterialDTO = {
          ...DEFAULT_DATA_ENTITY_MATERIAL,
          entity_id: data.entity_id,
          master_material_id: data.master_material_id,
          created_at: new Date(),
          created_by: userID,
          updated_at: new Date(),
          updated_by: userID,
          deleted_at: null,
          deleted_by: null,
        }
        await this.repository.updateEntityMaterial(
          c,
          ehmm.id,
          updateEntityMaterial
        )
      } else if (
        (isKFAEnabled && !emma) ||
        (!isKFAEnabled && emma && !emma.emma_deleted_at)
      ) {
        if (!materialHasActivity.length) {
          throw new ValidationError(
            c.var.t("validator.exist", {
              field: c.var.t("entity_material.label.entity_material"),
            })
          )
        }
      }
    }
  }

  create = (c: Context) => {
    const entityId = Number(c.req.param("entityId"))
    return CreateSchema.superRefine(async (data, ctx) => {
      const [entities, materials, activityExist, materialHasActivity] =
        await Promise.all([
          this.repository.findDynamicEntity<number[]>(c, "id", "in", [
            entityId,
            data.entity_id,
          ]),
          this.repository.findDynamicMaterial<number[]>(c, "id", "=", [
            data.master_material_id,
          ]),
          this.activityRepo.findById(c, data.activity_id),
          this.repository.getMaterialHasActivity(
            c,
            [data.activity_id],
            [data.master_material_id]
          ),
        ])
      const entitieIds = collect(entities, "id")

      if (entityId !== data.entity_id) {
        ctx.addIssue({
          code: "custom",
          message: c.var.t("entity_material.label.same_entity"),
          path: ["entity_id"],
        })
      }

      this.#isNotExist(ctx, !entitieIds.includes(data.entity_id), "entity_id")
      this.#isNotExist(ctx, !entitieIds.includes(entityId), "param_entity_id")
      this.#isNotExist(ctx, !materials.length, "master_material_id")
      this.#isNotExist(ctx, !activityExist, "activity_id")

      if (!materialHasActivity.length) {
        throw new ValidationError(
          c.var.t("validator.not_exist", {
            field: c.var.t("entity_material.label.material_activity"),
          })
        )
      }

      //is entity material id exist
      const [ehmm, emma] = await Promise.all([
        this.repository.getEntityMaterialsByEntityIDandMaterialID(
          c,
          data.entity_id,
          data.master_material_id,
          data.activity_id
        ),
        this.repository.getEntityMaterialsByEntityIDandMaterialID(
          c,
          data.entity_id,
          data.master_material_id,
          data.activity_id,
          true
        ),
      ])

      await this.#isExistEhmm(c, ehmm, emma, data, materialHasActivity)
      data.entityMaterialId = ehmm?.id
      await this.#isExistEmma(c, data)
    })
  }

  delete = createMiddleware(async (c, next) => {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled || false
    const entityId = c.req.param("entityId")
    const entityMasterMaterialActivityId = c.req.param(
      "entityMasterMaterialActivityId"
    )
    await Promise.all([
      this.#isEntityIdExist(c, entityId ?? "0"),
      this.#isEntityMaterialActivityExist(
        c,
        entityMasterMaterialActivityId ?? "0",
        false
      ),
    ])

    if (isKFAEnabled) {
      await this.#isActiveOrderExistWithKfa(
        c,
        entityMasterMaterialActivityId ?? "0"
      )
    } else {
      await this.#isActiveOrderExist(c, entityMasterMaterialActivityId ?? "0")
    }
    await next()
  })

  update = (c: Context) => {
    const entityId = Number(c.req.param("entityId"))
    return UpdateSchema.superRefine(async (data, ctx) => {
      const [
        entities,
        materials,
        activityExist,
        entityMaterialActivityExist,
        entityMaterialExist,
      ] = await Promise.all([
        this.repository.findDynamicEntity<number[]>(c, "id", "in", [
          entityId,
          data.entity_id,
        ]),
        this.repository.findDynamicMaterial<number[]>(c, "id", "=", [
          data.master_material_id,
        ]),
        this.activityRepo.findById(c, data.activity_id),
        this.repository.findDynamicEntityMaterialActivity<number>(
          c,
          "id",
          "=",
          data.entity_master_material_activities_id
        ),
        this.repository.findDynamicEntityMaterial<number>(
          c,
          "id",
          "=",
          data.entity_master_material_id,
          true
        ),
      ])
      const entitieIds = collect(entities, "id")

      if (entityId !== data.entity_id) {
        ctx.addIssue({
          code: "custom",
          message: c.var.t("entity_material.label.same_entity"),
          path: ["entity_id"],
        })
      }

      if (!entitieIds.includes(data.entity_id)) {
        ctx.addIssue({
          code: "custom",
          message: "validator.not_exist",
          path: ["entity_id"],
        })
      }

      if (!entitieIds.includes(entityId)) {
        ctx.addIssue({
          code: "custom",
          message: "validator.not_exist",
          path: ["param_entity_id"],
        })
      }

      if (!materials.length) {
        ctx.addIssue({
          code: "custom",
          message: "validator.not_exist",
          path: ["master_material_id"],
        })
      }

      if (!activityExist) {
        ctx.addIssue({
          code: "custom",
          message: "validator.not_exist",
          path: ["activity_id"],
        })
      }

      if (!entityMaterialActivityExist.length) {
        ctx.addIssue({
          code: "custom",
          message: "validator.not_exist",
          path: ["entity_master_material_activities_id"],
        })
      }

      if (!entityMaterialExist.length) {
        ctx.addIssue({
          code: "custom",
          message: "validator.not_exist",
          path: ["entity_master_material_id"],
        })
      }

      if (
        entityMaterialActivityExist[0]?.entity_master_material_id !==
        data.entity_master_material_id
      ) {
        ctx.addIssue({
          code: "custom",
          message: c.var.t("entity_material.label.same_entity_master_material"),
          path: ["entity_master_material_id"],
        })
      }
    })
  }
}
