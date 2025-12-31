import { BaseRepository } from "../base.repository.js"

export class MaterialLevelRepository extends BaseRepository<"material_levels"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("material_levels", filterProgram, filterActivity)
  }
}
