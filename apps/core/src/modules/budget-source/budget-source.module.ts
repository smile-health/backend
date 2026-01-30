import { NotFoundError, ValidationError } from "@smile-health/lib/error.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { collect, formatDateWithTimezone, merge } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { UserRepository } from "../user/user.repository.js"
import { TWorkspaces } from "../user/user.schema.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { BudgetSourcePublisher } from "./budget-source.publisher.js"
import { BudgetSourceRepository } from "./budget-source.repository.js"
import {
  BudgetSourceResponse,
  CreateBudgetSourceWorkspaceRequest,
  CreateRequest,
  DetailRequest,
  GetBudgetSourceQueries,
  TExportBudgetSource,
} from "./budget-source.schema.js"

export class BudgetSourceModule {
  constructor(
    private readonly repo: BudgetSourceRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly userRepo: UserRepository,
    private readonly budgetSourcePublisher: BudgetSourcePublisher
  ) {}

  async create(c: Context, body: CreateRequest) {
    const { program_ids: workspace_ids, ...data } = body

    const created = await this.repo.create(c, data)
    const sourceBudgetId = Number(created.insertId)

    const dataWorkspaces: CreateBudgetSourceWorkspaceRequest[] = []
    for (const workspace of workspace_ids ?? []) {
      dataWorkspaces.push({
        budget_source_id: sourceBudgetId,
        workspace_id: workspace,
      })
    }
    await this.workspaceRepo.attachWithSourceBudgetId(
      c,
      sourceBudgetId,
      dataWorkspaces
    )

    await this.budgetSourcePublisher.processCreate(
      c,
      Number(created.insertId),
      body
    )

    const result = await this.repo.findOne(c, { id: sourceBudgetId })

    return result
  }

  async detail(c: Context, param: DetailRequest) {
    const rsp = await this.repo.findOne(c, param)

    if (!rsp) {
      throw new NotFoundError(
        `${c.var.t("validator.not_exist", { field: "budget source" })}`
      )
    }

    if (rsp?.deleted_at) {
      throw new ValidationError(
        `${c.var.t("validator.not_exist", { field: "budget source " + rsp.name })}`
      )
    }

    const [workspaces, createdBy, updatedBy] = await Promise.all([
      this.workspaceRepo.getByFromMappedWorkspace(c, "budget_source", [rsp.id]),
      this.userRepo.getByIDsMapped(c, [rsp.created_by!]),
      this.userRepo.getByIDsMapped(c, [rsp.updated_by!]),
    ])

    return {
      ...rsp,
      user_created_by: rsp.created_by ? createdBy[rsp.created_by]![0] : {},
      user_updated_by: rsp.updated_by ? updatedBy[rsp.updated_by]![0] : {},
      programs: (workspaces[Number(param.id)] as TWorkspaces[]) ?? [],
    }
  }

  async list(c: Context, queries: GetBudgetSourceQueries) {
    const { sort_by, sort_type } = queries
    queries.isPaginate = true
    queries.offset = (queries.page - 1) * queries.paginate

    const { budgetSources, total } = await this.repo.findAll(
      c,
      queries,
      sort_by,
      sort_type
    )

    if (budgetSources.length === 0) {
      return new PaginatedResponse<BudgetSourceResponse>(queries)
    }

    const data = await this.#mapList(c, budgetSources)

    return new PaginatedResponse<BudgetSourceResponse>(queries, data, total)
  }

  async update(c: Context, body: CreateRequest, param: DetailRequest) {
    await this.detail(c, param)
    const dataWorkspaces: CreateBudgetSourceWorkspaceRequest[] = []
    const { program_ids: workspace_ids, ...data } = body
    for (const workspace of workspace_ids ?? []) {
      dataWorkspaces.push({
        budget_source_id: param.id,
        workspace_id: workspace,
      })
    }
    await this.repo.update(c, data, param)
    await this.workspaceRepo.attachWithSourceBudgetId(
      c,
      param.id,
      dataWorkspaces
    )
    await this.budgetSourcePublisher.processUpdate(c, param.id, body)

    const result = await this.detail(c, param)
    return result
  }

  async softDelete(c: Context, param: DetailRequest) {
    await this.detail(c, param)

    // before delete check to any relation
    // decided to remove delete action

    await this.repo.delete(c, param)
    await this.workspaceRepo.deleteDynamicById(
      c,
      "budget_source_workspaces",
      "budget_source_workspaces.budget_source_id",
      param.id
    )
  }

  async exportExcel(c: Context, queries: GetBudgetSourceQueries) {
    queries.isPaginate = false
    const title = c.var.t("budget_source.title")
    const excelTemplate = new BaseTemplate(PROCESSOR.SHEETJS)
    const timezone = c.req.header("Timezone")

    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)
    await excelTemplate.initSheet(title)
    excelTemplate.setColumns([
      {
        header: c.var.t("budget_source.label.id"),
        width: 10,
      },
      {
        header: c.var.t("budget_source.label.name"),
        width: 40,
      },
      {
        header: c.var.t("budget_source.label.description"),
        width: 40,
      },
      {
        header: c.var.t("common.program"),
        width: 40,
      },
      {
        header: c.var.t("budget_source.label.is_restricted"),
        width: 40,
      },
      {
        header: c.var.t("common.created_at"),
        width: 20,
      },
      {
        header: c.var.t("common.updated_at"),
        width: 20,
      },
      {
        header: c.var.t("common.created_by"),
        width: 20,
      },
      {
        header: c.var.t("common.updated_by"),
        width: 20,
      },
    ])

    const data = await this.repo.findAll(c, queries)
    const items = await this.#mapList(c, data.budgetSources)

    const setRows: TExportBudgetSource[] = []
    for (const budgetSource of items) {
      const row: TExportBudgetSource = {
        id: budgetSource.id,
        name: budgetSource.name,
        description: budgetSource.description,
        program: budgetSource.programs?.map((el) => el.name).join(", "),
        is_restricted:
          budgetSource.is_restricted === 1
            ? c.var.t("budget_source.label.is_restricted_enable")
            : c.var.t("budget_source.label.is_restricted_disable"),
        created_at: formatDateWithTimezone(budgetSource.created_at, timezone),
        updated_at: formatDateWithTimezone(budgetSource.updated_at, timezone),
        created_by: budgetSource.user_created_by?.firstname ?? "-",
        updated_by: budgetSource.user_updated_by?.firstname ?? "-",
      }
      setRows.push(row)
    }
    await excelTemplate.addRows(title, setRows)

    return await excelTemplate.generate()
  }

  async #mapList(c: Context, data: BudgetSourceResponse[]) {
    const sourceBudgetIds = collect(data, "id")
    const createdByIds = collect(data, "created_by")
    const updatedByIds = collect(data, "updated_by")

    const [workspaces, userBy] = await Promise.all([
      sourceBudgetIds.length > 0
        ? this.workspaceRepo.getByFromMappedWorkspace(
            c,
            "budget_source",
            sourceBudgetIds
          )
        : [],
      createdByIds.length > 0
        ? this.userRepo.getByIDsMapped(c, merge(createdByIds, updatedByIds))
        : [],
    ])

    return data.map(
      (el) =>
        ({
          ...el,
          user_created_by: userBy[el.created_by ?? 0]?.[0] ?? {},
          user_updated_by: userBy[el.updated_by ?? 0]?.[0] ?? {},
          programs: (workspaces[Number(el.id)] as TWorkspaces[]) ?? [],
        }) as BudgetSourceResponse
    )
  }
}
