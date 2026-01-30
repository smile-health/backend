import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { DateSchema } from "@smile-health/lib/types/param.js"
import z from "zod"

/* Filter Schema */
const AnnualCommitmentFilterSchema = z.object({
  contract_number_id: z.coerce.number().optional(),
  year: z.coerce.number().optional(),
  supplier_id: z.coerce.number().optional(),
  material_id: z.coerce.number().optional(),
  province_id: z.coerce.number().optional(),
  sort_by: z.enum(["updated_at"]).optional(),
  sort_type: z.enum(["asc", "desc"]).optional(),
})

/* Base Request Schema */
export const AnnualCommitmentRequestSchema = z.object({
  id: z.number().positive().optional(),
  program_id: z.number().positive(),
  contract_id: z.number().positive(),
  contract_number: z.string(),
  contract_start_date: DateSchema,
  contract_end_date: DateSchema,
  year: z.number().positive(),
  vendor_id: z.number().positive(),
  information: z.string().nullish(),
  commitment_id: z.number().positive(),
  delivery_type_id: z.number().positive(),
  province_id: z.number().nullish(),
  material_id: z.number().positive(),
  parent_material_id: z.number().nullable(),
  vial_quantity: z.number().positive(),
  dose_quantity: z.number().positive(),
})

/* Base Audit Schema */
export const AnnualCommitmentAuditSchema = z.object({
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* Query Param Schema */
export const GetAnnualCommitmentQueryParamsSchema =
  PaginationQueriesSchema.merge(AnnualCommitmentFilterSchema)

/* Body Request Schema */
const CommitmentRequestSchema = AnnualCommitmentRequestSchema.omit({
  id: true,
  program_id: true,
  contract_id: true,
  commitment_id: true,
  delivery_type_id: true,
  province_id: true,
  material_id: true,
  parent_material_id: true,
  vial_quantity: true,
  dose_quantity: true,
})

const BaseCommitmentItemRequestSchema = AnnualCommitmentRequestSchema.pick({
  province_id: true,
  material_id: true,
  vial_quantity: true,
  dose_quantity: true,
})

const CreateCommitmentItemRequestSchema = z.object({
  items: z.array(BaseCommitmentItemRequestSchema).nullish(),
})

const UpdateCommitmentItemRequestSchema = z.object({
  items: z
    .array(
      BaseCommitmentItemRequestSchema.extend(
        AnnualCommitmentRequestSchema.pick({ id: true }).shape
      )
    )
    .nullish(),
})

export const CreateAnnualCommitmentBodyRequestSchema =
  CommitmentRequestSchema.merge(CreateCommitmentItemRequestSchema)

export const UpdatesAnnualCommitmentBodyRequestSchema =
  CommitmentRequestSchema.merge(UpdateCommitmentItemRequestSchema)

export const ImportAnnualCommitmentRowRequestSchema = z.object({
  ["contract_number"]: AnnualCommitmentRequestSchema.shape.contract_number,
  ["contract_start_date"]: z.string(),
  ["contract_end_date"]: z.string(),
  ["year"]: AnnualCommitmentRequestSchema.shape.year,
  ["information"]: AnnualCommitmentRequestSchema.shape.information,
  ["vendor_id"]: AnnualCommitmentRequestSchema.shape.vendor_id,
  ["province_id"]: AnnualCommitmentRequestSchema.shape.province_id,
  ["material_id"]: AnnualCommitmentRequestSchema.shape.material_id,
  ["vial_quantity"]: AnnualCommitmentRequestSchema.shape.vial_quantity,
})

export const ImportAnnualCommitmentArrayRequestSchema = z.array(
  ImportAnnualCommitmentRowRequestSchema
)

export const ImportRowRequestConvertedSchema =
  AnnualCommitmentRequestSchema.pick({
    contract_number: true,
    contract_start_date: true,
    contract_end_date: true,
    year: true,
    information: true,
    vendor_id: true,
    province_id: true,
    material_id: true,
    vial_quantity: true,
  })

/* DTO Schema */
const CreateAuditDTOSchema = AnnualCommitmentAuditSchema.omit({
  deleted_at: true,
  deleted_by: true,
})

const UpdateAuditDTOSchema = AnnualCommitmentAuditSchema.pick({
  updated_at: true,
  updated_by: true,
})

export const DeleteAuditDTOSchema = AnnualCommitmentAuditSchema.pick({
  deleted_at: true,
  deleted_by: true,
})

export const CreateContractDTOSchema = AnnualCommitmentRequestSchema.pick({
  contract_number: true,
}).merge(CreateAuditDTOSchema)

export const CreateCommitmentDTOSchema = AnnualCommitmentRequestSchema.pick({
  program_id: true,
  contract_id: true,
  contract_start_date: true,
  contract_end_date: true,
  year: true,
  vendor_id: true,
  information: true,
}).merge(CreateAuditDTOSchema)

export const CreateCommitmentItemDTOSchema = AnnualCommitmentRequestSchema.pick(
  {
    commitment_id: true,
    delivery_type_id: true,
    province_id: true,
    material_id: true,
    parent_material_id: true,
    vial_quantity: true,
    dose_quantity: true,
  }
).merge(CreateAuditDTOSchema)

export const UpdateCommitmentDTOSchema = AnnualCommitmentRequestSchema.pick({
  contract_id: true,
  contract_start_date: true,
  contract_end_date: true,
  year: true,
  vendor_id: true,
  information: true,
}).merge(UpdateAuditDTOSchema)

export const UpdateCommitmentItemDTOSchema = AnnualCommitmentRequestSchema.pick(
  {
    province_id: true,
    vial_quantity: true,
    dose_quantity: true,
  }
).merge(UpdateAuditDTOSchema)

/* Query Param Type */
export type GetAnnualCommitmentQueryParams = z.infer<
  typeof GetAnnualCommitmentQueryParamsSchema
>

/* Body Request Type */
export type CreateAnnualCommitmentBodyRequest = z.infer<
  typeof CreateAnnualCommitmentBodyRequestSchema
>

export type UpdatesAnnualCommitmentBodyRequest = z.infer<
  typeof UpdatesAnnualCommitmentBodyRequestSchema
>

export type ImportAnnualCommitmentRowRequest = z.infer<
  typeof ImportAnnualCommitmentRowRequestSchema
>

export type ImportAnnualCommitmentArrayRequest = z.infer<
  typeof ImportAnnualCommitmentArrayRequestSchema
>

export type ImportRowRequestConverted = z.infer<
  typeof ImportRowRequestConvertedSchema
>

/* DTO Type */
export type CreateContractDTO = z.infer<typeof CreateContractDTOSchema>

export type CreateCommitmentDTO = z.infer<typeof CreateCommitmentDTOSchema>

export type CreateCommitmentItemDTO = z.infer<
  typeof CreateCommitmentItemDTOSchema
>

export type UpdateCommitmentDTO = z.infer<typeof UpdateCommitmentDTOSchema>

export type UpdateCommitmentItemDTO = z.infer<
  typeof UpdateCommitmentItemDTOSchema
>

export type DeleteAuditDTO = z.infer<typeof DeleteAuditDTOSchema>
