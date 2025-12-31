import { z } from "zod"

export const CreateBastRequestSchema = z.object({
  bast_no: z.string(),
  disposal_comments: z.string(),
  instruction_type_id: z.number(),
  instruction_type_label: z.string(),
  sender: z.object({
    address: z.string(),
    entity_id: z.number(),
    entity_name: z.string(),
    province_name: z.string(),
    regency_name: z.string(),
    status: z.number(),
    type: z.number(),
    type_label: z.string(),
  }),
  disposal_items: z.array(z.object({
    material_id: z.number(),
    material_name: z.string(),
    qty: z.number(),
  })),
  user_created_by: z.object({
    email: z.string(),
    firstname: z.string(),
    lastname: z.string(),
    username: z.string(),
    user_uuid: z.string(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
})

export const CreateBastResponseSchema = z.object({
  bast_no: z.string(),
})

export const GetBastRequestSchema = z.object({
  bast_no: z.string(),
})

export const GetBastResponseSchema = z.object({
  bast_no: z.string(),
  receiver: z.object({
    name: z.string(),
    role: z.string(),
    address: z.string(),
    user_uuid: z.string(),
    entity_name: z.string(),
  }),
  disposal_items: z.array(z.object({
    material_id: z.number(),
    name: z.string(),
    qty: z.number(),
    waste_info: z.array(z.object({
      waste_bag_codes: z.string(),
      waste_bag_total_weight: z.string(),
      waste_bag_type_label: z.string(),
      waste_bag_histories: z.array(z.object({
        status_id: z.string(),
        status_label_id: z.string(),
        status_label_en: z.string(),
        updated_at: z.string(),
      })),
    })),
  })),
})

export const DisposalCancellationRequestSchema = z.object({
  bast_no: z.string(),
  comment: z.string(),
})

/* Type exports for backward compatibility */
export type CreateBastRequest = z.infer<typeof CreateBastRequestSchema>
export type CreateBastResponse = z.infer<typeof CreateBastResponseSchema>
export type GetBastRequest = z.infer<typeof GetBastRequestSchema>
export type GetBastResponse = z.infer<typeof GetBastResponseSchema>
export type DisposalCancellationRequest = z.infer<typeof DisposalCancellationRequestSchema>
