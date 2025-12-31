export const NOTIFICATION_TYPE = {
  EXPORT_LARGE_FILE: "export-large-file",
  EXPIRED_30: "ed-30", // Exists
  EXPIRED_60: "ed-60", // New 09 Oct 2025
  EXPIRED_90: "ed-90", // New 09 Oct 2025
  EXPIRED_14: "ed-14", // Exists
  EXPIRED_10: "ed-10", // Exists
  EXPIRED_3: "ed-3", // Exists
  EXPIRED_1: "ed-1", // Exists
  ORDER_CREATE: "order-create",
  ORDER_CONFIRM: "order-confirm",
  ORDER_SHIP: "order-ship", // Exists
  ORDER_FULFILL: "order-fulfill",
  ORDER_RELOCATION: "order-relocation", // New 09 Oct 2025
  CAPACITY_80: "cap-80",
  OVER_STOCK: "over-stock",
  LESS_STOCK: "less-stock", // Exists
  ZERO_STOCK: "zero-stock", // Exists
  VACCINE_3: "vaccine-3",
  VACCINE_4: "vaccine-4",
  BELOW_EXCURSION: "below-excursion",
  ABOVE_EXCURSION: "above-excursion",
  YEARLY_REPORT: "yearly-report",
  MONTHLY_REPORT: "monthly-report",
  REMINDER_VAR2: "vaccine-2",
  REMINDER_VAR3: "vaccine-3",
  REMINDER_PREP2: "vaccine-7",
  BOOK_ALL: "book-all-entity",
  REMINDER_VAR8: "vaccine-8",
  REMINDER_VAR2_ID: "vaccine-2-2",
  ASSET_MAINTENANCE: "asset-maintenance", // Exists
  ASSET_CALIBRATION: "asset-calibration", // Exists
  ASSET_WARRANTY: "asset-warranty", // Exists
  STOCK_BACK_TO_NORMAL: "stock-back-to-normal", // Exists
  ASSET_STATUS_CHANGED: "asset-status-changed", // New 09 Oct 2025
  INACTIVE_ENTITY: "inactive-entity", // Exists
  PENDING_ENTITY: "pending-entity", // New 09 Oct 2025
  PATIENT_REMINDER: "patient-reminder", // New 21 Oct 2025
};

export const NOTIFICATION_MEDIA = {
  FIREBASE: "fcm",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
  SMS: "sms",
};

export const NOTIFICATION_WORKER = {
  FIREBASE: "firebase_notifications",
  WHATSAPP: "whatsapp-notifications",
  EMAIL: "email-notification",
  SMS: "sms-notifications",
  STOP_NOTIFICATION: "stop-notifications",
};
