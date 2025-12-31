import { BaseRepository } from "../base.repository"

export class AssetTypesTemperatureRepository extends BaseRepository<"asset_types_temperatures"> {
  constructor() {
    super("asset_types_temperatures")
  }
}
