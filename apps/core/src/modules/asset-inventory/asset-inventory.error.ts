import { ValidationError } from "@smile-health/lib/error"

export class InvalidAsset extends ValidationError {
  constructor() {
    super("validator.asset_inventory.invalid_asset")
  }
}

export class InvalidRTMD extends ValidationError {
  constructor() {
    super("validator.asset_inventory.invalid_rtmd")
  }
}

export class InvalidSensor extends ValidationError {
  constructor() {
    super("validator.asset_inventory.invalid_sensor")
  }
}

export class RTMDEntityMismatch extends ValidationError {
  constructor() {
    super("validator.asset_inventory.rtmd_entity_mismatch")
  }
}
