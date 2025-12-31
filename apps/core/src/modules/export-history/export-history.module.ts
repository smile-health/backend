import minioClient from "@/common/infrastructure/minio.js"
import { NotFoundError } from "@smile/lib/error.js"
import { logger } from "@smile/lib/logger.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { getUniqueIdsFromFields } from "@smile/lib/utils.js"
import { Context } from "hono"
import { z } from "zod"
import { UserRepository } from "../user/user.repository.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { ExportHistoryRepository } from "./export-history.repository.js"
import { GetExportHistoriesQueries } from "./export-history.schema.js"

export class ExportHistoryModule {
  constructor(
    private readonly repository: ExportHistoryRepository,
    private readonly userRepo: UserRepository,
    private readonly workspaceRepo: WorkspaceRepository
  ) {}

  async getAll(c: Context, params: z.infer<typeof GetExportHistoriesQueries>) {
    const { data, total } = await this.repository.findAll(c, params)

    const userIds = getUniqueIdsFromFields(data, "created_by")
    const usersMap = await this.userRepo.getBasicDetailMapped(c, userIds)

    const programIds = getUniqueIdsFromFields(data, "program_id").filter(
      Boolean
    )
    const programsMap = {}

    if (programIds.length > 0) {
      const programs = await this.workspaceRepo.findAllByIds(c, programIds)
      programs.forEach((program) => {
        programsMap[program.id] = {
          id: program.id,
          name: program.name,
          key: program.key,
        }
      })
    }

    const mappedData = data.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { created_by, ...res } = item
      return {
        ...res,
        status_label: c.var.t(`export_history.status.${item.status}`),
        program: item.program_id
          ? (programsMap[item.program_id] ?? null)
          : null,
        user_created_by: usersMap[item.created_by ?? 0] ?? null,
      }
    })

    return new PaginatedResponse(
      { ...params, paginate: params.paginate ?? 10 },
      mappedData,
      total
    )
  }

  async downloadFile(c: Context, file: string) {
    const exportHistory = await this.repository.findByFilename(c, file)

    if (!exportHistory) {
      throw new NotFoundError("File not found")
    }

    if (!minioClient) {
      throw new Error("MinIO client not available")
    }

    if (!exportHistory.download_url) {
      throw new NotFoundError("Download URL not found")
    }

    const urlString = exportHistory.download_url.startsWith("http")
      ? exportHistory.download_url
      : `http://${exportHistory.download_url}`

    const url = new URL(urlString)
    const pathParts = url.pathname.split("/").filter((part) => part.length > 0)
    const bucketName = pathParts[0]
    const objectName = pathParts.slice(1).join("/")

    try {
      const stream = await minioClient.getObject(
        bucketName || "",
        objectName || ""
      )

      return {
        stream,
        filename: exportHistory.filename,
      }
    } catch (err) {
      logger.error(err)
      throw new NotFoundError("File not found in storage")
    }
  }
}
