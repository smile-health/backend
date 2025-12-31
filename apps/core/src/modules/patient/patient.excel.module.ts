import { YES_NO_OPTIONS } from "@/common/constants/general.js"
import { IDENTITY_TYPE } from "@/common/constants/identity-type.js"
import { maritalStatus } from "@/common/constants/marital-status.js"
import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import path from "path"
import { EducationRepository } from "../education/education.repository.js"
import { EthnicRepository } from "../ethnic/ethnic.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import { OccupationRepository } from "../occupation/occupation.repository.js"
import { ReligionRepository } from "../religion/religion.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { PatientExcelRepository } from "./patient.excel.repository.js"
import type {
  GetImportLogQueries,
  PatientImportRequestDTO,
} from "./patient.excel.schema.js"

export class PatientExcelModule {
  constructor(
    private readonly repo: PatientExcelRepository,
    private readonly userRepo: UserRepository,
    private readonly locationRepo: LocationRepository,
    private readonly educationRepo: EducationRepository,
    private readonly occupationRepo: OccupationRepository,
    private readonly religionRepo: ReligionRepository,
    private readonly ethnicRepo: EthnicRepository
  ) {}

  async getExcelTemplate(c: Context) {
    const language = c.var.language
    const filename = `patient_${language}.xlsx`
    const templatePath = path.resolve(
      "public",
      "templates",
      "patient",
      filename
    )

    const SHEET_DATA_INPUT = "patient.template.sheet_data_input"
    const SHEET_MASTER_DATA = "patient.template.sheet_master_data"
    const VALIDATION_LAST_ROW = 5010

    const excelTemplate = new BaseTemplate(10, 1, PROCESSOR.EXCELJS)
    await excelTemplate.loadFromFile(templatePath)

    const [educations, occupations, religions, ethnics, provinces, cities] =
      await Promise.all([
        this.educationRepo.getEducations(c),
        this.occupationRepo.getOccupations(c),
        this.religionRepo.getReligions(c),
        this.ethnicRepo.getEthnics(c),
        this.locationRepo.getLocations(c, 0),
        this.locationRepo.getLocations(c, 1),
      ])

    const masterDataPromises = [
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        [{ name: IDENTITY_TYPE.NIK }, { name: IDENTITY_TYPE.NON_NIK }],
        2,
        "A"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        language === "en"
          ? [{ name: "M" }, { name: "F" }]
          : [{ name: "L" }, { name: "P" }],
        2,
        "B"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        maritalStatus.map((m) => ({
          name: c.var.t(`marital_status.label.${m.title}`),
        })),
        2,
        "C"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        educations.map((e) => ({
          name: c.var.t(`education.label.${e.title}`),
        })),
        2,
        "D"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        occupations.map((e) => ({
          name: c.var.t(`occupation.label.${e.title}`),
        })),
        2,
        "E"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        religions.map((e) => ({ name: c.var.t(`religion.label.${e.title}`) })),
        2,
        "F"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        ethnics.map((e) => ({ name: c.var.t(`ethnic.label.${e.title}`) })),
        2,
        "G"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        provinces.map((e) => ({ name: e.name })),
        2,
        "H"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        cities.map((e) => ({ name: e.name })),
        2,
        "I"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        language === "en"
          ? [{ name: "Yes" }, { name: "No" }]
          : [{ name: "Ya" }, { name: "Tidak" }],
        2,
        "J"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        language === "en"
          ? [{ name: "Yes" }, { name: "No" }]
          : [{ name: "Ya" }, { name: "Tidak" }],
        2,
        "K"
      ),
      excelTemplate.addRows(
        c.var.t(SHEET_MASTER_DATA),
        Array.from({ length: 12 }, (_, i) => ({ name: i + 1 })),
        2,
        "L"
      ),
    ]

    await Promise.allSettled(masterDataPromises)
    await excelTemplate.protectSheet(c.var.t(SHEET_MASTER_DATA), "unsmile")

