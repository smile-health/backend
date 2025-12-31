import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import { insertMapping } from "@/common/mapping.repository.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { AxiosError } from "axios"
import type { CreateProgramIncomingMessage } from "./program.schema.js"

export class ProgramGateway {
  public async create(
    c: CustomContext<DB>,
    message: CreateProgramIncomingMessage
  ) {
    try {
      await this.mapProgram(c, message.payload)
      console.log("Successfully mapped program")
    } catch (error) {
      await logError(c, error)
      if (error instanceof AxiosError) {
        console.log(error.response?.data)
      } else {
        console.log(error)
        throw new Error("An unknown error occurred")
      }
    }
  }

  private async mapProgram(
    c: CustomContext<DB>,
    program: CreateProgramIncomingMessage["payload"]
  ) {
    const config =
      typeof program.config === "string"
        ? JSON.parse(program.config)
        : program.config || {}
    const isHierarchy = config?.material?.is_hierarchy_enabled || false
    const existingProgramId = isHierarchy ? 2 : 1

    const mappingData = {
      platform_program_id: program.id,
      existing_program_id: existingProgramId,
    }

    await insertMapping(c, "mapping_programs", mappingData)
  }
}
