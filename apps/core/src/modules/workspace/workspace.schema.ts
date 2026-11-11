import { DB } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const GetWorkspacesParamsSchema = PaginationQueriesSchema.extend({
  is_material_hierarchy_enabled: z.preprocess(
    (value) => {
      if (!value) return
      if (typeof value === "string") return parseInt(value, 10)
    },
    z
      .int({
        error: "ID must be an integer.",
      })
      .min(0, {
        error: "Is Hierarchy must be boolean (1 or 0)",
      })
      .max(1, {
        error: "Is Hierarchy must be boolean (1 or 0)",
      })
      .nullish()
  ),
})

export const WorkspaceDTOSchema = z.object({
  id: z.preprocess(
    (value) => (typeof value === "string" ? parseInt(value, 10) : value),
    z
      .int({
        error: "Id must be an integer.",
      })
      .nonnegative({
        error: "Id must be a positive number.",
      })
  ),
  key: z
    .string({
      error: (issue) =>
        issue.input === undefined ? "Key is required" : undefined,
    })
    .max(255, {
      error: "Key must not exceed 255 characters.",
    }),
  name: z
    .string({
      error: (issue) =>
        issue.input === undefined ? "Name is required" : undefined,
    })
    .max(255, {
      error: "Name must not exceed 255 characters.",
    }),
  config: z
    .string({
      error: (issue) =>
        issue.input === undefined ? "Config is required" : undefined,
    })
    .max(255, {
      error: "Config must not exceed 255 characters.",
    })
    .nullish(),
})

export type GetWorkspacesParams = z.infer<typeof GetWorkspacesParamsSchema>

export type WorkspaceDTO = z.infer<typeof WorkspaceDTOSchema>

export type TableWorkspaces = keyof Pick<
  DB,
  | "workspaces"
  | "budget_source_workspaces"
  | "user_workspaces"
  | "manufacture_workspaces"
  | "entity_workspaces"
  | "material_workspaces"
>
