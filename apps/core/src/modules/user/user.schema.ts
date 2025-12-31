import {
  getTranslateUserColumnExcel,
  REGEX_PASS,
  USER_STATUS,
  USER_VIEW_ONLY,
  DAILY_RECAP_EMAIL,
} from "@/common/constants/users.js"
import {
  Locations,
  Manufactures,
  Roles,
  UserChangelogs,
  Users,
  Workspaces,
} from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import {
  containsOnlyUnderscoresPeriod,
  hasWhiteSpace,
  isDateMoreThanNow,
  isStringNumbers,
  transformStringNumbersToArrayNumbers,
} from "@smile/lib/utils.js"
import { conditionsMessage } from "@smile/lib/zod.js"
import { Context } from "hono"
import { Selectable } from "kysely"
import moment from "moment"
import z from "zod"

export function extractJSONFromString(str) {
  const jsonRegex = /{(?:[^{}]|"(?:\\.|[^"\\])*")*}/g
  const matches = str.match(jsonRegex)

  if (!matches) return null // Jika tidak ada JSON, return null

  return matches
    .map((jsonStr) => {
      try {
        return JSON.parse(jsonStr) // Validasi dengan JSON.parse()
      } catch (e) {
        return null
      }
    })
    .filter((json) => json !== null) // Hanya return JSON yang valid
}

const EmptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.length === 0 ? undefined : value

export function stringNumber() {
  return z.preprocess(
    EmptyStringToUndefined,
    z.coerce
      .number()
      .int()
      .nonnegative()
      .refine((v) => !isNaN(v))
  )
}

export function stringMinMax(min?: number, max?: number) {
  return z.coerce.string().min(min!).max(max!)
}

export function positiveNumber() {
  return z.coerce.number().int().nonnegative()
}

export function splitNumberArray() {
  return z.preprocess(
    (value) => (typeof value === "number" ? String(value) : value),
    z.coerce
      .string()
      .refine((val) => val.split("|").every((num) => !isNaN(Number(num))), {
        message: "validator.string",
      })
      .transform((val) => (val === "" ? [] : val.split("|").map(Number)))
  )
}

export function excelDateToJSDate(value: unknown) {
  if (typeof value == "number") {
    const hours = Math.floor((value % 1) * 24)
    const minutes = Math.floor(((value % 1) * 24 - hours) * 60)
    return new Date(Date.UTC(0, 0, value, hours - 17, minutes))
  }
  if (
    typeof value == "string" &&
    new Date(value) instanceof Date &&
    !isNaN(new Date(value).getTime())
  ) {
    return value
  }
}

export function stringDate() {
  return z.preprocess(
    (value) =>
      (typeof value == "string" &&
        new Date(value) instanceof Date &&
        !isNaN(new Date(value).getTime())) ||
      typeof value == "number"
        ? moment(excelDateToJSDate(value)).format("YYYY-MM-DD")
        : EmptyStringToUndefined,
    stringMinMax().transform((str) => new Date(str))
  )
}

export const general = z.object({
  firstname: stringMinMax(2, 255),
  lastname: z.preprocess(
    EmptyStringToUndefined,
    stringMinMax(undefined, 255).nullish()
  ),
  email: stringMinMax(1, 255)
    .email()
    .superRefine((val, c) => {
      conditionsMessage(
        c,
        "validator.email",
        !RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).exec(val.trim())
      )
    }),
  gender: stringNumber(),
  mobile_phone: z.preprocess(
    EmptyStringToUndefined,
    stringMinMax(8, 15)
      .superRefine((val, c) => {
        conditionsMessage(
          c,
          "validator.string",
          !RegExp(/^\+[1-9]\d{1,14}$/).exec(val)
        )
      })
      .nullish()
  ),
  daily_recap_email: z.literal(0).or(z.literal(1)).nullish(),
  date_of_birth: stringDate()
    .superRefine((val, c) => {
      if (val) {
        conditionsMessage(c, "validator.string", isDateMoreThanNow(val))
      }
    })
    .nullish(),
  role: stringNumber(),
  external_roles: z.array(z.string()).nullish(),
  address: z.string().nullish(),
  village_id: stringMinMax().nullish(),
  entity_id: stringNumber(),
  program_ids: z.array(positiveNumber()).nullish(),
  token_login: z.string().nullish(),
  view_only: positiveNumber().optional().default(0),
  manufacture_id: stringNumber().nullish(),
  timezone_id: positiveNumber().nullish(),
  created_by: positiveNumber().nullish(),
  updated_by: positiveNumber().nullish(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  integration_client_id: z.number().optional(),
  external_properties: z.record(z.any()).optional(),
})

export const profile = z.object({
  id: z.union([stringNumber(), z.string()]),
})

