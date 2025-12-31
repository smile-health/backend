import { USER_ROLE } from "@/common/constants/user.js"

type UserRoleKeys = keyof typeof USER_ROLE
type UserRoleValues = (typeof USER_ROLE)[UserRoleKeys]

export const DRAFT_STATUS_EVENT_REPORT = {
  SUBMITTED: 1,
  REVIEWED_BY_HELPDESK: 2,
  REPORT_TO_PROVINCE: 3,
  REPORT_TO_SUPPLIER: 4,
  MANUAL_INPUT: 5,
  IN_SUPPLIER_INSPECTION: 6,
  REVISED: 7,
  REVISION_CHECK: 8,
  REPORTED_COMPLETED: 9,
  REPORT_CANCELED: 10,
} as const

export const STATUS_LABEL_MAP: Record<string | number, string> = {
  null: "all",
  1: "submitted",
  2: "reviewed_by_helpdesk",
  3: "reported_to_province",
  4: "reported_to_supplier",
  5: "manual_input",
  6: "in_supplier_inspection",
  7: "revised",
  8: "revision_check",
  9: "report_completed",
  10: "report_canceled",
}

type DraftStatus = typeof DRAFT_STATUS_EVENT_REPORT
export type DraftStatusValues = DraftStatus[keyof DraftStatus]

type FlowOption = {
  nextStatus: DraftStatusValues[]
  addOrUpdatePackagingSlip?: boolean
}

type FlowMap = {
  [status in DraftStatusValues]?: {
    [roleId: number]: FlowOption
  }
}

export const FLOW_STATUS_UPDATE = [
  {
    status: DRAFT_STATUS_EVENT_REPORT.SUBMITTED,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN, USER_ROLE.MANAGER],
  },
  {
    status: DRAFT_STATUS_EVENT_REPORT.REVIEWED_BY_HELPDESK,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN],
  },
  {
    status: DRAFT_STATUS_EVENT_REPORT.REPORT_TO_PROVINCE,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN],
  },
  {
    status: DRAFT_STATUS_EVENT_REPORT.REPORT_TO_SUPPLIER,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN],
  },
  {
    status: DRAFT_STATUS_EVENT_REPORT.MANUAL_INPUT,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN, USER_ROLE.MANAGER],
  },
  {
    status: DRAFT_STATUS_EVENT_REPORT.IN_SUPPLIER_INSPECTION,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN],
  },
  {
    status: DRAFT_STATUS_EVENT_REPORT.REVISED,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN],
  },
  {
    status: DRAFT_STATUS_EVENT_REPORT.REVISION_CHECK,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN],
  },
  {
    status: DRAFT_STATUS_EVENT_REPORT.REPORTED_COMPLETED,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN, USER_ROLE.MANAGER],
  },
  {
    status: DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
    roles: [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN, USER_ROLE.MANAGER],
  },
]

