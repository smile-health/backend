import { BaseRepository } from "../base.repository.js"

export class OrderHistoryRepository extends BaseRepository<"ws_order_histories"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_order_histories", filterProgram, filterActivity)
  }
}
