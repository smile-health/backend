import {
  getMapExistingActivityIdsByProgramId,
  getMapExistingToPlatformProgramId,
} from "../helper.js"

export const MAP_EXISTING_TO_PLATFORM =
  await getMapExistingToPlatformProgramId()

export const MAP_EXISTING_ACTIVITY_IDS =
  await getMapExistingActivityIdsByProgramId()

export const MAP_USER_EMAIL = {
  1: {
    _rab: 6,
  },
  2: {
    _mal: 3,
    _tb: 4,
    _hiv: 5,
  },
}

export const MAP_LOGISTICS_PROGRAM_ACTIVITIES = {
  2: {
    2: [3, 7, 8, 9], // Logistics
    3: [1], // Malaria
    4: [4], // TB
    5: [5], // HIV
  },
}
