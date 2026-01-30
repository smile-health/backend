import { DB } from "@/common/infrastructure/database/types/db.js"
import { collect, differ } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { ComparisonOperatorExpression, ReferenceExpression, sql } from "kysely"
import { CreateBudgetSourceWorkspaceRequest } from "../budget-source/budget-source.schema.js"
import { EntityWorkspace } from "../entity/entity.schema.js"
import { ManufactureWorkspaceCreateRequestDTO } from "../manufacture/manufacture.schema.js"
import { CreateMaterialWorkSpaceRequest } from "../material/material.schema.js"
import { TCreateUserWorkspaceSchema } from "../user/user.schema.js"
import { GetWorkspacesParams, TableWorkspaces } from "./workspace.schema.js"

export class WorkspaceRepository {
  async findAll(c: Context, queryParam: GetWorkspacesParams) {
    let query = c.var.trx.selectFrom("workspaces")

    if (queryParam.keyword) {
      query = query.where((eb) =>
        eb.or([
          eb("key", "like", `%${queryParam.keyword}%`),
          eb("name", "like", `%${queryParam.keyword}%`),
        ])
      )
    }

    if (
      queryParam.is_material_hierarchy_enabled === 1 ||
      queryParam.is_material_hierarchy_enabled === 0
    ) {
      const isHierarchyEnabled = queryParam.is_material_hierarchy_enabled
        ? true
        : false
      query = query.where(
        sql<boolean>`JSON_EXTRACT(config, '$.material.is_hierarchy_enabled')`,
        "=",
        isHierarchyEnabled
      )
    }

    const isPaginate = queryParam.page && queryParam.paginate ? true : false
    const offset = (queryParam.page - 1) * queryParam.paginate

    const [workspaces, count] = await Promise.all([
      query
        .$if(isPaginate, (qb) => qb.limit(queryParam.paginate).offset(offset))
        .selectAll()
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: workspaces,
      total: count.total,
    }
  }

  async findAllDynamic<T>(
    c: Context,
    field: ReferenceExpression<DB, "workspaces">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const result = await c.var.trx
      .selectFrom("workspaces")
      .where(field, operator, value)
      .selectAll()
      .execute()

    return result
  }

  async findAllByIds(c: Context, workspaceIDs: number[]) {
    return await c.var.trx
      .selectFrom("workspaces")
      .where("id", "in", workspaceIDs)
      .selectAll()
      .execute()
  }

  async findById(c: Context, id: number) {
    const result = await c.var.trx
      .selectFrom("workspaces")
      .where("id", "=", id)
      .selectAll()
      .executeTakeFirst()

    return result
  }

  async getByFromMappedWorkspace(
    c: Context,
    from: string,
    ids: number | number[]
  ) {
    const { client, trx } = c.var

    if (typeof ids === "number") ids = [ids]
    if (!ids || ids.length === 0) return {}
    const workspaces = await trx
      .selectFrom("workspaces as w")
      .$if(!!client, (qb) =>
        qb.innerJoin("integration_associations as a", (join) =>
          join
            .onRef("a.internal_id", "=", "w.id")
            .on("a.client_id", "=", client!.getId())
            .on("a.type", "=", "program")
        )
      )
      .$if(from == "user", (qb) =>
        qb
          .innerJoin("user_workspaces as uw", "w.id", "uw.workspace_id")
          .innerJoin("users as u", "u.id", "uw.user_id")
          .innerJoin("entity_workspaces as ew", (join) =>
            join
              .onRef("ew.entity_id", "=", "u.entity_id")
              .onRef("ew.workspace_id", "=", "uw.workspace_id")
          )
          .leftJoin("manufacture_workspaces as mw", (join) =>
            join
              .onRef("mw.manufacture_id", "=", "u.manufacture_id")
              .onRef("mw.workspace_id", "=", "uw.workspace_id")
          )
          .where("u.id", "in", ids)
          .where("w.deleted_at", "is", null)
          .where("uw.deleted_at", "is", null)
          .select([
            "w.id",
            "w.key",
            "w.name",
            "w.config",
            "w.is_beneficiaries",
            "uw.status",
            "uw.user_id",
            "ew.id as entity_id",
            "mw.id as manufacture_id",
          ])
      )
      .$if(from == "entity", (qb) =>
        qb
          .innerJoin("entity_workspaces as ew", "ew.workspace_id", "w.id")
          .where("ew.entity_id", "in", ids)
          .select([
            "w.id",
            "key",
            "name",
            "ew.entity_id",
            "ew.id as entity_program_id",
            "config",
            "w.is_beneficiaries",
          ])
      )
      .$if(from == "budget_source", (qb) =>
        qb
          .innerJoin(
            "budget_source_workspaces as sbw",
            "sbw.workspace_id",
            "w.id"
          )
          .where("sbw.budget_source_id", "in", ids)
          .select([
            "w.id",
            "key",
            "name",
            "sbw.budget_source_id",
            "sbw.id as budget_source_program_id",
            "config",
            "w.is_beneficiaries",
          ])
      )
      .$if(from == "manufacture", (qb) =>
        qb
          .innerJoin("manufacture_workspaces as mw", "mw.workspace_id", "w.id")
          .where("mw.manufacture_id", "in", ids)
          .select([
            "w.id",
            "key",
            "name",
            "mw.manufacture_id",
            "mw.id as manufacture_program_id",
            "config",
            "w.is_beneficiaries",
          ])
      )
      .$if(from == "material", (qb) =>
        qb
          .innerJoin("material_workspaces as mw", "mw.workspace_id", "w.id")
          .where("mw.material_id", "in", ids)
          .where("mw.deleted_at", "is", null)
          .select([
            "w.id",
            "key",
            "name",
            "mw.material_id",
            "mw.id as material_program_id",
            "config",
            "w.is_beneficiaries",
          ])
      )
      .$if(from == "asset_inventory", (qb) =>
        qb
          .innerJoin(
            "asset_inventory_workspaces as aiw",
            "aiw.workspace_id",
            "w.id"
          )
          .where("aiw.asset_inventory_id", "in", ids)
          .where("aiw.status", "=", 1)
          .select([
            "w.id",
            "key",
            "name",
            "aiw.asset_inventory_id",
            "aiw.id as asset_inventory_program_id",
            "config",
            "w.is_beneficiaries",
          ])
      )
      .where("w.deleted_at", "is", null)
      .execute()

    return workspaces.reduce((mapWorkspace, workspace) => {
      if (!mapWorkspace[workspace[`${from}_id`]]) {
        mapWorkspace[workspace[`${from}_id`]] = []
      }
      mapWorkspace[workspace[`${from}_id`]].push(workspace)
      return mapWorkspace
    }, {})
  }

  async attachWithAssetInventoryID(
    c: Context,
    assetInventoryId: number,
    programIds?: number[]
  ) {
    if (!programIds || c.var.client) return

    await c.var.trx
      .updateTable("asset_inventory_workspaces")
      .set({
        status: c.var.trx
          .case()
          .when("workspace_id", "in", programIds.length > 0 ? programIds : [-1])
          .then(1)
          .else(0)
          .end(),
      })
      .where("asset_inventory_id", "=", assetInventoryId)
      .execute()

    const wsAssetInventories = await c.var.trx
      .selectFrom("asset_inventory_workspaces")
      .where("asset_inventory_id", "=", assetInventoryId)
      .where("workspace_id", "in", programIds.length > 0 ? programIds : [-1])
      .select(["id", "workspace_id", "asset_inventory_id"])
      .execute()

    const programIdsExist =
      wsAssetInventories.length > 0
        ? collect(wsAssetInventories, "workspace_id")
        : []
    const programIdsDiffer = differ(programIds, programIdsExist)

    const dataDiffer: {
      asset_inventory_id: number
      workspace_id: number
    }[] = []
    programIdsDiffer.forEach((programId) => {
      dataDiffer.push({
        asset_inventory_id: assetInventoryId,
        workspace_id: programId,
      })
    })

    if (dataDiffer.length === 0) return

    await c.var.trx
      .insertInto("asset_inventory_workspaces")
      .values(dataDiffer)
      .execute()
  }

  async attachWithEntityID(c: Context, entityId: number, programIds: number[]) {
    if (programIds.length === 0 || c.var.client) return

    const wsMaterials = await c.var.trx
      .selectFrom("ws_entities")
      .where("global_id", "=", entityId)
      .where("program_id", "in", programIds)
      .select(["id", "program_id", "global_id"])
      .execute()

    const programIdsExist =
      wsMaterials.length > 0 ? collect(wsMaterials, "program_id") : []
    const programIdsDiffer = differ(programIds, programIdsExist)

    const dataDiffer: EntityWorkspace[] = []
    programIdsDiffer.forEach((programId) => {
      dataDiffer.push({
        entity_id: entityId,
        workspace_id: programId,
      })
    })

    if (dataDiffer.length === 0) return

    await c.var.trx.insertInto("entity_workspaces").values(dataDiffer).execute()
  }

  async attachWithUserID(
    c: Context,
    userId: number,
    programIds: number[],
    isEntityChanged: boolean = false
  ) {
    if (programIds.length === 0) return

    const wsUsers = await c.var.trx
      .selectFrom("user_workspaces as uw")
      .where("uw.user_id", "=", userId)
      .select([
        "uw.id",
        "uw.workspace_id as program_id",
        "uw.user_id as global_id",
        "uw.deleted_at",
      ])
      .execute()

    const programIdsExist =
      wsUsers.length > 0 ? collect(wsUsers, "program_id") : []
    const programIdsDiffer = differ(programIds, programIdsExist)

    const dataDiffer: TCreateUserWorkspaceSchema[] = []
    programIdsDiffer.forEach((programId) => {
      dataDiffer.push({
        user_id: userId,
        workspace_id: programId,
      })
    })

    if (isEntityChanged) {
      console.log("isEntityChanged", isEntityChanged)
      await c.var.trx
        .updateTable("user_workspaces")
        .set({
          deleted_at: new Date(), // soft delete
        })
        .where("user_id", "=", userId)
        .where("workspace_id", "in", programIdsExist)
        .execute()
    }

    // create program if not exist in user workspace
    if (dataDiffer.length) {
      await c.var.trx.insertInto("user_workspaces").values(dataDiffer).execute()
    }

    // remove soft delete according to the program_id sent
    if (programIds.length) {
      await c.var.trx
        .updateTable("user_workspaces")
        .set({
          deleted_at: null, // remove soft delete
        })
        .where("user_id", "=", userId)
        .where("workspace_id", "in", programIds)
        .execute()
    }
  }

  async attachWithSourceBudgetId(
    c: Context,
    id: number,
    data: CreateBudgetSourceWorkspaceRequest[]
  ) {
    if (data.length === 0 || c.var.client) return

    const programIdS = collect(data, "workspace_id")
    const wsBudgetSources = await c.var.trx
      .selectFrom("ws_budget_sources")
      .where("global_id", "=", id)
      .where("program_id", "in", programIdS)
      .select(["id", "program_id", "global_id"])
      .execute()

    const programIdsExist =
      wsBudgetSources.length > 0 ? collect(wsBudgetSources, "program_id") : []
    const programIdsDiffer = differ(programIdS, programIdsExist)

    const dataDiffer: CreateBudgetSourceWorkspaceRequest[] = []
    programIdsDiffer.forEach((programId) => {
      dataDiffer.push({
        budget_source_id: id,
        workspace_id: programId,
      })
    })
    if (dataDiffer.length === 0) return

    await c.var.trx
      .insertInto("budget_source_workspaces")
      .values(dataDiffer)
      .execute()
  }

  async attachWithManufactureId(
    c: Context,
    id: number,
    data: ManufactureWorkspaceCreateRequestDTO[]
  ) {
    if (data.length === 0 || c.var.client) return

    const programIds = collect(data, "workspace_id")
    const wsManufactures = await c.var.trx
      .selectFrom("ws_manufactures")
      .where("global_id", "=", id)
      .where("program_id", "in", programIds)
      .select(["id", "program_id", "global_id"])
      .execute()

    const programIdsExist =
      wsManufactures.length > 0 ? collect(wsManufactures, "program_id") : []
    const programIdsDiffer = differ(programIds, programIdsExist)

    const dataDiffer: ManufactureWorkspaceCreateRequestDTO[] = []
    programIdsDiffer.forEach((programId) => {
      dataDiffer.push({
        manufacture_id: id,
        workspace_id: programId,
      })
    })

    if (dataDiffer.length === 0) return

    await c.var.trx
      .insertInto("manufacture_workspaces")
      .values(dataDiffer)
      .execute()
  }

  async attachWithMaterialId(
    c: Context,
    id: number,
    data: CreateMaterialWorkSpaceRequest[]
  ) {
    if (data.length === 0 || c.var.client) return

    const programIds = collect(data, "workspace_id")
    const wsMaterials = await c.var.trx
      .selectFrom("ws_materials")
      .where("global_id", "=", id)
      .where("program_id", "in", programIds)
      .select(["id", "program_id", "global_id"])
      .execute()

    const programIdsExist =
      wsMaterials.length > 0 ? collect(wsMaterials, "program_id") : []
    const programIdsDiffer = differ(programIds, programIdsExist)

    const dataDiffer: CreateMaterialWorkSpaceRequest[] = []
    programIdsDiffer.forEach((programId) => {
      dataDiffer.push({
        material_id: id,
        workspace_id: programId,
      })
    })

    if (dataDiffer.length === 0) return

    await c.var.trx
      .insertInto("material_workspaces")
      .values(dataDiffer)
      .execute()
  }

  async deleteDynamicById(
    c: Context,
    table: keyof DB,
    whereClause: ReferenceExpression<DB, keyof DB>,
    id: number
  ) {
    await c.var.trx
      .deleteFrom(table)
      .where(whereClause, "=", id)
      .executeTakeFirst()
  }

  async getIDs(c: Context) {
    const result = await c.var.trx
      .selectFrom("workspaces")
      .selectAll()
      .execute()
    return collect(result, "id")
  }

  async findDynamic<T>(
    c: Context,
    table: TableWorkspaces,
    whereClause: ReferenceExpression<DB, TableWorkspaces>,
    operator: ComparisonOperatorExpression,
    value: T,
    isWhere: boolean
  ) {
    const result = await c.var.trx
      .selectFrom(table)
      .$if(isWhere, (eb) => eb.where(whereClause, operator, value))
      .selectAll()
      .execute()
    return result
  }

  getStreamData(c: Context, isHierarchy?: number) {
    return c.var.trx
      .selectFrom("workspaces")
      .select(["id", "name"])
      .$if(isHierarchy, (eb) =>
        eb.where(
          sql<boolean>`JSON_EXTRACT(config, '$.material.is_hierarchy_enabled')`,
          "=",
          isHierarchy === 1
        )
      )
      .where("deleted_at", "is", null)
      .stream()
  }

  async getProgramUUID(c: Context, workspaceIDs: number[]) {
    const programs = await c.var.trx
      .selectFrom("workspaces")
      .where("id", "in", workspaceIDs)
      .select(["program_uuid"])
      .execute()

    return collect(programs, "program_uuid")
  }

  async getUserProgramIds(c: Context, id: number) {
    const programs = await c.var.trx
      .selectFrom("workspaces")
      .innerJoin(
        "user_workspaces",
        "user_workspaces.workspace_id",
        "workspaces.id"
      )
      .where("user_workspaces.user_id", "=", id)
      .select(["workspaces.program_uuid", "workspaces.id"])
      .execute()

    return collect(programs, "id")
  }
}
