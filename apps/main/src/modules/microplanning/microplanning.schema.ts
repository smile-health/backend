import z from "zod"

export const MicroplanningStepsQuerySchema = z.object({
  category: z.enum(["bias", "non-bias"]).optional(),
})

export type MicroplanningStepsQuery = z.infer<
  typeof MicroplanningStepsQuerySchema
>

export interface StepStatus {
  status: "not_filled" | "not_completed" | "completed"
  completed: number
  total: number
  percentage: number
}

export interface SubStep {
  name: string
  completed: number
  total: number
}

export interface Step {
  step_number: number
  title: string
  status: StepStatus
  sub_steps?: SubStep[]
}

export interface MicroplanningStepsResponse {
  is_submitted: boolean
  steps: Step[]
}

export interface SubmitMicroplanningResponse {
  message: string
  microplanning_id: number
}