export const add = general.extend({
  username: stringMinMax(3, 255).superRefine((val, c) => {
    conditionsMessage(
      c,
      "validator.string",
      !containsOnlyUnderscoresPeriod(val) || !hasWhiteSpace(val)
    )
  }),
  password: stringMinMax(8, 255).superRefine((val, c) => {
    conditionsMessage(
      c,
      "validator.password",
      val.length < 8 || !REGEX_PASS.test(val)
    )
  }),
})

export const update = general.extend({
  username: stringMinMax(3, 255).superRefine((val, c) => {
    conditionsMessage(
      c,
      "validator.string",
      !containsOnlyUnderscoresPeriod(val) || !hasWhiteSpace(val)
    )
  }),
  password: stringMinMax(8, 255)
    .superRefine((val, c) => {
      conditionsMessage(
        c,
        "validator.password",
        val.length < 8 || !REGEX_PASS.test(val)
      )
    })
    .nullish(),
})

export const UserQueriesSchema = PaginationQueriesSchema.omit({
  status: true,
}).extend({
  role: stringNumber().nullish(),
  entity_id: stringNumber().nullish(),
  province_id: z
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
  regency_id: z
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
  start_date: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  end_date: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  user_uuid: z
    .string()
    .uuid()
    .superRefine((val, cfx) => {
      if (val) {
        conditionsMessage(
          cfx,
          "validator.unmatch",
          !RegExp(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          ).exec(val.trim())
        )
      }
    })
    .nullish(),
  program_ids: z
    .string()
    .nullish()
    .refine((val) => !val || isStringNumbers(val))
    .transform((val) =>
      val ? transformStringNumbersToArrayNumbers(val) : null
    ),
  external_properties: z.coerce.boolean().optional(),
  sort_by: z
    .enum([
      "username",
      "fullname",
      "role_label",
      "entity_label",
      "last_login",
      "",
    ])
    .optional(),
  sort_type: z.enum(["asc", "desc", ""]).optional(),
})

export const CreateUserWorkspaceSchema = z.object({
  user_id: stringNumber(),
  workspace_id: stringNumber(),
})

export const UpdateStatusSchema = z.object({
  status: z.number().superRefine((val, c) => {
    const existVal = Object.values(USER_STATUS).indexOf(val)
    if (existVal === -1) {
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.string",
        path: ["status"],
      })
    }
  }),
})

export const UpdateLastLoginSchema = z.object({
  fcm_token: z.coerce.string().nullish(),
  last_device: z.coerce.string().nullish(),
  last_login: z.coerce
    .date()
    .refine((value) => value, { message: "validate.date" })
    .nullish(),
})
export type UpdateLastLoginRequest = z.infer<typeof UpdateLastLoginSchema>

export const ValidateUserExistsSchema = z.object({
  username: stringMinMax(3, 255).superRefine((val, c) => {
    conditionsMessage(
      c,
      "validator.string",
      !containsOnlyUnderscoresPeriod(val) || !hasWhiteSpace(val)
    )
  }),
})
export type ValidateUserExistsRequest = z.infer<typeof ValidateUserExistsSchema>

export const ImportUserRowSchema = (c: Context) => {
  const columnExcel = getTranslateUserColumnExcel(c)
  return z.object({
    [columnExcel.Username]: stringMinMax(4, 255).superRefine((val, c) => {
      if (!containsOnlyUnderscoresPeriod(val) || !hasWhiteSpace(val)) {
        c.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.string",
        })
      }
    }),
    [columnExcel.IDRole]: stringNumber(),
    [columnExcel.ViewOnly]: z
      .string()
      .superRefine((val, c) => {
        const existVal = USER_VIEW_ONLY.includes(val?.toLowerCase())
        if (!existVal) {
          c.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.string",
          })
        }
      })
      .default("no")
      .transform((val) => {
        const temp = val?.toLowerCase() === "yes" ? 1 : 0
        return temp
      }),
    [columnExcel.Firstname]: general.shape.firstname,
    [columnExcel.Lastname]: general.shape.lastname,
    [columnExcel.Email]: general.shape.email,
    [columnExcel.DailyRecapEmail]: z
      .string()
      .superRefine((val, c) => {
        const existVal = ["yes", "no"].includes(val?.toLowerCase())
        if (!existVal) {
          c.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.string",
          })
        }
      })
      .default("no")
      .transform((val) => {
        const temp =
          val?.toLowerCase() === "yes"
            ? DAILY_RECAP_EMAIL.YES
            : DAILY_RECAP_EMAIL.NO
        return temp
      }),
    [columnExcel.IDGender]: general.shape.gender,
    [columnExcel.Password]: stringMinMax(8, 255).superRefine((val, c) => {
      if (val.length < 8 || !REGEX_PASS.test(val)) {
        c.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.password",
        })
      }
    }),
    [columnExcel.Address]: general.shape.address,
    [columnExcel.IDVillage]: z.preprocess(
      (val) => (typeof val === "number" ? val.toString() : val),
      general.shape.village_id
    ),
    [columnExcel.BirthDate]: general.shape.date_of_birth,
    [columnExcel.MobilePhone]: general.shape.mobile_phone,
    [columnExcel.IDEntity]: general.shape.entity_id,
    [columnExcel.IDProgram]: splitNumberArray(),
    [columnExcel.IDManufacture]: stringNumber().nullish(),
  })
}

