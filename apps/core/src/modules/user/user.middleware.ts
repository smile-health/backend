import {
  getTranslateUserColumnExcel,
  ROW_SHEET_USER,
  USER_ROLE,
} from "@/common/constants/users.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import {
  add,
  ImportUserRowSchema,
  TExistData,
  TImportUser,
  transformImportUserRowSchema,
  update,
} from "@/modules/user/user.schema.js"
import { ValidationError } from "@smile/lib/error.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { conditionsMessage, translateError } from "@smile/lib/zod.js"
import { Context } from "hono"
import { validator } from "hono/validator"
import { z } from "zod"
import { RoleRepository } from "../role/role.repository.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { UserTemplateXlsx } from "./user.excel.js"

export class UsersMiddleware {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly roleRepo: RoleRepository,
    private readonly programRepo: WorkspaceRepository
  ) {}

  async #isDataExist(c: Context, data: TExistData<string>) {
    const exists = await this.userRepo.dataExists(c, {
      column: data.column,
      value: data.value,
    })

    return {
      data: exists,
      is_data: !!exists,
    }
  }

  readonly #isRoleExist = async (c: Context, data: TExistData<number>) => {
    const roles = await this.roleRepo.getRoles(c)
    const checkRole = roles.find((el) => el.id == data.value)

    return checkRole
  }

  async #isRowExcelEmpty(c: Context) {
    const excelTemplate = new UserTemplateXlsx()
    await excelTemplate.loadFromBuffer(
      Buffer.from(c.get("fileRequest")["buffer"])
    )
    const rows = excelTemplate.getRows(c.var.t("common.data_entry"))

    if (rows.length === 0) {
      throw new ValidationError(c.var.t("validator.not_content"))
    }

    return rows
  }

  #validateIsRoleVendorIotManufacture(
    c: Context,
    input: unknown,
    ctx: z.RefinementCtx
  ) {
    // skip validate manufacture for wms
    if (c.var.client) return

    const parsed = add
      .pick({
        role: true,
        manufacture_id: true,
      })
      .safeParse(input)

    if (parsed.success) {
      const { role, manufacture_id } = parsed.data
      if (role === USER_ROLE.MANUFACTURE && !manufacture_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manufacture_id"],
          message: "validator.not_empty",
        })
      }
    }
  }

  async #isProgramExist(c: Context, programIds?: number[] | null) {
    if (!programIds?.length) return true
    const collectProgramIds = await this.programRepo.getIDs(c)
    const result = programIds.every((id) => collectProgramIds.includes(id))
    return result
  }

  async #checkParseExcel(c: Context, rows: object[]) {
    // define error and result and key and duplicate
    const mapError = {}
    const finalResult: TImportUser[] = []
    const listRoleID: number[] = []
    const duplicateUsername = new Set<string>()
    const duplicateEmail = new Set<string>()
    const userColumnExcel = getTranslateUserColumnExcel(c)
    const importSchema = ImportUserRowSchema(c)

    rows.forEach((row) => {
      listRoleID.push(row[userColumnExcel.IDRole])
    })
    const uniqListRoleID = [...new Set(listRoleID)]

    const roles = await this.roleRepo.findByIDMapped(c, uniqListRoleID)
    // loop rows data
    for (let index = 0; index < rows.length; index++) {
      // parse row to schema object
      const parseToSchema = await importSchema
        .extend({
          [userColumnExcel.Username]: importSchema.shape[
            userColumnExcel.Username
          ]?.superRefine(async (val, cfx) => {
            if (duplicateUsername.has(rows[index]![userColumnExcel.Username])) {
              cfx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "validator.duplicated",
                path: [userColumnExcel.Username],
              })
            } else {
              duplicateUsername.add(rows[index]![userColumnExcel.Username])
            }
          }),

          [userColumnExcel.Email]: importSchema.shape[
            userColumnExcel.Email
          ]?.superRefine(async (val, cfx) => {
            if (duplicateEmail.has(rows[index]![userColumnExcel.Email])) {
              cfx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "validator.duplicated",
                path: [userColumnExcel.Email],
              })
            } else {
              duplicateEmail.add(rows[index]![userColumnExcel.Email])
            }
          }),
          [userColumnExcel.IDRole]: importSchema.shape[
            userColumnExcel.IDRole
          ]?.superRefine(async (val, cfx) => {
            const checkRole =
              roles[Number(rows[index]![userColumnExcel.IDRole])]

            if (checkRole) {
              c.set("role_label", checkRole?.name)
            } else {
              cfx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "validator.unmatch",
                path: [userColumnExcel.IDRole],
              })
            }
          }),

          [userColumnExcel.IDProgram]: importSchema.shape[
            userColumnExcel.IDProgram
          ]?.superRefine(async (val, cfx) => {
            const programIds = val
            // check program ids is not duplicate
            const uniqueProgramIds = [...new Set(programIds)]
            if (programIds.length !== uniqueProgramIds.length) {
              cfx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "validator.duplicated",
                path: [userColumnExcel.IDProgram],
              })
            }
          }),
        })
        .superRefine(async (val, cfx) => {
          if (
            rows[index]![userColumnExcel.IDRole] == USER_ROLE.MANUFACTURE &&
            !rows[index]![userColumnExcel.IDManufacture]
          ) {
            cfx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "validator.not_empty",
              path: [userColumnExcel.IDManufacture],
            })
          }
        })
        .transform((row) => transformImportUserRowSchema(c, row))
        .safeParseAsync(rows[index])

      // if error push to errors list
      if (!parseToSchema.success) {
        for (const error of parseToSchema.error.issues) {
          if (!mapError[`row ${index + ROW_SHEET_USER}`]) {
            mapError[`row ${index + ROW_SHEET_USER}`] = []
          }

          mapError[`row ${index + ROW_SHEET_USER}`].push(
            translateError(error, c.var.t)
          )
        }
      }

      finalResult.push(parseToSchema.data!)
    }

    if (Object.keys(mapError).some((key) => mapError[key].length > 0)) {
      c.set("errors", mapError)
      throw new ValidationError()
    }
    return finalResult
  }

  parseExcelData = validator("json", async (val, c) => {
    const rows = await this.#isRowExcelEmpty(c)
    const result = await this.#checkParseExcel(c, rows)
    return result
  })

  create = (c: Context) => {
    const created = z.preprocess(
      async (input, ctx) => {
        this.#validateIsRoleVendorIotManufacture(c, input, ctx)

        return input
      },
      add.extend({
        role: add.shape.role.superRefine(async (val, ctx) => {
          const roleExist = (await this.roleRepo.getRoles(c)).find(
            (el) => el.id == val
          )
          if (!roleExist) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "validator.not_exist",
            })
          }
        }),
        program_ids: add.shape.program_ids.superRefine(async (val, cfx) => {
          const programIdExist = await this.#isProgramExist(c, val)
          conditionsMessage(cfx, "validator.not_exist", !programIdExist)
        }),
        integration_client_id: z
          .number()
          .superRefine(async (val, ctx) => {
            const result = await c.var.trx
              .selectFrom("integration_clients as ic")
              .where("ic.id", "=", [val])
              .select(["id"])
              .execute()
            if (result.length === 0) {
              ctx.addIssue({
                message: c.var.t("validator.not_exist", {
                  field: "integration_clients",
                }),
                code: "custom",
              })
            }
          })
          .optional(),
      })
    )
    return created
  }
  update = (c: Context) => {
    const param = c.req.param("id")
    return z.preprocess(
      async (input, ctx) => {
        this.#validateIsRoleVendorIotManufacture(c, input, ctx)

        return input
      },
      update
        .extend({
          role: add.shape.role.superRefine(async (val, ctx) => {
            const roleExist = (await this.roleRepo.getRoles(c)).find(
              (el) => el.id == val
            )
            if (!roleExist) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "validator.not_exist",
              })
            }
          }),
          program_ids: add.shape.program_ids.superRefine(async (val, cfx) => {
            const programIdExist = await this.#isProgramExist(c, val)
            conditionsMessage(cfx, "validator.not_exist", !programIdExist)
          }),
          integration_client_id: z
            .number()
            .superRefine(async (val, ctx) => {
              const result = await c.var.trx
                .selectFrom("integration_clients as ic")
                .where("ic.id", "=", [val])
                .select(["id"])
                .execute()
              if (result.length === 0) {
                ctx.addIssue({
                  message: c.var.t("validator.not_exist", {
                    field: "integration_clients",
                  }),
                  code: "custom",
                })
              }
            })
            .optional(),
        })
        .superRefine(async (val, cfx) => {
          const dataPrev = await this.userRepo.dataExists(c, {
            column: "id",
            value: param,
          })
          const roleExist = await this.#isRoleExist(c, {
            column: "role",
            value: val.role,
          })

          if (dataPrev && dataPrev.username !== val.username) {
            const usernameExist = await this.#isDataExist(c, {
              column: "username",
              value: val.username,
            })
            conditionsMessage(cfx, "validator.exist", usernameExist.is_data, [
              "username",
            ])
          }
          if (dataPrev && dataPrev.email !== val.email) {
            const emailExist = await this.#isDataExist(c, {
              column: "email",
              value: val.email,
            })
            conditionsMessage(cfx, "validator.exist", emailExist.is_data, [
              "email",
            ])
          }
          conditionsMessage(cfx, "validator.unmatch", !roleExist, ["role"])
        })
    )
  }
}
