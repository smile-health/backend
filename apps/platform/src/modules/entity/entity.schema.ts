import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetListEntitySchema = PaginationQueriesSchema.extend({
  type_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_TYPE_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  entity_tag_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_ENTITY_TAG_ID_PARAM",
      }
    )
    .transform((val) =>
      val
        .split(",")
        .filter((item) => item !== "")
        .map((item) => Number(item))
    )
    .optional(),
  province_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_PROVINCE_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  regency_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_REGENCY_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  sub_district_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_SUB_DISTRICT_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
})

export const UpdateStatusEntityRequestSchema = z.object({
  status: z
    .enum(["0", "1"], { message: "INVALID_REQUEST_STATUS" })
    .transform((val) => Number(val)),
})

export type GetEntitiesQueries = z.infer<typeof GetListEntitySchema>
export type UpdateStatusEntitiesRequest = z.infer<
  typeof UpdateStatusEntityRequestSchema
>
