import { Context } from "hono"
import { group } from "@smile-health/lib/utils.js"
import { DownloadReportQuery } from "./download-report.query.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { ExportLogs } from "./download-report.schema.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { DB } from "@/common/infrastructure/database/types/db.js"

export class DownloadReportRepository {
  constructor(private readonly downloadReportQuery: DownloadReportQuery) {}

  async getAllProgram(c: CustomContext<DB>, id?: number) {
    return c.var.trx
      .selectFrom("workspaces")
      .select(["id", "config"])
      .where("deleted_at", "is", null)
      .$if(!!id, (qb) => qb.where("id", "=", id!))
      .execute()
  }

  async saveExportLog(c: CustomContext<DB>, data: ExportLogs) {
    const result = await c.var.trx
      .insertInto("export_logs")
      .values(data)
      .executeTakeFirst()
    return Number(result.insertId)
  }

  async softDeleteExportLog(c: CustomContext<DB>, id: number) {
    return c.var.trx
      .updateTable("export_logs")
      .set({ deleted_at: new Date() })
      .where("id", "=", id)
      .execute()
  }

  async getCategories(c: Context) {
    const programId = c.var.programId
    return await c.var.trx
      .selectFrom("export_categories as ec")
      .innerJoin(
        "ws_export_categories as wsec",
        "wsec.export_category_id",
        "ec.id"
      )
      .select(["ec.id as id", "ec.title as title"])
      .where("wsec.program_id", "=", programId)
      .where("ec.deleted_at", "is", null)
      .where("wsec.deleted_at", "is", null)
      .execute()
  }

  async getExportLogs(c: Context) {
    const programId = c.var.programId
    const language = c.var.language

    const db = c.var.trx

    // For export_category_id 6 and 7, return all code, month, and year combinations
    const specialCategoryLogs = await db
      .selectFrom("export_logs")
      .selectAll()
      .where("program_id", "=", programId)
      .where("lang", "=", language)
      .where("deleted_at", "is", null)
      .where("export_category_id", "in", [6, 7])
      .groupBy("code")
      .groupBy("month")
      .groupBy("year")
      .execute()

    // For other categories, get only the latest per code
    const latestPerCode = db
      .selectFrom("export_logs")
      .select(["code", db.fn.max("created_at").as("latest_created_at")])
      .where("program_id", "=", programId)
      .where("lang", "=", language)
      .where("deleted_at", "is", null)
      .where("export_category_id", "not in", [6, 7])
      .groupBy("code")
      .as("latest")

    const otherCategoryLogs = await db
      .selectFrom("export_logs as el")
      .innerJoin(latestPerCode, (join) =>
        join
          .onRef("el.code", "=", "latest.code")
          .onRef("el.created_at", "=", "latest.latest_created_at")
      )
      .selectAll("el")
      .where("el.deleted_at", "is", null)
      .where("el.program_id", "=", programId)
      .where("el.lang", "=", language)
      .where("el.export_category_id", "not in", [6, 7])
      .execute()

    // Combine both results
    const allLogs = [...specialCategoryLogs, ...otherCategoryLogs]

    return group(allLogs, "export_category_id")
  }

  async getReception(
    sheet: string,
    programId: number,
    state: string,
    provinceId?: number,
    regencyId?: number
  ) {
    const receptionQuery = this.downloadReportQuery.buildReceptionQuery(
      sheet,
      programId,
      state,
      provinceId,
      regencyId
    )

    return await execQuery(receptionQuery)
  }

  async getStockMaterialProvinceOrRegency(
    programId: number,
    state: string,
    isHierarchyEnabled: boolean,
    provinceId?: number,
    regencyId?: number
  ) {
    const stockMaterialQuery =
      this.downloadReportQuery.buildStockMaterialByProvince(
        state,
        isHierarchyEnabled,
        provinceId,
        regencyId
      )

    const stockMaterials = await execQuery(stockMaterialQuery, {
      programId,
    })
    return group(
      Array.isArray(stockMaterials) ? stockMaterials : [],
      state === "province" ? "provinceId" : "regencyId"
    )
  }

