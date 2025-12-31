import { conditionsMessage } from "@smile/lib/zod.js"
import { Context } from "hono"
import { z } from "zod"
import { ProgramRepository } from "./program.repository.js"
import {
  ProgramParamsSchema,
  ProgramRequest,
  ProgramSchema,
} from "./program.schema.js"

export class ProgramMiddleware {
  constructor(private readonly repository: ProgramRepository) {}

  readonly #checkLength = (
    c: Context,
    ctx: z.RefinementCtx,
    column: string,
    value: string
  ) => {
    conditionsMessage(
      ctx,
      c.var.t("validator.not_exceed_255", {
        field: c.var.t(`common.${column}`),
      }),
      value.length > 255,
      [column]
    )
  }

  readonly #checkDataProgramLength = (
    c: Context,
    ctx: z.RefinementCtx,
    data: ProgramRequest
  ) => {
    this.#checkLength(c, ctx, "key", data.key)
    this.#checkLength(c, ctx, "name", data.name)
    this.#checkLength(c, ctx, "color", data.config.color)
    if (data.description) {
      this.#checkLength(c, ctx, "description", data.description)
    }
  }

  create = async (c: Context) => {
    return ProgramSchema.superRefine(async (data, ctx) => {
      // check length of key, name, description and color
      this.#checkDataProgramLength(c, ctx, data)

      // check if already exists
      const [key, name] = await Promise.all([
        this.repository.findOne(c, { key: data.key }),
        this.repository.findOne(c, { name: data.name }),
      ])
      conditionsMessage(
        ctx,
        c.var.t("validator.exist", {
          field: c.var.t("common.key"),
        }),
        !!key,
        ["key"]
      )
      conditionsMessage(
        ctx,
        c.var.t("validator.exist", {
          field: c.var.t("common.name"),
        }),
        !!name,
        ["name"]
      )
    })
  }

  list = async (c: Context) => {
    return ProgramParamsSchema.superRefine(async (data, ctx) => {
      const { sort_by, sort_type } = data
      const sortBys = ["name", "updated_at", "is_hierarchy_enabled"]
      const sortTypes = ["asc", "desc"]

      // validate boolean
      conditionsMessage(
        ctx,
        c.var.t("validator.boolean_number", {
          field: c.var.t("program.label.is_hierarchy_enabled"),
        }),
        !!data.is_hierarchy_enabled &&
          !["0", "1"].includes(data.is_hierarchy_enabled ?? ""),
        ["is_hierarchy_enabled"]
      )

      conditionsMessage(
        ctx,
        c.var.t("validator.boolean_number", {
          field: c.var.t("program.label.is_batch_enabled"),
        }),
        !!data.is_batch_enabled &&
          !["0", "1"].includes(data.is_batch_enabled ?? ""),
        ["is_batch_enabled"]
      )

      // validate sort_by and sort_type
      conditionsMessage(
        ctx,
        c.var.t("validator.one_of", {
          field: "sort_by",
          condition: sortBys,
        }),
        !!sort_by && !sortBys.includes(sort_by),
        ["sort_by"]
      )

      conditionsMessage(
        ctx,
        c.var.t("validator.one_of", {
          field: "sort_type",
          condition: sortTypes,
        }),
        !!sort_type && !sortTypes.includes(sort_type),
        ["sort_type"]
      )
    })
  }

  update = async (c: Context) => {
    return ProgramSchema.superRefine(async (data, ctx) => {
      const id = c.req.param("id")
      // check length of key, name, description and color
      this.#checkDataProgramLength(c, ctx, data)

      // check if already exists
      const [program, key, name] = await Promise.all([
        this.repository.findOne(c, { id }),
        this.repository.findOne(c, { key: data.key }),
        this.repository.findOne(c, { name: data.name }),
      ])
      conditionsMessage(
        ctx,
        c.var.t("validator.not_exist", {
          field: c.var.t("common.program"),
        }),
        !program,
        ["id"]
      )
      conditionsMessage(
        ctx,
        c.var.t("validator.exist", {
          field: c.var.t("common.key"),
        }),
        !!key && key.id !== Number(id),
        ["key"]
      )
      conditionsMessage(
        ctx,
        c.var.t("validator.exist", {
          field: c.var.t("common.name"),
        }),
        !!name && name.id !== Number(id),
        ["name"]
      )
    })
  }
}
