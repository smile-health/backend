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
      .number()
      .min(0, { message: "Is Hierarchy must be boolean (1 or 0)" })
      .max(1, { message: "Is Hierarchy must be boolean (1 or 0)" })
      .int({ message: "ID must be an integer." })
      .nullish()
  ),
})

export const WorkspaceDTOSchema = z.object({
  id: z.preprocess(
    (value) => (typeof value === "string" ? parseInt(value, 10) : value),
    z
      .number({ required_error: "Id is required" })
      .int({ message: "Id must be an integer." })
      .nonnegative({ message: "Id must be a positive number." })
  ),
  key: z
    .string({ required_error: "Key is required" })
    .max(255, { message: "Key must not exceed 255 characters." }),
  name: z
    .string({ required_error: "Name is required" })
    .max(255, { message: "Name must not exceed 255 characters." }),
  config: z
    .string({ required_error: "Config is required" })
    .max(255, { message: "Config must not exceed 255 characters." })
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
