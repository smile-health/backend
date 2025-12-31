import { YES_NO_OPTIONS } from "@/common/constants/general.js"
import { IDENTITY_TYPE } from "@/common/constants/identity-type.js"
import { maritalStatus } from "@/common/constants/marital-status.js"
import { ValidationError } from "@smile/lib/error.js"
import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { validator } from "hono/validator"
import { z } from "zod"
import { LocationRepository } from "../location/location.repository.js"
import { PatientExcelRepository } from "./patient.excel.repository.js"
import {
  PatientImportRequestSchema,
  type PatientImportRequestDTO,
} from "./patient.excel.schema.js"

const getStr = (v: unknown) => String(v ?? "").trim()
const getOptStr = (v: unknown) => {
  const s = getStr(v)
  return s.length ? s : null
}
const getNumOrNull = (v: unknown) =>
  v == null || v === "" ? null : Number(v as string | number)

const fmtLabel = (c: Context, key: string) => {
  const text = c.var.t(key)
  return text ? `[${text}]` : ""
}

export type ColumnImportSchema = {
  Name: string
  IdentityType: string
  IdentityNumber: string
  DateOfBirth: string
  Gender: string
  Status: string
  Education: string
  Occupation: string
  Religion: string
  Ethnicity: string
  PhoneNumber: string
  Province: string
  City: string
  Address: string
  ProvinceResidence: string
  CityResidence: string
  residentialAddress: string
  DengueHistory: string
  Month: string
  Year: string
  VaccinationHistory: string
}

export class PatientExcelMiddleware {
  constructor(
    private readonly repo: PatientExcelRepository,
    private readonly locationRepo: LocationRepository
  ) {}