  async getStockMaterialBatch(
    programId: number,
    state: string,
    provinceId?: number,
    regencyId?: number,
    offset?: number,
    limit?: number
  ) {
    const stockMaterialQuery =
      this.downloadReportQuery.buildStockMaterialByBatch(
        state,
        provinceId,
        regencyId,
        offset,
        limit
      )

    return await execQuery(stockMaterialQuery, {
      programId,
    })
  }

  async getLastIdReportLogs(
    c: Context,
    code: number,
    programID?: number,
    lang?: string,
    month?: number,
    year?: number
  ) {
    const programId = programID ?? c.var.programId
    const language = lang ?? c.var.language

    let query = c.var.trx
      .selectFrom("export_logs")
      .selectAll()
      .where("deleted_at", "is", null)
      .where("code", "=", String(code))
      .where("program_id", "=", programId)
      .where("lang", "=", language)

    // Filter by month and year if provided (for code 41 historical reports)
    if (month !== undefined) {
      query = query.where("month", "=", month)
    }
    if (year !== undefined) {
      query = query.where("year", "=", year)
    }

    return query.orderBy("created_at", "desc").limit(1).executeTakeFirst()
  }

  async getMaterial(
    c: CustomContext<DB>,
    programId: number,
    isHierarchyEnabled?: boolean
  ) {
    const materialLevelId = isHierarchyEnabled ? 2 : 3
    const result = await c.var.trx
      .selectFrom("ws_materials")
      .select(["id", "name"])
      .where("material_level_id", "=", materialLevelId)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
    return result.map((item) => ({
      key: item.id,
      header: item.name,
      width: 30,
    }))
  }

  async getConsumptionByProvinceOrRegency(
    programId: number,
    state: string,
    isHierarchyEnabled: boolean,
    provinceId?: number,
    regencyId?: number
  ) {
    const consumptionQuery =
      this.downloadReportQuery.buildConsumptionByProvinceOrRegency(
        state,
        isHierarchyEnabled,
        provinceId,
        regencyId
      )

    const consumptions = await execQuery(consumptionQuery, {
      programId,
    })
    return group(
      Array.isArray(consumptions) ? consumptions : [],
      state === "province" ? "provinceId" : "regencyId"
    )
  }

  async getConsumptionByEntity(
    programId: number,
    provinceId?: number,
    regencyId?: number
  ) {
    const consumptionQuery = this.downloadReportQuery.buildConsumptionByEntity(
      provinceId,
      regencyId
    )

    return await execQuery(consumptionQuery, {
      programId,
    })
  }

  async getPermissionExportRole(c: Context, code: number, roleId: number) {
    return c.var.trx
      .selectFrom("export_roles")
      .selectAll()
      .where("export_code", "=", code)
      .where("role_id", "=", roleId)
      .where("deleted_at", "is", null)
      .limit(1)
      .executeTakeFirst()
  }

  async getDiscard(programId: number, provinceId?: number, regencyId?: number) {
    const discardQuery = this.downloadReportQuery.buildDiscardQuery(
      provinceId,
      regencyId
    )

    return await execQuery(discardQuery, { programId })
  }

  async getExpiredMaterial(
    programId: number,
    state: string,
    isHierarchyEnabled: boolean,
    provinceId?: number,
    regencyId?: number
  ) {
    const expiredMaterialQuery = this.downloadReportQuery.buildExpiredMaterial(
      state,
      isHierarchyEnabled,
      provinceId,
      regencyId
    )

    const expiredMaterials = await execQuery(expiredMaterialQuery, {
      programId,
    })
    if (state.includes("entity")) {
      return expiredMaterials
    }
    return group(
      Array.isArray(expiredMaterials) ? expiredMaterials : [],
      state.includes("province") ? "provinceId" : "regencyId"
    )
  }
}
