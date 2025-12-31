import z from "zod";

export const GlobalEntityDto = z.object({
  global_id: z.number(),
  code: z.string(),
  name: z.string(),
  entity_tag_id: z.number().nullish(),
  type: z.number().optional(),
  address: z.string(),
  country: z.string().nullish(),
  province_id: z
    .string()
    .nullish()
    .transform((val) => (val == "" ? null : val)),
  regency_id: z
    .string()
    .nullish()
    .transform((val) => (val == "" ? null : val)),
  sub_district_id: z
    .string()
    .nullish()
    .transform((val) => (val == "" ? null : val)),
  village_id: z
    .string()
    .nullish()
    .transform((val) => (val == "" ? null : val)),
  postal_code: z.string().nullish(),
  status: z.number().nullish(),
  lat: z.string().nullish(),
  lng: z.string().nullish(),
  is_puskesmas: z.number().optional(),
  is_vendor: z.number().optional(),
  program_ids: z.array(z.number()).nullish(),
});

export type TGlobalEntityDto = z.infer<typeof GlobalEntityDto>;
