import { BaseRepository } from "../base.repository.js"

export class OrderOtherReasonRepository extends BaseRepository<"ws_order_other_reasons"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_order_other_reasons", filterProgram, filterActivity)
  }
}
