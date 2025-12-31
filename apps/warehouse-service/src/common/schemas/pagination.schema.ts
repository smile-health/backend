import { z } from "zod"

export const PaginationOptionSchema = z.object({
  is_paginate: z.boolean().optional(),
  count: z.boolean().optional(),
})

export const CountDTOSchema = z.array(
  z.object({
    count: z.number(),
  })
)

export type PaginationOption = z.infer<typeof PaginationOptionSchema>
export type CountDTO = z.infer<typeof CountDTOSchema>