export const transformImportUserRowSchema = (
  c: Context,
  row: TImportUserRequest
) => {
  const columnExcel = getTranslateUserColumnExcel(c)
  return {
    username: row[columnExcel.Username],
    role: row[columnExcel.IDRole],
    view_only: row[columnExcel.ViewOnly],
    firstname: row[columnExcel.Firstname],
    lastname: row[columnExcel.Lastname],
    email: row[columnExcel.Email],
    daily_recap_email: row[columnExcel.DailyRecapEmail],
    gender: row[columnExcel.IDGender],
    password: row[columnExcel.Password],
    address: row[columnExcel.Address],
    village_id: row[columnExcel.IDVillage],
    date_of_birth: row[columnExcel.BirthDate],
    mobile_phone: row[columnExcel.MobilePhone],
    entity_id: row[columnExcel.IDEntity],
    program_ids: row[columnExcel.IDProgram],
    manufacture_id: row[columnExcel.IDManufacture],
  } as TImportUser
}

export const ImportUserRowsSchema = (c: Context) =>
  z.array(ImportUserRowSchema(c)).min(1, {
    message: `${c.var.t("validator.not_empty")}`,
  })

export type TCreateUserReq = z.infer<typeof add>

export type TUpdateUserReq = Partial<z.infer<typeof update>>

export type TIdUserReq = z.infer<typeof profile>

export interface TExistData<T> {
  value: T
  column?: string
  message?: string
}

export interface TEntities {
  type: number
  address: string | null
  id: number
  name: string | null
  tag: string | null
  location: string
  programs?: TWorkspaces[]
}
export type TUsers = Partial<
  Pick<Selectable<Users>, "id" | "firstname" | "lastname">
> & { user_id?: number }
export type TWorkspaces = Partial<
  Pick<Selectable<Workspaces>, "id" | "name" | "key" | "config">
> & { user_id?: number; entity_id?: number }
export type TLocationDetail = Partial<Selectable<Locations>>
export interface TLocation {
  province?: TLocationDetail
  regency?: TLocationDetail
  subdistrict?: TLocationDetail
  village?: TLocationDetail
}
export type UserResponse = Selectable<Users> & {
  password?: string | null
  role_label?: string
  external_roles: string[]
  gender_label?: string
  location?: TLocation
  entity?: TEntities
  manufacture?: Selectable<Manufactures>
  programs?: TWorkspaces[]
  program_ids?: number[]
  beneficiaries_ids?: number[]
  user_created_by?: Pick<UserResponse, "id" | "firstname" | "lastname">
  user_updated_by?: Pick<UserResponse, "id" | "firstname" | "lastname">
}

export interface TUserWorkspace {
  user_id: number
  workspace_id: number
  entity_id?: number
}

export type TRole = Pick<Selectable<Roles>, "id" | "name">

export type GetUserQueries = z.infer<typeof UserQueriesSchema> & {
  isPaginate?: boolean
}

export type TCreateUserWorkspaceSchema = z.infer<
  typeof CreateUserWorkspaceSchema
>
export type TUpdateUserWorkspaceSchema = Partial<TCreateUserWorkspaceSchema>

export interface UserChangeLogsRequest {
  user_id: number
  field: string
  old_value: string
  new_value: string
  updated_by?: string
}
export interface UserChangeLogsResponse extends Selectable<UserChangelogs> {}

export type UpdateStatusRequest = z.infer<typeof UpdateStatusSchema>

export type TImportUser = Pick<
  TCreateUserReq,
  | "username"
  | "role"
  | "email"
  | "daily_recap_email"
  | "view_only"
  | "firstname"
  | "lastname"
  | "gender"
  | "password"
  | "address"
  | "village_id"
  | "date_of_birth"
  | "mobile_phone"
  | "entity_id"
  | "program_ids"
  | "manufacture_id"
>
export type TImportUserRequest = z.infer<ReturnType<typeof ImportUserRowSchema>>

export interface TExportUser {
  id: number
  username: string | null
  fullname: string
  last_login: Date | null
  created_at: string
  updated_at: string
  role_label?: string
  entity?: string | null
  program?: string
  user_created_by?: string
  user_updated_by?: string
  daily_recap_email?: string
  status?: string
}
