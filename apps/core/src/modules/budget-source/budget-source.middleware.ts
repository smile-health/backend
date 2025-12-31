import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { z, ZodIssueCode } from "zod"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { BudgetSourceRepository } from "./budget-source.repository.js"
import {
  CreateSchema,
  GetBudgetSourceQueriesSchema,
} from "./budget-source.schema.js"

export class BudgetSourceMiddleware {
  constructor(
    private readonly repository: BudgetSourceRepository,
    private readonly workspaceRepo: WorkspaceRepository
  ) {}

  readonly #isNameExist = async (c: Context, name: string) => {
    const exists = await this.repository.find(c, { name })

    return exists.length > 0 && !exists[0]?.deleted_at
  }

  readonly #isNameSameWithDataPrevious = async (c: Context, name: string) => {
    const id = c.req.param("id")
    const dataPrevious = await this.repository.find(c, { id: Number(id) })
    if (
      dataPrevious &&
      !dataPrevious[0]?.deleted_at &&
      dataPrevious[0]?.name !== name
    ) {
      return await this.#isNameExist(c, name)
    }
  }

  readonly #isWorkspaceExist = async (c: Context, workspace_ids: number[]) => {
    const workspaceIDs = await this.workspaceRepo.getIDs(c)
    let count = 0
    for (const workspace of workspace_ids) {
      if (!workspaceIDs.includes(workspace)) {
        count++
      }
    }
    return count > 0
  }

  readonly #isWorkspaceIncluded = async (
    c: Context,
    workspace_ids: number[]
  ) => {
    const { id } = c.req.param()
    const workspaceIDs = collect(
      await this.workspaceRepo.findDynamic(
        c,
        "budget_source_workspaces",
        "budget_source_workspaces.budget_source_id",
        "=",
        id,
        true
      ),
      "workspace_id"
    )
    let count = 0
    for (const workspace of workspace_ids) {
      if (workspaceIDs.includes(workspace)) {
        count++
      }
    }
    return count < workspaceIDs.length
  }

  created = (c: Context) => {
    return CreateSchema.superRefine(async (val, cfx) => {
      const nameExist = await this.#isNameExist(c, val.name)
      const workspaceExist = await this.#isWorkspaceExist(
        c,
        val.program_ids ?? []
      )

      if (nameExist) {
        cfx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["name"],
          message: "validator.exist",
        })
      }
      if (workspaceExist) {
        cfx.addIssue({
          code: ZodIssueCode.custom,
          path: ["program_ids"],
          message: "validator.unmatch",
        })
      }
    })
  }

  updated = (c: Context) => {
    return CreateSchema.superRefine(async (val, cfx) => {
      const nameSamePrevious = await this.#isNameSameWithDataPrevious(
        c,
        val.name
      )
      const workspaceExist = await this.#isWorkspaceExist(
        c,
        val.program_ids ?? []
      )
      const workspaceIncluded = await this.#isWorkspaceIncluded(
        c,
        val.program_ids ?? []
      )

      if (nameSamePrevious) {
        cfx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["name"],
          message: "validator.exist",
        })
      }
      if (workspaceExist || workspaceIncluded) {
        cfx.addIssue({
          code: ZodIssueCode.custom,
          path: ["program_ids"],
          message: "validator.unmatch",
        })
      }
    })
  }

  list = (c: Context) => {
    return GetBudgetSourceQueriesSchema.superRefine(async (val, cfx) => {
      const { sort_by, sort_type } = val
      const sortBys = ["name", "updated_at", "user_updated_by"]
      const sortTypes = ["asc", "desc"]

      if (sort_by && !sortBys.includes(sort_by)) {
        cfx.addIssue({
          code: ZodIssueCode.custom,
          path: ["sort_by"],
          message: c.var.t("validator.one_of", {
            field: "sort_by",
            condition: sortBys,
          }),
        })
      }

      if (sort_type && !sortTypes.includes(sort_type)) {
        cfx.addIssue({
          code: ZodIssueCode.custom,
          path: ["sort_type"],
          message: c.var.t("validator.one_of", {
            field: "sort_type",
            condition: sortTypes,
          }),
        })
      }
    })
  }
}
