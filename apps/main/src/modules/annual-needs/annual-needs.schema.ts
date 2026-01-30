import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const ProgramPlanIdParamsSchema = z.object({
  programPlanId: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid programPlanId param",
    }),
})

export const AnnualNeedIdParamsSchema = z.object({
  annualNeedId: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid annualNeedId param",
    }),
})

export const AnnualNeedIdParamsSchemaWithId = z.object({
  id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid id param",
    }),
})

export const EntityIdParamsSchema = z.object({
  entityId: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid entityId param",
    }),
})

export const UpdateAnnualNeedStatusSchema = z.object({
  status: z
    .number({ required_error: "Status is required" })
    .refine((v) => [0, 1, 2, 3, 4].includes(v), {
      message:
        "Status must be one of: 0 (New), 1 (Approved), 2 (Desk), 3 (Draft), 4 (Revision)",
    }),
})

export const GetListAnnualNeedsByEntitySchema = PaginationQueriesSchema

export const GetListAnnualNeedsSchema = PaginationQueriesSchema.extend({
  province_id: z
    .string()
    .transform((val) => (val ? Number(val) : 0))
    .refine((v) => !isNaN(v!) && v > 0, {
      message: "invalid province_id param",
    }),
  program_plan_year: z
    .string()
    .transform((val) => (val ? Number(val) : 0))
    .refine((v) => !isNaN(v!) && v > 0, {
      message: "invalid program_plan_year param",
    }),
  status: z
    .string()
    .transform((val) => (val ? Number(val) : 0))
    .optional(),
})

export const CreateAnnualNeedsSchema = z.object({
  province_id: z.number({ required_error: "Province is required" }),
  regency_id: z.number({ required_error: "Regency is required" }),
  entity_id: z.number({ required_error: "Entity is required" }),
  program_plan_id: z.number({ required_error: "Program Plan is required" }),
})

export const AnnualNeedPopulationSchema = z.object({
  annual_need_id: z.number({ required_error: "Annual Need ID is required" }),
  entities: z.array(
    z.object({
      entity_id: z.number({ required_error: "Entity ID is required" }),
      target_groups: z.array(
        z.object({
          target_group_id: z.number({
            required_error: "Target Group ID is required",
          }),
          percentage: z.number({ required_error: "Percentage is required" }),
          population: z.number({ required_error: "Population is required" }),
          population_correction: z.number({
            required_error: "Population Correction is required",
          }),
        })
      ),
    })
  ),
})

export const AnnualNeedIpvSchema = z.object({
  annual_need_id: z.number({ required_error: "Annual Need ID is required" }),
  ips: z.array(
    z.object({
      material_id: z.number({ required_error: "Material ID is required" }),
      activity_id: z.number({ required_error: "Activity ID is required" }),
      sku: z.number({ required_error: "SKU is required" }),
      national_ip: z.number({ required_error: "National IP is required" }),
      regency_ip: z.number({ required_error: "Regency IP is required" }),
      target_group_id: z.number({
        required_error: "Target Group ID is required",
      }),
    })
  ),
})

export const GetNationalIpQueriesSchema = PaginationQueriesSchema

export const GetMonthlyDistributionQueriesSchema = z.object({
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid entity_id param",
    }),
  material_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid material_id param",
    }),
  activity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid activity_id param",
    }),
})

export const GetPopulationQueriesSchema = z.object({
  regencyId: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid regencyId param",
    })
    .optional(),
})

export const GetAnnualNeedIpQueriesSchema = PaginationQueriesSchema

export const UpdatePopulationStatusSchema = z.array(
  z.object({
    id: z.number({ required_error: "Population ID is required" }),
    entity_id: z.number({ required_error: "Entity ID is required" }),
    target_group_id: z.number({
      required_error: "Target Group ID is required",
    }),
    status: z
      .number({ required_error: "Status is required" })
      .refine((v) => [0, 1].includes(v), {
        message: "Status must be one of: 0 (Rejected), 1 (Approved)",
      }),
  })
)