  readonly #patientColumns = (c: Context): ColumnImportSchema => ({
    Name: c.var.t("patient.label.name"),
    IdentityType: c.var.t("patient.label.identity_type"),
    IdentityNumber: c.var.t("patient.label.identity_number"),
    DateOfBirth: c.var.t("patient.label.date_of_birth"),
    Gender: c.var.t("patient.label.gender"),
    Status: c.var.t("patient.label.status"),
    Education: c.var.t("patient.label.education"),
    Occupation: c.var.t("patient.label.occupation"),
    Religion: c.var.t("patient.label.religion"),
    Ethnicity: c.var.t("patient.label.ethnicity"),
    PhoneNumber: c.var.t("patient.label.phone_number"),
    Province: c.var.t("patient.label.province"),
    City: c.var.t("patient.label.city"),
    Address: c.var.t("patient.label.address"),
    ProvinceResidence: c.var.t("patient.label.province_residence"),
    CityResidence: c.var.t("patient.label.city_residence"),
    residentialAddress: c.var.t("patient.label.residential_address"),
    DengueHistory: c.var.t("patient.label.dengue_history"),
    Month: c.var.t("patient.label.month"),
    Year: c.var.t("patient.label.year"),
    VaccinationHistory: c.var.t("patient.label.vaccination_history"),
  })

  #patientSchema(COL: ColumnImportSchema) {
    return z
      .object({
        [COL.Name]: z.any(),
        [COL.IdentityType]: z.any(),
        [COL.IdentityNumber]: z.any(),
        [COL.DateOfBirth]: z.any(),
        [COL.Gender]: z.any(),
        [COL.Status]: z.any(),
        [COL.Education]: z.any(),
        [COL.Occupation]: z.any(),
        [COL.Religion]: z.any(),
        [COL.Ethnicity]: z.any(),
        [COL.PhoneNumber]: z.any(),
        [COL.Province]: z.any(),
        [COL.City]: z.any(),
        [COL.Address]: z.any(),
        [COL.ProvinceResidence]: z.any(),
        [COL.CityResidence]: z.any(),
        [COL.residentialAddress]: z.any(),
        [COL.DengueHistory]: z.any(),
        [COL.Month]: z.any(),
        [COL.Year]: z.any(),
        [COL.VaccinationHistory]: z.any(),
      })
      .transform((row) => ({
        name: row[COL.Name],
        identity_type: row[COL.IdentityType],
        identity_number: row[COL.IdentityNumber],
        date_of_birth: row[COL.DateOfBirth],
        gender: row[COL.Gender],
        status: row[COL.Status] ?? null,
        education: row[COL.Education] ?? null,
        occupation: row[COL.Occupation] ?? null,
        religion: row[COL.Religion] ?? null,
        ethnicity: row[COL.Ethnicity] ?? null,
        phone_number: row[COL.PhoneNumber],
        province: row[COL.Province] ?? null,
        city: row[COL.City] ?? null,
        address: row[COL.Address] ?? null,
        province_residence: row[COL.ProvinceResidence] ?? null,
        city_residence: row[COL.CityResidence] ?? null,
        residential_address: row[COL.residentialAddress] ?? null,
        dengue_history: row[COL.DengueHistory] ?? null,
        month: row[COL.Month],
        year: row[COL.Year],
        vaccination_history: row[COL.VaccinationHistory] ?? null,
      }))
      .pipe(PatientImportRequestSchema)
  }

  async #getExcelRows(c: Context) {
    const fileRequest = c.get("fileRequest")

    const template = new BaseTemplate(10, 1, PROCESSOR.SHEETJS)
    await template.loadFromBuffer(fileRequest["buffer"])
    const rows = template.getRows()
    const startRow = template.getStartRow()

    return { rows, startRow }
  }

  #parseRows(
    rows: unknown[],
    startRow: number,
    schema: z.ZodType<PatientImportRequestDTO, z.ZodTypeDef, unknown>,
    c: Context
  ) {
    const parsedAtIndex: Array<PatientImportRequestDTO | null> = Array(
      rows.length
    ).fill(null)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowIdx = String(i + startRow)
      const parsed = schema.safeParse(row)

      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          const message = issue.message
          const key = String(issue.path[0] ?? "")
          const label = key ? fmtLabel(c, `patient.label.${key}`) : ""

          c.addError(rowIdx, message, label)
        })

        continue
      }

      parsedAtIndex[i] = parsed.data
    }

    return parsedAtIndex
  }

  excel = validator("json", async (val, c) => {
    const COL = this.#patientColumns(c)
    const Schema = this.#patientSchema(COL)
    const { rows, startRow } = await this.#getExcelRows(c)
    const parsedAtIndex = this.#parseRows(rows, startRow, Schema, c)

    const seen = new Set<string>()

    const cache = {
      education: new Map<string, boolean>(),
      occupation: new Map<string, boolean>(),
      religion: new Map<string, boolean>(),
      ethnic: new Map<string, boolean>(),
    }

    const existsIn = async (
      table: "educations" | "occupations" | "religions" | "ethnics",
      title?: string | null
    ) => {
      if (!title) return null

      const tableKeyMap = {
        educations: "education",
        occupations: "occupation",
        religions: "religion",
        ethnics: "ethnic",
      } as const

      const map = cache[tableKeyMap[table]] as Map<string, boolean>
      if (map.has(title)) return map.get(title)!

      const ok = (await this.repo.findByTitle(c, table, title)) != null
      map.set(title, ok)

      return ok
    }

    const getLocation = async (name: string, level: 0 | 1) => {
      return await this.locationRepo.findByName(c, name, level)
    }

    for (let idx = 0; idx < rows.length; idx++) {
      const rowIdx = String(idx + startRow)
      const raw = rows[idx] as Record<string, unknown>

      const identityType = getStr(raw[COL.IdentityType])
      const identityNumber = getStr(raw[COL.IdentityNumber])
      const gender = getStr(raw[COL.Gender])

      const status = getOptStr(raw[COL.Status])
      const education = getOptStr(raw[COL.Education])
      const occupation = getOptStr(raw[COL.Occupation])
      const religion = getOptStr(raw[COL.Religion])
      const ethnicity = getOptStr(raw[COL.Ethnicity])

      const province = getOptStr(raw[COL.Province])
      const city = getOptStr(raw[COL.City])
      const provinceResidence = getOptStr(raw[COL.ProvinceResidence])
      const cityResidence = getOptStr(raw[COL.CityResidence])

      const dengueHistory = getOptStr(raw[COL.DengueHistory])
      const vaccinationHistory = getOptStr(raw[COL.VaccinationHistory])
      const month = getNumOrNull(raw[COL.Month])
      const year = getNumOrNull(raw[COL.Year])

      if (
        !(
          identityType === IDENTITY_TYPE.NIK ||
          identityType === IDENTITY_TYPE.NON_NIK
        )
      ) {
        c.addError(
          rowIdx,
          "validator.string",
          fmtLabel(c, "patient.label.identity_type")
        )
      }

      if (seen.has(identityNumber)) {
        c.addError(
          rowIdx,
          "validator.duplicated",
          fmtLabel(c, "patient.label.identity_number")
        )
      } else {
        seen.add(identityNumber)
      }

      if (identityType === IDENTITY_TYPE.NIK) {
        const nik = String(identityNumber)
        if (!/^\d{16}$/.test(nik)) {
          c.addError(
            rowIdx,
            "validator.string",
            fmtLabel(c, "patient.label.identity_number")
          )
        }
      }

      if (!(gender === "L" || gender === "P")) {
        c.addError(
          rowIdx,
          "validator.string",
          fmtLabel(c, "patient.label.gender")
        )
      }

      if (status) {
        const ok = maritalStatus.some((m) => m.title === status)
        if (!ok)
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "patient.label.status")
          )
      }

      if (education) {
        const ok = await existsIn("educations", education)
        if (!ok)
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "patient.label.education")
          )
      }

      if (occupation) {
        const ok = await existsIn("occupations", occupation)
        if (!ok)
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "patient.label.occupation")
          )
      }

      if (religion) {
        const ok = await existsIn("religions", religion)
        if (!ok)
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "patient.label.religion")
          )
      }

      if (ethnicity) {
        const ok = await existsIn("ethnics", ethnicity)
        if (!ok)
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "patient.label.ethnicity")
          )
      }

      if (province && city) {
        const [provRow, cityRow] = await Promise.all([
          getLocation(province, 0),
          getLocation(city, 1),
        ])

        if (!provRow)
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "patient.label.province")
          )
        if (!cityRow)
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "patient.label.city")
          )

        if (
          provRow &&
          cityRow &&
          Number(cityRow.parent_id) !== Number(provRow.id)
        ) {
          c.addError(
            rowIdx,
            "validator.not_match",
            fmtLabel(c, "patient.label.city")
          )
        }
      }

      if (provinceResidence && cityResidence) {
        const [provRow, cityRow] = await Promise.all([
          getLocation(provinceResidence, 0),
          getLocation(cityResidence, 1),
        ])

        if (!provRow)
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "patient.label.province_residence")
          )
        if (!cityRow)
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "patient.label.city_residence")
          )

        if (
          provRow &&
          cityRow &&
          Number(cityRow.parent_id) !== Number(provRow.id)
        ) {
          c.addError(
            rowIdx,
            "validator.not_match",
            fmtLabel(c, "patient.label.city_residence")
          )
        }
      }

      if (
        dengueHistory != null &&
        dengueHistory !== YES_NO_OPTIONS.YES &&
        dengueHistory !== YES_NO_OPTIONS.NO
      ) {
        c.addError(
          rowIdx,
          "validator.string",
          fmtLabel(c, "patient.label.dengue_history")
        )
      }

      if (
        vaccinationHistory != null &&
        vaccinationHistory !== YES_NO_OPTIONS.YES &&
        vaccinationHistory !== YES_NO_OPTIONS.NO
      ) {
        c.addError(
          rowIdx,
          "validator.string",
          fmtLabel(c, "patient.label.vaccination_history")
        )
      }

      if (dengueHistory === YES_NO_OPTIONS.YES) {
        if (month == null)
          c.addError(
            rowIdx,
            "validator.required",
            fmtLabel(c, "patient.label.month")
          )
        if (year == null)
          c.addError(
            rowIdx,
            "validator.required",
            fmtLabel(c, "patient.label.year")
          )
        if (month != null && !(month >= 1 && month <= 12)) {
          c.addError(
            rowIdx,
            c.var.t("validator.between", {
              field: fmtLabel(c, "patient.label.month"),
              value: "1 - 12",
            })
          )
        }
        const currentYear = new Date().getFullYear()
        if (year != null && !(year <= currentYear)) {
          c.addError(
            rowIdx,
            c.var.t("validator.range_of_must_be_equal", {
              field: fmtLabel(c, "patient.label.year"),
              value: currentYear,
            })
          )
        }
      }
    }

    if (c.var.errors) {
      throw new ValidationError()
    }

    const parsedRows = parsedAtIndex as PatientImportRequestDTO[]
    return parsedRows
  })

  logErrors = createMiddleware(async (c, next) => {
    await next()

    if (c.var.errors) {
      const userId = c.var.user.id
      const data = {
        file: c.var.fileRequest.filename ?? "template.xlsx",
        status: 0,
        notes: JSON.stringify(c.var.errors),
        created_at: new Date(),
        created_by: userId,
        updated_at: new Date(),
        updated_by: userId,
      }

      await this.repo.createLogImportPatient(null, data)
    }
  })
}
