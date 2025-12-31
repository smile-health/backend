import { z } from "zod"

/* Base Schema */
export const EventReportReasonSchema = z.object({
  id: z.number().positive(),
  parent_id: z.number().positive().nullable(),
  parent_title: z.string().min(1).max(255),
  child_id: z.number().positive().nullable(),
  child_title: z.string().min(1).max(255),
})

/* Get List */
export type EventReportReasonListDTO = z.infer<typeof EventReportReasonSchema>
