export const status = {
  0: "Not Recorded",
  1: "Draft",
  2: "Saved",
  3: "Not Given",
}

export const statusTypes = {
  IDEAL_SCHEDULE: "ideal_schedule",
  CATCH_UP_SCHEDULE: "catch_up_schedule",
  NOT_RECORDED: "not_recorded",
  DRAFT: "draft",
  SAVED: "saved",
  NOT_GIVEN: "not_given",
} as const

export const statusLabels = {
  ideal_schedule: "Ideal schedule",
  catch_up_schedule: "Catch up schedule",
  not_recorded: "Not recorded",
  draft: "Draft",
  saved: "Saved",
  not_given: "Not given",
} as const

export const vaccineStatus = {
  note_only_date: "Note Only Date",
  note_with_batch: "Note With Batch",
  not_given: "Not Given",
}

export type ImmunizationStatusType =
  | "ideal_schedule"
  | "catch_up_schedule"
  | "not_recorded"
  | "draft"
  | "saved"
  | "not_given"
  | null

export const identityTypes = {
  NIK: 1,
  MOTHER_NIK: 2,
}

export const HEX_CODE_IMMUNIZATION = {
  ideal_schedule: {
    text: "#15803D",
    background: "#F0FDF4",
  },
  not_recorded1: {
    text: "#DC2626",
    background: "#FEF2F2",
  },
  not_recorded2: {
    text: "#CA8A04",
    background: "#FEFCE8",
  },
  catch_up_schedule: {
    text: "#F97316",
    background: "#FFF7ED",
  },
  not_given: {
    text: "#A3A3A3",
    background: "#F5F5F4",
  },
}

export const HEX_CODE_WEIGHING = {
  new_birth: {
    text: "#CA8A04",
    background: "#FEFCE8",
  },
  new_weight: {
    text: "#4F46E5",
    background: "#EEF2FF",
  },
}
