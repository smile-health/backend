import moment from "moment-timezone"
import ExportHistoryRepository from "./export-history.repository.js"

export class ExportHistoryCron {
  constructor(private readonly repo: ExportHistoryRepository) {}

  public readonly checkProgress = async () => {
    console.log("=== Start Process Check Status Progress Export History ===")
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    await this.repo.updateStatusFailed()

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Check Status Progress Export History ===")
  }
}
