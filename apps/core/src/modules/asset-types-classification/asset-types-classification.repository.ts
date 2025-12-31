import { BaseRepository } from "../base.repository"

export class AssetTypesClassificationRepository extends BaseRepository<"asset_types_classifications"> {
  constructor() {
    super("asset_types_classifications")
  }
}
