export const MATERIAL_CONDITION_TYPE = {
  ENTITY_TYPES: "entity_types",
  ROLES: "roles",
}

export const KFA_LEVEL_CODE_LIST = [92, 93]
export const KFA_LEVEL_CODE_TO_ID = {
  92: 2,
  93: 3,
}
export const KFA_LEVEL_ID = {
  TEMPLATE: 2,
  VARIANT: 3,
}
export const KFA_LEVEL_LABEL = {
  2: "Template",
  3: "Variant",
}

export const KFA_LEVEL_FILENAME = {
  2: "material_level.label.template",
  3: "material_level.label.variant",
}

export const IMMUN_FILENAME = "material_level.label.immunization"

export const GLOBAL_MATERIAL_TYPES = {
  1: "medicine",
  2: "vaccine",
  3: "bhp",
  4: "bmhp",
  5: "asset",
}

export const MAP_NEW_TO_OLD_MATERIAL_TYPES = {
  1: {
    2: [1],
  },
  2: {
    1: [1, 4, 6, 8, 10, 11, 12],
    3: [3],
    4: [2, 5, 7],
    5: [9],
  },
}

export const MAP_OLD_TO_NEW_MATERIAL_TYPES = {
  1: {
    1: 2,
  },
  2: {
    1: 1,
    2: 4,
    3: 3,
    4: 1,
    5: 4,
    6: 1,
    7: 4,
    8: 1,
    9: 5,
    10: 1,
    11: 1,
    12: 1,
  },
}

export const STATUS = {
  ACTIVE: 1,
  INACTIVE: 0,
}
