/* eslint-disable @typescript-eslint/no-explicit-any */
export type BudgetSourceProgram = {
  program_id: number
  budget_source_id: number
}

export type BudgetSourceDTO = {
  id: number
  global_id: number
  name: string
  description: string | null
  programs: BudgetSourceProgram[]
  created_at: Date
  created_by: number | null
  updated_at: Date
  updated_by: number | null
  deleted_at: Date | null
  deleted_by: string | null
}

export type WsBudgetSourceMessageSchema = {
  headers: any
  payload: BudgetSourceDTO
}

export type SmileBudgetSourceResponse = {
  id: number
  name: string
  description: string
  created_by: number
  updated_by: number
  updated_at: string // ISO date string
  created_at: string // ISO date string
}
