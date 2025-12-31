export enum AnnualPlanningProcessStatus {
  NEW = 0,
  APPROVED = 1,
  DESK = 2,
  DRAFT = 3,
  REVISION = 4,
}

export const AnnualPlanningProcessStatusAttribute = {
  "new": AnnualPlanningProcessStatus.NEW,
  "approved": AnnualPlanningProcessStatus.APPROVED,
  "desk": AnnualPlanningProcessStatus.DESK,
  "draft": AnnualPlanningProcessStatus.DRAFT,
  "revision": AnnualPlanningProcessStatus.REVISION,
}

export enum AnnualNeedApprovalStatus {
  REJECTED = 0,
  APPROVED = 1,
}

export const AnnualNeedApprovalStatusAttribute = {
  "rejected": AnnualNeedApprovalStatus.REJECTED,
  "approved": AnnualNeedApprovalStatus.APPROVED,
}

