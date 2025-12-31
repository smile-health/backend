import { Context } from "hono";
import { validator } from "hono/validator";
import { ZodSchema } from "zod";
import { ValidationError } from "../error";
import { BadRequestError } from "../error.js";
import BaseTemplate from "../excel/";
import { FileResponse } from "../types/file.js";
import { formatErrors, formatExcelErrors } from "../zod";

export type AsyncCallback<T> = (c: Context, data: T) => Promise<T>;
export type AsyncExcelCallback<T> = (
  c: Context,
  data: T,
  template: BaseTemplate
) => Promise<T>;

export class BaseController {
  constructor(protected key?: string) {}

  protected validateRequest<T extends ZodSchema>(
    type: "json" | "param" | "query" | "header",
    schema: T | ((c: Context) => T) | ((c: Context) => Promise<T>),
    callback?: AsyncCallback<ReturnType<T["parse"]>>
  ) {
    return validator(
      type,
      async (value, c): Promise<ReturnType<T["parse"]>> => {
        const usedSchema =
          typeof schema === "function" ? await schema(c) : schema;
        const result = await usedSchema.safeParseAsync(value);
        if (!result.success) {
          c.set("errors", formatErrors(result.error, c.var.t, this.key));
          throw new ValidationError();
        }

        if (callback) {
          return await callback(c, result.data);
        }

        return result.data;
      }
    );
  }

  protected downloadExcel(c: Context, file: FileResponse) {
    if (!file) {
      throw new BadRequestError("failed to generate file");
    }

    const filename = file.filename;
    const buffer = file.buffer;

    c.res.headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}.xlsx"`
    );
    c.res.headers.set("Access-Control-Expose-Headers", "Filename");
    c.res.headers.set("Filename", `${filename}.xlsx`);
    c.res.headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Return the readable stream as the response
    return new Response(buffer, {
      headers: c.res.headers,
    });
  }

  protected validateExcelRequest<T extends ZodSchema>(
    schema: T | ((c: Context) => T) | ((c: Context) => Promise<T>),
    template:
      | BaseTemplate
      | ((c: Context) => BaseTemplate)
      | ((c: Context) => Promise<BaseTemplate>),
    callback?: AsyncExcelCallback<ReturnType<T["parse"]>>
  ) {
    return validator(
      "json",
      async (value, c): Promise<ReturnType<T["parse"]>> => {
        const usedschema =
          typeof schema === "function" ? await schema(c) : schema;
        const usedtemplate =
          typeof template === "function" ? await template(c) : template;

        const body = await c.req.parseBody();
        const file = body.file as File;

        await usedtemplate.loadFromBuffer(await file.arrayBuffer());
        usedtemplate.setLanguageByFileName(file.name);

        const rows = await usedtemplate.getRows();
        const startRow = usedtemplate.getStartRow();
        const result = await usedschema.safeParseAsync(rows);

        if (!result.success) {
          c.set("errors", formatExcelErrors(result.error, startRow, c.var.t));
          throw new ValidationError();
        }

        if (callback) {
          return await callback(c, result.data, usedtemplate);
        }

        return result.data;
      }
    );
  }
}
