import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const ProgramPlanIdParamsSchema = z.object({
  programPlanId: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      error: "invalid programPlanId param",
    }),
})

export const AnnualNeedIdParamsSchema = z.object({
  annualNeedId: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      error: "invalid annualNeedId param",
    }),
})

export const AnnualNeedIdParamsSchemaWithId = z.object({
  id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      error: "invalid id param",
    }),
})

export const EntityIdParamsSchema = z.object({
  entityId: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      error: "invalid entityId param",
    }),
})

export const UpdateAnnualNeedStatusSchema = z.object({
  status: z
    .number({
      error: (issue) =>
        issue.input === undefined ? "Status is required" : undefined,
    })
    .refine((v) => [0, 1, 2, 3, 4].includes(v), {
      error:
        "Status must be one of: 0 (New), 1 (Approved), 2 (Desk), 3 (Draft), 4 (Revision)",
    }),
})

export const GetListAnnualNeedsByEntitySchema = PaginationQueriesSchema

export const GetListAnnualNeedsSchema = PaginationQueriesSchema.extend({
  province_id: z
    .string()
    .transform((val) => (val ? Number(val) : 0))
    .refine((v) => !isNaN(v!) && v > 0, {
      error: "invalid province_id param",
    }),
  program_plan_year: z
    .string()
    .transform((val) => (val ? Number(val) : 0))
    .refine((v) => !isNaN(v!) && v > 0, {
      error: "invalid program_plan_year param",
    }),
  status: z
    .string()
    .transform((val) => (val ? Number(val) : 0))
    .optional(),
})

export const CreateAnnualNeedsSchema = z.object({
  province_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Province is required" : undefined,
  }),
  regency_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Regency is required" : undefined,
  }),
  entity_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Entity is required" : undefined,
  }),
  program_plan_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Program Plan is required" : undefined,
  }),
})

export const AnnualNeedPopulationSchema = z.object({
  annual_need_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Annual Need ID is required" : undefined,
  }),
  entities: z.array(
    z.object({
      entity_id: z.number({
        error: (issue) =>
          issue.input === undefined ? "Entity ID is required" : undefined,
      }),
      target_groups: z.array(
        z.object({
          target_group_id: z.number({
            error: (issue) =>
              issue.input === undefined
                ? "Target Group ID is required"
                : undefined,
          }),
          percentage: z.number({
            error: (issue) =>
              issue.input === undefined ? "Percentage is required" : undefined,
          }),
          population: z.number({
            error: (issue) =>
              issue.input === undefined ? "Population is required" : undefined,
          }),
          population_correction: z.number({
            error: (issue) =>
              issue.input === undefined
                ? "Population Correction is required"
                : undefined,
          }),
        })
      ),
    })
  ),
})

export const AnnualNeedIpvSchema = z.object({
  annual_need_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Annual Need ID is required" : undefined,
  }),
  ips: z.array(
    z.object({
      material_id: z.number({
        error: (issue) =>
          issue.input === undefined ? "Material ID is required" : undefined,
      }),
      activity_id: z.number({
        error: (issue) =>
          issue.input === undefined ? "Activity ID is required" : undefined,
      }),
      sku: z.number({
        error: (issue) =>
          issue.input === undefined ? "SKU is required" : undefined,
      }),
      national_ip: z.number({
        error: (issue) =>
          issue.input === undefined ? "National IP is required" : undefined,
      }),
      regency_ip: z.number({
        error: (issue) =>
          issue.input === undefined ? "Regency IP is required" : undefined,
      }),
      target_group_id: z.number({
        error: (issue) =>
          issue.input === undefined ? "Target Group ID is required" : undefined,
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
      error: "invalid entity_id param",
    }),
  material_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      error: "invalid material_id param",
    }),
  activity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      error: "invalid activity_id param",
    }),
})

export const GetPopulationQueriesSchema = z.object({
  regencyId: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      error: "invalid regencyId param",
    })
    .optional(),
})

export const GetAnnualNeedIpQueriesSchema = PaginationQueriesSchema

export const UpdatePopulationStatusSchema = z.array(
  z.object({
    id: z.number({
      error: (issue) =>
        issue.input === undefined ? "Population ID is required" : undefined,
    }),
    entity_id: z.number({
      error: (issue) =>
        issue.input === undefined ? "Entity ID is required" : undefined,
    }),
    target_group_id: z.number({
      error: (issue) =>
        issue.input === undefined ? "Target Group ID is required" : undefined,
    }),
    status: z
      .number({
        error: (issue) =>
          issue.input === undefined ? "Status is required" : undefined,
      })
      .refine((v) => [0, 1].includes(v), {
        error: "Status must be one of: 0 (Rejected), 1 (Approved)",
      }),
  })
)

export const UpdateIpStatusSchema = z.array(
  z.object({
    id: z.number({
      error: (issue) =>
        issue.input === undefined ? "IP ID is required" : undefined,
    }),
    status: z
      .number({
        error: (issue) =>
          issue.input === undefined ? "Status is required" : undefined,
      })
      .refine((v) => [0, 1].includes(v), {
        error: "Status must be one of: 0 (Rejected), 1 (Approved)",
      }),
  })
)

export const UpdatePopulationSchema = z.array(
  z.object({
    id: z.number({
      error: (issue) =>
        issue.input === undefined ? "Population ID is required" : undefined,
    }),
    percentage: z.number({
      error: (issue) =>
        issue.input === undefined ? "Percentage is required" : undefined,
    }),
    population: z.number({
      error: (issue) =>
        issue.input === undefined ? "Population is required" : undefined,
    }),
    population_correction: z.number({
      error: (issue) =>
        issue.input === undefined
          ? "Population correction is required"
          : undefined,
    }),
    status: z
      .number({
        error: (issue) =>
          issue.input === undefined ? "Status is required" : undefined,
      })
      .refine((v) => [0, 1].includes(v), {
        error: "Status must be one of: 0 (Rejected), 1 (Approved)",
      }),
  })
)

export const UpdateIpSchema = z.array(
  z.object({
    id: z.number({
      error: (issue) =>
        issue.input === undefined ? "IP ID is required" : undefined,
    }),
    regency_ip: z.number({
      error: (issue) =>
        issue.input === undefined ? "Regency IP is required" : undefined,
    }),
    status: z
      .number({
        error: (issue) =>
          issue.input === undefined ? "Status is required" : undefined,
      })
      .refine((v) => [0, 1].includes(v), {
        error: "Status must be one of: 0 (Rejected), 1 (Approved)",
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
      error: "invalid activity_id param",
    })
    .optional(),
  material_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      error: "invalid material_id param",
    })
    .optional(),
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v) && v > 0, {
      error: "invalid entity_id param",
    })
    .optional(),
})

export const CreateAnnualNeedResultSchema = z.object({
  annual_need_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Annual Need ID is required" : undefined,
  }),
})

export const ActivatedMinMaxRegencySchema = z.object({
  program_plan_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Program Plan ID is required" : undefined,
  }),
  annual_need_ids: z.array(
    z.number({
      error: (issue) =>
        issue.input === undefined ? "Annual Need ID is required" : undefined,
    })
  ),
})

export const ActivatedMinMaxProvinceSchema = z.object({
  program_plan_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Program Plan ID is required" : undefined,
  }),
  province_id: z.number({
    error: (issue) =>
      issue.input === undefined ? "Province ID is required" : undefined,
  }),
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
