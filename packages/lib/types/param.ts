import moment from "moment";
import { z } from "zod";

export const IdSchema = z
  .string()
  .refine((value) => !/\s/.test(value), { message: "validator.no_spaces" })
  .transform((val) => parseInt(val, 10))
  .refine((val) => !isNaN(val), { message: "validator.string" })
  .refine((val) => isNaN(val) || val > 0, { message: "validator.positive" });

export const OptionalIdSchema = IdSchema.optional()
  .or(z.literal(""))
  .transform(Number);

export const OptionalIdsSchema = z
  .string()
  .refine(
    (value) => /^$|^(-?[a-zA-Z0-9]+)([,\|;](-?[a-zA-Z0-9]+))*$/.test(value),
    {
      message: "validator.string",
    }
  )
  .refine(
    (value) => {
      const values =
        value.trim() === ""
          ? []
          : value.split(/[\s,;|]+/).map((item) => parseInt(item, 10));
      return values.every((item) => !isNaN(item) && item > 0);
    },
    { message: "validator.positive" }
  )
  .transform((value) =>
    value.trim() === ""
      ? []
      : value.split(/[\s,;|]+/).map((item) => parseInt(item.trim(), 10))
  );

export const IdsSchema = OptionalIdsSchema.refine(
  (val) => val.length > 0,
  "validator.not_empty"
);

export const IdParamsSchema = z.object({
  id: IdSchema,
});

export const DateSchema = z
  .string()
  .refine(
    (v) => {
      if (!v) return true;
      return moment(v).isValid();
    },
    { message: "validator.date" }
  )
  .transform((val) => new Date(val));

export interface MasterData {
  id: number;
  name: string | null;
}