    const validationPromises = [
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "B",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "A",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "E",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "B",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "F",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "C",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "G",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "D",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "H",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "E",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "I",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "F",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "J",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "G",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "L",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "H",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "M",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "I",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "O",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "H",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "P",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "I",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "R",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "J",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "S",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "L",
        2,
        false
      ),
      excelTemplate.addDataValidation(
        c.var.t(SHEET_DATA_INPUT),
        "U",
        10,
        VALIDATION_LAST_ROW,
        c.var.t(SHEET_MASTER_DATA),
        "K",
        2,
        false
      ),
    ]

    await Promise.allSettled(validationPromises)

    const generatedExcel = await excelTemplate.generate(
      `Template - ${c.var.t("common.import")} ${c.var.t("patient.template.title")}`
    )

    return generatedExcel
  }

  async getImportLog(c: Context, query: GetImportLogQueries) {
    const { data, total } = await this.repo.getImportLog(c, query)

    const userIds = Array.from(
      new Set(
        data.map((r) => r.created_by).filter((id): id is number => id !== null)
      )
    )
    const mapUsers = await this.userRepo.getBasicDetailMapped(c, userIds)

    const parseNotes = (notes: unknown): unknown => {
      if (notes == null) return null
      if (typeof notes === "string") {
        try {
          const cleaned = JSON.parse(`"${notes}"`)
          return JSON.parse(cleaned)
        } catch {
          return notes
        }
      }
      if (typeof notes === "object") {
        return Object.keys(notes as object).length ? (notes as unknown) : null
      }
      return null
    }

    const list = data.map((res) => ({
      ...res,
      notes: parseNotes(res.notes),
      user_created_by: mapUsers[(res.created_by ?? 0) as number],
    }))

    return new PaginatedResponse(query, list, total)
  }

  async import(c: Context, rows: PatientImportRequestDTO[]) {
    const startSummary = {
      total: rows.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; message: string }>,
    }

    const cache = {
      education: new Map<string, number>(),
      occupation: new Map<string, number>(),
      religion: new Map<string, number>(),
      ethnic: new Map<string, number>(),
    }

    const existIn = async (
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

      const map = cache[tableKeyMap[table]] as Map<string, number>
      if (map.has(title)) return map.get(title)!

      const id = await this.repo.findByTitle(c, table, title)
      if (id != null) map.set(title, id)

      return id
    }

    const resolveProvinceAndCity = async (
      provinceName?: string | null,
      cityName?: string | null
    ) => {
      const [provRow, cityRow] = await Promise.all([
        provinceName
          ? this.locationRepo.findByName(c, provinceName, 0)
          : Promise.resolve(null),
        cityName
          ? this.locationRepo.findByName(c, cityName, 1)
          : Promise.resolve(null),
      ])

      return {
        province_id: provRow ? provRow.id : null,
        regency_id: cityRow ? cityRow.id : null,
      }
    }

    for (const [i, row] of rows.entries()) {
      const rowIndex = i + 1

      try {
        const identityType = row.identity_type === IDENTITY_TYPE.NIK ? 1 : 2
        const gender = row.gender === "L" ? 1 : 2

        const [education_id, occupation_id, religion_id, ethnic_id] =
          await Promise.all([
            existIn("educations", row.education),
            existIn("occupations", row.occupation),
            existIn("religions", row.religion),
            existIn("ethnics", row.ethnicity),
          ])

        const { province_id, regency_id } = await resolveProvinceAndCity(
          row.province,
          row.city
        )

        const { province_id: res_province_id, regency_id: res_regency_id } =
          await resolveProvinceAndCity(
            row.province_residence,
            row.city_residence
          )

        const ms =
          row.status != null
            ? maritalStatus.find((m) => m.title === row.status)?.id
            : undefined

        await this.repo.upsertPatient(c, {
          identity_type: identityType,
          identity_number: row.identity_number,
          name: row.name ?? null,
          phone_number: row.phone_number ?? null,
          gender,
          date_of_birth: row.date_of_birth ?? null,
          ...(ms !== undefined ? { marital_status: ms } : {}),
          religion_id: religion_id ?? null,
          ethnic_id: ethnic_id ?? null,
          education_id: education_id ?? null,
          occupation_id: occupation_id ?? null,
          province_id: province_id ?? null,
          regency_id: regency_id ?? null,
          address: row.address ?? null,
          residential_province_id: res_province_id ?? null,
          residential_regency_id: res_regency_id ?? null,
          residential_address: row.residential_address ?? null,
        })

        if (row.dengue_history === YES_NO_OPTIONS.YES) {
          const patientId = await this.repo.getPatientIdByIdentity(
            c,
            identityType,
            row.identity_number
          )

          if (patientId) {
            const isDiagnose = row.dengue_history === YES_NO_OPTIONS.YES ? 1 : 0
            const receivedVaccine =
              row.vaccination_history === YES_NO_OPTIONS.YES ? 1 : 0

            await this.repo.insertPatientMedicalHistory(c, {
              patientId,
              protocolId: 2,
              isDiagnose,
              receivedVaccine,
              month: row.month ?? null,
              year: row.year ?? null,
            })
          }
        }

        startSummary.success += 1
      } catch (e) {
        startSummary.failed += 1
        const msg = (e as Error)?.message || "failed"
        startSummary.errors.push({ row: rowIndex, message: msg })
      }
    }

    return startSummary
  }

  async logImport(c: Context) {
    const userID = c.var.user.id
    const data = {
      file: c.var.fileRequest.filename ?? "template.xlsx",
      status: c.var.errors ? 0 : 1,
      notes: JSON.stringify(c.var.errors ?? {}),
      created_at: new Date(),
      created_by: userID!,
      updated_at: new Date(),
      updated_by: userID!,
    }

    await this.repo.createLogImportPatient(c, data)
  }
}
