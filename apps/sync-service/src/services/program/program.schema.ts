export interface CreateProgramIncomingMessage {
  headers: Record<string, string>
  payload: {
    id: number
    name: string
    config?: {
      material?: {
        is_hierarchy_enabled?: boolean
      }
    }
  }
}