export const UpdateIpStatusSchema = z.array(
  z.object({
    id: z.number({ required_error: "IP ID is required" }),
    status: z
      .number({ required_error: "Status is required" })
      .refine((v) => [0, 1].includes(v), {
        message: "Status must be one of: 0 (Rejected), 1 (Approved)",
      }),
  })
)

export const UpdatePopulationSchema = z.array(
  z.object({
    id: z.number({ required_error: "Population ID is required" }),
    percentage: z.number({ required_error: "Percentage is required" }),
    population: z.number({ required_error: "Population is required" }),
    population_correction: z.number({
      required_error: "Population correction is required",
    }),
    status: z
      .number({ required_error: "Status is required" })
      .refine((v) => [0, 1].includes(v), {
        message: "Status must be one of: 0 (Rejected), 1 (Approved)",
      }),
  })
)

export const UpdateIpSchema = z.array(
  z.object({
    id: z.number({ required_error: "IP ID is required" }),
    regency_ip: z.number({ required_error: "Regency IP is required" }),
    status: z
      .number({ required_error: "Status is required" })
      .refine((v) => [0, 1].includes(v), {
        message: "Status must be one of: 0 (Rejected), 1 (Approved)",
      }),
  })
)

export type GetListAnnualNeedsQueries = z.infer<typeof GetListAnnualNeedsSchema>
export type CreateAnnualNeedsRequest = z.infer<typeof CreateAnnualNeedsSchema>
export type AnnualPopulationRequest = z.infer<typeof AnnualNeedPopulationSchema>
export type AnnualNeedIpvRequest = z.infer<typeof AnnualNeedIpvSchema>
export type GetNationalIpQueries = z.infer<typeof GetNationalIpQueriesSchema>
export type ProgramPlanIdParams = z.infer<typeof ProgramPlanIdParamsSchema>
export type AnnualNeedIdParams = z.infer<typeof AnnualNeedIdParamsSchema>
export type GetMonthlyDistributionQueries = z.infer<
  typeof GetMonthlyDistributionQueriesSchema
>
export type GetPopulationQueries = z.infer<typeof GetPopulationQueriesSchema>
export type GetAnnualNeedIpQueries = z.infer<
  typeof GetAnnualNeedIpQueriesSchema
>
export type EntityIdParams = z.infer<typeof EntityIdParamsSchema>
export type AnnualNeedIdParamsWithId = z.infer<
  typeof AnnualNeedIdParamsSchemaWithId
>
export type UpdateAnnualNeedStatusRequest = z.infer<
  typeof UpdateAnnualNeedStatusSchema
>

export const GetAnnualNeedResultSchema = PaginationQueriesSchema.extend({
  activity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid activity_id param",
    })
    .optional(),
  material_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid material_id param",
    })
    .optional(),
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      message: "invalid entity_id param",
    })
    .optional(),
})

export const CreateAnnualNeedResultSchema = z.object({
  annual_need_id: z.number({ required_error: "Annual Need ID is required" }),
})

export const ActivatedMinMaxRegencySchema = z.object({
  program_plan_id: z.number({ required_error: "Program Plan ID is required" }),
  annual_need_ids: z.array(
    z.number({ required_error: "Annual Need ID is required" })
  ),
})

export const ActivatedMinMaxProvinceSchema = z.object({
  program_plan_id: z.number({ required_error: "Program Plan ID is required" }),
  province_id: z.number({ required_error: "Province ID is required" }),
})

export type GetAnnualNeedResultQueries = z.infer<
  typeof GetAnnualNeedResultSchema
>
export type CreateAnnualNeedResultRequest = z.infer<
  typeof CreateAnnualNeedResultSchema
>
export type GetListAnnualNeedsByEntityQueries = z.infer<
  typeof GetListAnnualNeedsByEntitySchema
>
export type UpdatePopulationStatusRequest = z.infer<
  typeof UpdatePopulationStatusSchema
>
export type UpdateIpStatusRequest = z.infer<typeof UpdateIpStatusSchema>
export type UpdatePopulationRequest = z.infer<typeof UpdatePopulationSchema>
export type UpdateIpRequest = z.infer<typeof UpdateIpSchema>
