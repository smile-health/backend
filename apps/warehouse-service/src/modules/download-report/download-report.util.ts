import momentTZ from "moment-timezone"
import { ConfigProgram } from "./download-report.schema.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { UploadExportToMinio } from "./download-report.minio.js"
import fs from "fs"

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  return { month, year }
}

export function getProvinceAndRegency(user) {
  if (user.entity.type === 1)
    return { province_id: user.entity.province_id, regency_id: null }
  return {
    province_id: user.entity.province_id,
    regency_id: user.entity.regency_id,
  }
}

export function getFullnameUser(user) {
  return `${user.firstname || ""} ${user.lastname || ""}`
}

export function convertFormatedDate(currentTime?: momentTZ.Moment) {
  let date: momentTZ.Moment
  if (currentTime) {
    date = currentTime
  } else {
    date = momentTZ().tz("UTC")
  }
  return (
    date.format("MM-DD-YYYY HH:mm:ss") +
    " GMT" +
    date.format("Z").replace(":00", "")
  )
}

export function getLastDateOfMonth(year, month) {
  const normalizedYear = year + Math.floor((month - 1) / 12)
  const normalizedMonth = ((((month - 1) % 12) + 12) % 12) + 1
  const lastDate = new Date(normalizedYear, normalizedMonth, 0)

  const yyyy = lastDate.getFullYear()
  const mm = String(lastDate.getMonth() + 1).padStart(2, "0")
  const dd = String(lastDate.getDate()).padStart(2, "0")

  return `${yyyy}-${mm}-${dd}`
}

export function getConfigProgram(program) {
  let configProgram: ConfigProgram

  if (typeof program.config === "string") {
    configProgram = JSON.parse(program.config)
  } else {
    configProgram = program.config ?? {}
  }
  return configProgram
}

export function getNextMonthAndYear(
  month: number,
  year: number
): { year: number; month: number } {
  const nextMonth = (month % 12) + 1
  const yearAdjustment = Math.floor(month / 12)
  const nextYear = month === 12 ? year + 1 : year + yearAdjustment
  return { year: nextYear, month: nextMonth }
}

// helper
export async function processAndUpload(
  c: Context<DB>,
  lang: string,
  programId: number,
  configProgram: ConfigProgram,
  categoryCode: string,
  category_id: number,
  generatorFn: (
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram
  ) => Promise<{ filePath: string }>,
  inputMonth?: number,
  inputYear?: number
) {
  let file: { filePath: string } | null = null
  try {
    file = await generatorFn(c, lang, programId, configProgram)

    await UploadExportToMinio(
      c,
      programId,
      file.filePath,
      lang,
      categoryCode,
      category_id,
      inputMonth,
      inputYear
    )
  } catch (err) {
    console.error(
      `Error processing report ${categoryCode} for program ${programId}:`,
      err
    )
  } finally {
    if (file?.filePath) {
      try {
        await fs.promises.unlink(file.filePath)
        console.log(`Deleted temp file: ${file.filePath}`)
      } catch (unlinkErr) {
        console.error(`Failed to delete file ${file.filePath}:`, unlinkErr)
      }
    }
  }
}
