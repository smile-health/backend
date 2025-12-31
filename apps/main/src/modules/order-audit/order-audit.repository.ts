import { BaseRepository } from "../base.repository.js"

export class OrderAuditRepository extends BaseRepository<"ws_order_audits"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_order_audits", filterProgram, filterActivity)
  }
}
