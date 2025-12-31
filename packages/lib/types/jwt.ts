export type JWTPayload = {
  account_id: number
  role: number
  workspaces: Workspace[]
}

export type Workspace = {
  id: number
  key: string
  name: string
  user_id: number
  config: WorkspaceConfig
}

export type WorkspaceConfig = {
  material: MaterialConfig
  is_immunization: boolean | undefined
}

export type MaterialConfig = {
  is_hierarchy_enabled: boolean
}