export const FOLLOW_UP_STATUS: FlowMap = {
  [DRAFT_STATUS_EVENT_REPORT.SUBMITTED]: {
    [USER_ROLE.MANAGER]: {
      nextStatus: [DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED],
    },
    [USER_ROLE.ADMIN]: {
      nextStatus: [
        DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
        DRAFT_STATUS_EVENT_REPORT.REVIEWED_BY_HELPDESK,
      ],
    },
    [USER_ROLE.SUPERADMIN]: {
      nextStatus: [
        DRAFT_STATUS_EVENT_REPORT.REVIEWED_BY_HELPDESK,
        DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
      ],
    },
  },
  [DRAFT_STATUS_EVENT_REPORT.REVIEWED_BY_HELPDESK]: {
    [USER_ROLE.MANAGER]: {
      nextStatus: [DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED],
      addOrUpdatePackagingSlip: true,
    },
    [USER_ROLE.SUPERADMIN]: riviewedByHelpdeskAdminOptions(),
    [USER_ROLE.ADMIN]: riviewedByHelpdeskAdminOptions(),
  },
  [DRAFT_STATUS_EVENT_REPORT.REPORT_TO_PROVINCE]: {
    [USER_ROLE.MANAGER]: {
      nextStatus: [DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED],
    },
    [USER_ROLE.SUPERADMIN]: reportedToProvinceOrSupplierAdminOptions(),
    [USER_ROLE.ADMIN]: reportedToProvinceOrSupplierAdminOptions(),
  },
  [DRAFT_STATUS_EVENT_REPORT.REPORT_TO_SUPPLIER]: {
    [USER_ROLE.MANAGER]: {
      nextStatus: [DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED],
    },
    [USER_ROLE.SUPERADMIN]: reportedToProvinceOrSupplierAdminOptions(),
    [USER_ROLE.ADMIN]: reportedToProvinceOrSupplierAdminOptions(),
  },
  [DRAFT_STATUS_EVENT_REPORT.MANUAL_INPUT]: {
    [USER_ROLE.MANAGER]: {
      nextStatus: [
        DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
        DRAFT_STATUS_EVENT_REPORT.REPORTED_COMPLETED,
      ],
    },
    [USER_ROLE.SUPERADMIN]: manualInputAdminOptions(),
    [USER_ROLE.ADMIN]: manualInputAdminOptions(),
  },
  [DRAFT_STATUS_EVENT_REPORT.IN_SUPPLIER_INSPECTION]: {
    [USER_ROLE.MANAGER]: {
      nextStatus: [DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED],
    },
    [USER_ROLE.SUPERADMIN]: inSupplierInspectionAdminOptions(),
    [USER_ROLE.ADMIN]: inSupplierInspectionAdminOptions(),
  },
  [DRAFT_STATUS_EVENT_REPORT.REVISED]: {
    [USER_ROLE.MANAGER]: {
      nextStatus: [DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED],
    },
    [USER_ROLE.SUPERADMIN]: revisedAdminOptions(),
    [USER_ROLE.ADMIN]: revisedAdminOptions(),
  },
  [DRAFT_STATUS_EVENT_REPORT.REVISION_CHECK]: {
    [USER_ROLE.MANAGER]: {
      nextStatus: [DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED],
    },
    [USER_ROLE.SUPERADMIN]: revisionCheckAdminOptions(),
    [USER_ROLE.ADMIN]: revisionCheckAdminOptions(),
  },
  [DRAFT_STATUS_EVENT_REPORT.REPORTED_COMPLETED]: {
    [USER_ROLE.MANAGER]: reportedCompletedAndCanceledAdminOptions(),
    [USER_ROLE.SUPERADMIN]: reportedCompletedAndCanceledAdminOptions(),
    [USER_ROLE.ADMIN]: reportedCompletedAndCanceledAdminOptions(),
  },
  [DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED]: {
    [USER_ROLE.MANAGER]: reportedCompletedAndCanceledAdminOptions(),
    [USER_ROLE.SUPERADMIN]: reportedCompletedAndCanceledAdminOptions(),
    [USER_ROLE.ADMIN]: reportedCompletedAndCanceledAdminOptions(),
  },
}

export const getNextStatusOptions = (
  currentStatus: DraftStatusValues,
  role: UserRoleKeys | UserRoleValues
): FlowOption | undefined => {
  const roleId = typeof role === "number" ? role : USER_ROLE[role]
  return FOLLOW_UP_STATUS[currentStatus]?.[roleId]
}

function riviewedByHelpdeskAdminOptions(): FlowOption {
  return {
    nextStatus: [
      DRAFT_STATUS_EVENT_REPORT.REPORT_TO_PROVINCE,
      DRAFT_STATUS_EVENT_REPORT.REPORT_TO_SUPPLIER,
      DRAFT_STATUS_EVENT_REPORT.MANUAL_INPUT,
      DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
    ],
    addOrUpdatePackagingSlip: true,
  }
}
function reportedToProvinceOrSupplierAdminOptions(): FlowOption {
  return {
    nextStatus: [
      DRAFT_STATUS_EVENT_REPORT.IN_SUPPLIER_INSPECTION,
      DRAFT_STATUS_EVENT_REPORT.MANUAL_INPUT,
      DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
    ],
  }
}
function manualInputAdminOptions(): FlowOption {
  return {
    nextStatus: [
      DRAFT_STATUS_EVENT_REPORT.REPORTED_COMPLETED,
      DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
    ],
  }
}
function inSupplierInspectionAdminOptions(): FlowOption {
  return {
    nextStatus: [
      DRAFT_STATUS_EVENT_REPORT.REVISED,
      DRAFT_STATUS_EVENT_REPORT.MANUAL_INPUT,
      DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
    ],
  }
}
function revisedAdminOptions(): FlowOption {
  return {
    nextStatus: [
      DRAFT_STATUS_EVENT_REPORT.REVISION_CHECK,
      DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
    ],
  }
}
function revisionCheckAdminOptions(): FlowOption {
  return {
    nextStatus: [
      DRAFT_STATUS_EVENT_REPORT.REPORTED_COMPLETED,
      DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
    ],
  }
}
function reportedCompletedAndCanceledAdminOptions(): FlowOption {
  return {
    nextStatus: [],
  }
}
