/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from "hono";
import { z, ZodEffects, ZodSchema, ZodTypeAny } from "zod";
import { ValidationError } from "../error.js";
import BaseTemplate from "../excel/";
import { collect, consist, differ } from "../utils.js";
import { formatErrors, formatExcelErrors } from "../zod";

export interface IRepository {
  find(c: Context, where: object);
}

export interface DBValidationError {
  items: any[];
  message: string;
}

export interface DBValidation {
  type: "exist" | "not_exist" | "duplicated";
  key: string;
  repo: IRepository;
  col?: string;
  callback?: (
    c: Context,
    data: object[],
    existingErrors: DBValidationError[]
  ) => Promise<DBValidationError[]>;
}

export class BaseMiddleware {
  public validateRequest = async <T extends ZodSchema>(
    c: Context,
    schema: T,
    value: unknown,
    dbValidations?: DBValidation[]
  ): Promise<ReturnType<T["parse"]>> => {
    const usedSchema = dbValidations
      ? this.applyDBValidation(c, schema, dbValidations)
      : schema;

    const result = await usedSchema.safeParseAsync(value);
    if (!result.success) {
      c.set("errors", formatErrors(result.error, c.var.t, "materials"));
      throw new ValidationError();
    }

    return result.data;
  };

  public validateExcelRequest = async <
    T extends ZodSchema,
    U extends BaseTemplate,
  >(
    c: Context,
    schema: T,
    template: U,
    dbValidations?: DBValidation[]
  ): Promise<ReturnType<T["parse"]>> => {
    const body = await c.req.parseBody();
    const file = body.file as File;

    await template.loadFromBuffer(await file.arrayBuffer());
    const rows = template.getRows();
    const startRow = template.getStartRow();

    const usedSchema = dbValidations
      ? this.applyDBValidation(c, schema, dbValidations)
      : schema;
    const result = await usedSchema.safeParseAsync(rows);

    if (!result.success) {
      c.set("errors", formatExcelErrors(result.error, startRow, c.var.t));
      throw new ValidationError();
    }

    return result.data;
  };

  protected applyDBValidation<T extends ZodSchema>(
    c: Context,
    schema: T,
    dbValidations: DBValidation[]
  ): ZodEffects<T> {
    return schema.superRefine(async (data, ctx) => {
      for (const v of dbValidations) {
        let errors: DBValidationError[] = [];

        const col = v.col ?? "id";
        let val = Array.isArray(data[v.key]) ? data[v.key] : [data[v.key]];
        val = val.filter((v) => v !== null && typeof v !== "undefined");

        if (val.length === 0) {
          continue;
        }

        const result = await v.repo.find(c, { [col]: val });
        const foundItems = collect(result ?? {}, col as never);
        const notFoundData = differ(val, foundItems);
        const foundData = consist(val, foundItems);

        if (v.type === "not_exist" && notFoundData.length > 0) {
          notFoundData.forEach((notFoundItem) => {
            errors.push({
              items: notFoundItem,
              message: `validator.${v.type}`,
            });
          });
        } else if (v.type === "exist" && foundData.length > 0) {
          foundData.forEach((foundItem) => {
            errors.push({
              items: foundItem,
              message: `validator.${v.type}`,
            });
          });
        }

        if (v.callback) {
          errors = await v.callback(c, result, errors);
        }

        errors.forEach((error, index) => {
          ctx.addIssue({
            path: [v.key, index],
            message: `${error.message}^${error.items}`,
            code: z.ZodIssueCode.custom,
          });
        });
      }
    });
  }

  protected applyExcelDBValidation<T extends ZodTypeAny>(
    c: Context,
    schema: T,
    dbValidations: DBValidation[]
  ): ZodEffects<T> {
    return schema.superRefine(async (rows, ctx) => {
      if (!rows) {
        return;
      }
      for (const v of dbValidations) {
        const col = v.col ?? "id";
        const colSet = new Set<any>();
        const duplicateSet = new Set<any>();

        rows.map((row) => {
          const rowValues = Array.isArray(row[v.key])
            ? row[v.key]
            : [row[v.key]];
          rowValues.forEach((el: any) => {
            if (el) colSet.add(el);
          });
        });
        const whereValues = [...colSet];
        const result =
          whereValues.length > 0
            ? await v.repo.find(c, { [col]: [...colSet] })
            : [];
        const colItems = collect(result ?? {}, col as never);

        rows.forEach(async (row, index) => {
          let errors: DBValidationError[] = [];
          const rowValues = Array.isArray(row[v.key])
            ? row[v.key]
            : row[v.key]
              ? [row[v.key]]
              : [];

          const notFoundData = differ(rowValues, colItems);
          const foundData = consist(rowValues, colItems);

          if (v.type === "duplicated") {
            if (duplicateSet.has(rowValues[0])) {
              errors.push({
                items: rowValues[0],
                message: `validator.${v.type}`,
              });
            } else if (rowValues[0]) {
              duplicateSet.add(rowValues[0]);
            }
          } else if (v.type === "not_exist" && notFoundData.length > 0) {
            errors.push({
              items: notFoundData,
              message: `validator.${v.type}`,
            });
          } else if (v.type === "exist" && foundData.length > 0) {
            errors.push({
              items: foundData,
              message: `validator.${v.type}`,
            });
          }

          // additional validation for found data
          if (v.callback) {
            errors = await v.callback(c, result, errors);
          }

          errors.forEach((error) => {
            ctx.addIssue({
              path: [index, v.key],
              message: `${error.message}^${error.items}`,
              code: z.ZodIssueCode.custom,
            });
          });
        });
      }
    });
  }
}
