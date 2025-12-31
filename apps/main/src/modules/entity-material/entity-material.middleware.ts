import { ValidationError } from "@smile/lib/error.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { ActivityRepository } from "../activity/activity.repository.js"
import { EntityMaterialRepository } from "./entity-material.repository.js"
import {
  CreateSchema,
  DetailSchema,
  UpdateSchema,
} from "./entity-material.schema.js"

export class EntityMaterialMiddleware {
  constructor(
    private readonly repository: EntityMaterialRepository,
    private readonly activityRepo: ActivityRepository
  ) {}

  readonly #isEntityIdExist = async (c: Context, id: string) => {
    const exists = await this.repository.findDynamicEntity<string>(
      c,
      "id",
      "=",
      id
    )
    if (exists.length === 0) {
      throw new ValidationError(
        c.var.t("validator.not_exist", { field: "entity" })
      )
    }
  }

  readonly #isEntityMaterialActivityExist = async (
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
        c.get("programId"),
        withDeleted
      )
    if (exists.length === 0) {
      throw new ValidationError(
        c.var.t("validator.not_exist", {
          field: c.var.t("entity_material.label.entity_material_activity"),
        })
      )
    }
  }

  readonly #isInOrderOrTransaction = async (
    c: Context,
    entityId: number,
    materialIds: number[],
    activityId: number
  ) => {
    const [countActiveOrder, countActiveTransaction] = await Promise.all([
      this.repository.getEntityMaterialActiveOrder(
        c,
        entityId,
        materialIds,
        c.get("programId"),
        activityId
      ),
      this.repository.getEntityMaterialActiveTransaction(
        c,
        entityId,
        c.get("programId"),
        materialIds,
        activityId
      ),
    ])

    if (countActiveOrder.total) {
      throw new ValidationError(c.var.t("validator.delete_active_order"))
    } else if (countActiveTransaction.total) {
      throw new ValidationError(c.var.t("validator.delete_has_transaction"))
    }
  }

  readonly #getEmmaAndEhmm = async (c: Context, id: string) => {
    const emma =
      await this.repository.findDynamicEntityMaterialActivity<string>(
        c,
        "id",
        "=",
        id,
        c.get("programId"),
        true
      )
    return emma
  }

  readonly #isActiveOrderExist = async (c: Context, id: string) => {
    const emma = await this.#getEmmaAndEhmm(c, id)
    if (emma.length === 0) {
      return
    }
    await this.#isInOrderOrTransaction(
      c,
      Number(emma[0]?.entity_id),
      [Number(emma[0]?.material_id)],
      emma[0]?.activity_id ?? 0
    )
  }

  readonly #isActiveOrderExistWithKfa = async (c: Context, id: string) => {
    const emma = await this.#getEmmaAndEhmm(c, id)
    const emmaChild =
      await this.repository.getEntityMaterialWithEntityIdAndParentMaterialId(
        c,
        Number(emma[0]?.entity_id),
        Number(emma[0]?.material_id),
        c.get("programId")
      )
    const ehmmChildMaterialIds = collect(emmaChild, "material_id")
    if (ehmmChildMaterialIds.length === 0) {
      ehmmChildMaterialIds.push(Number(emma[0]?.material_id))
    }
    await this.#isInOrderOrTransaction(
      c,
      Number(emma[0]?.entity_id),
      ehmmChildMaterialIds,
      emma[0]?.activity_id ?? 0
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

  readonly #isNotExist = (ctx, state: boolean, path: string) => {
    if (state) {
      ctx.addIssue({
        code: "custom",
        message: "validator.not_exist",
        path: [path],
      })
    }
  }

  readonly #isExistEmma = async (c: Context, data) => {
    const entityMaterialActivity =
      await this.repository.getEntityMaterialActivity(
        c,
        [],
        [data.activity_id],
        [data.entityMaterialId],
        c.get("programId"),
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

  create = (c: Context) => {
    const entityId = Number(c.req.param("entityId"))
    return CreateSchema.superRefine(async (data, ctx) => {
      const [entities, materials, activityExist, materialHasActivity] =
        await Promise.all([
          this.repository.findDynamicEntity<number[]>(c, "id", "in", [
            entityId,
            data.entity_id,
          ]),
          this.repository.findDynamicMaterial<number[]>(
            c,
            "id",
            "=",
            [data.material_id],
            c.get("programId")
          ),
          this.activityRepo.findById(c, data.activity_id, c.get("programId")),
          this.repository.getMaterialHasActivity(
            c,
            [data.activity_id],
            [data.material_id],
            c.get("programId")
          ),
        ])
      const entitieIds = collect(entities, "id")
      console.log("data", materialHasActivity)

      if (entityId !== data.entity_id) {
        ctx.addIssue({
          code: "custom",
          message: c.var.t("entity_material.label.same_entity"),
          path: ["entity_id"],
        })
      }

      this.#isNotExist(ctx, !entitieIds.includes(data.entity_id), "entity_id")
      this.#isNotExist(ctx, !entitieIds.includes(entityId), "param_entity_id")
      this.#isNotExist(ctx, !materials.length, "material_id")
      this.#isNotExist(ctx, !activityExist, "activity_id")

      if (!materialHasActivity.length) {
        throw new ValidationError(
          c.var.t("validator.not_exist", {
            field: c.var.t("entity_material.label.material_activity"),
          })
        )
      }

      const emma =
        await this.repository.getEntityMaterialsByEntityIDandMaterialID(
          c,
          c.get("programId"),
          data.entity_id,
          data.material_id,
          data.activity_id
        )

      data.entityMaterialId = emma?.id
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
        // entityMaterialExist,
      ] = await Promise.all([
        this.repository.findDynamicEntity<number[]>(c, "id", "in", [
          entityId,
          data.entity_id,
        ]),
        this.repository.findDynamicMaterial<number[]>(
          c,
          "id",
          "=",
          [data.material_id],
          c.get("programId")
        ),
        this.activityRepo.findById(c, data.activity_id, c.get("programId")),
        this.repository.findDynamicEntityMaterialActivity<number>(
          c,
          "id",
          "=",
          data.entity_master_material_activities_id,
          c.get("programId")
        ),
        // this.repository.findDynamicEntityMaterial<number>(
        //   c,
        //   "id",
        //   "=",
        //   data.entity_material_id,
        //   true
        // ),
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
          path: ["material_id"],
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
    })
  }
}
