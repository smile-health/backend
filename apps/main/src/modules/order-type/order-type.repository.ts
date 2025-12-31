import { BaseRepository } from "../base.repository.js"

export class OrderTypeRepository extends BaseRepository<"ws_order_types"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_order_types", filterProgram, filterActivity)
  }
}
