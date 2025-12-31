import { z } from 'zod'

// Base Logger Schema
export const LoggerSchema = z.object({
  id: z.number().int().positive(),
  serial_number: z.string().min(1),
  gsm_no: z.string().optional(),
  location: z.string().optional(),
  vendor: z.string().optional(),
  asset_id: z.number().int().positive().optional(),
  position: z.string().optional(),
  max: z.number().optional(),
  min: z.number().optional(),
  temp: z.string().optional(),
  status: z.number().int().optional(),
  prod_year: z.string().optional(),
  created_at: z.date(),
  updated_at: z.date(),
})

// Schema for creating a new logger
export const AddLoggerDTOSchema = z.object({
  serial_number: z.string().min(1, 'Serial number is required'),
  gsm_no: z.string().optional(),
  location: z.string().optional(),
  vendor: z.string().optional(),
  asset_id: z.number().int().positive().optional(),
  position: z.string().optional(),
  max: z.number().optional(),
  min: z.number().optional(),
  temp: z.string().optional(),
  status: z.number().int().optional(),
  prod_year: z.string().optional(),
})

// Schema for updating a logger
export const EditLoggerDTOSchema = z.object({
  serial_number: z.string().min(1).optional(),
  gsm_no: z.string().optional(),
  location: z.string().optional(),
  vendor: z.string().optional(),
  asset_id: z.number().int().positive().optional(),
  position: z.string().optional(),
  max: z.number().optional(),
  min: z.number().optional(),
  temp: z.string().optional(),
  prod_year: z.string().optional(),
})

// Schema for updating logger status
export const UpdateLoggerStatusDTOSchema = z.object({
  status: z.number().int(),
})

// Query parameters schema
export const LoggerQuerySchema = z.object({
  asset_id: z.string().optional(),
  serial_number: z.string().optional(),
  page: z.string().optional(),
  paginate: z.string().optional(),
})

// TypeScript types
export type Logger = z.infer<typeof LoggerSchema>
export type AddLoggerDTO = z.infer<typeof AddLoggerDTOSchema>
export type EditLoggerDTO = z.infer<typeof EditLoggerDTOSchema>
export type UpdateLoggerStatusDTO = z.infer<typeof UpdateLoggerStatusDTOSchema>
export type LoggerQuery = z.infer<typeof LoggerQuerySchema>