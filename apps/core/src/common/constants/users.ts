import { Context } from "hono"

export const REGEX_PASS =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/

export const DEFAULT_PASS = "Smile12*"

export const DEVICE_TYPE = {
  web: 1,
  mobile: 2,
  elearning: 3,
  monitor: 4,
}

export const USER_ROLE = {
  SUPERADMIN: 1,
  ADMIN: 2,
  MANAGER: 3,
  OPERATOR: 4,
  OPERATOR_COVID: 5,
  DISTRIBUTOR_COVID: 6,
  MANAGER_COVID: 7,
  CUSTOMER_CENTER: 8,
  THIRD_PARTY: 9,
  PKC: 10,
  MANUFACTURE: 11,
  ASIK: 12,
  SATUSEHAT: 13,
  WMS: 16
}

export const USER_GENDER = {
  MALE: 1,
  FEMALE: 2,
}

export const USER_CHANGELOGS_FIELD = [
  "firstname",
  "lastname",
  "gender",
  "email",
  "mobile_phone",
  "password",
]

export const USER_STATUS = {
  INACTIVE: 0,
  ACTIVE: 1,
}

export const DAILY_RECAP_EMAIL = {
  NO: 0,
  YES: 1,
}

export const USER_VIEW_ONLY = ["yes", "no"]

export const getTranslateUserColumnExcel = (c: Context) => {
  return {
    Username: c.var.t("user.label.Username"),
    IDRole: c.var.t("user.label.ID Role"),
    ViewOnly: c.var.t("user.label.View Only"),
    Firstname: c.var.t("user.label.Firstname"),
    Lastname: c.var.t("user.label.Lastname"),
    Email: c.var.t("user.label.Email"),
    DailyRecapEmail: c.var.t("user.label.receive_daily_recap_email"),
    IDGender: c.var.t("user.label.ID Gender"),
    Password: c.var.t("user.label.Password"),
    Address: c.var.t("user.label.Address"),
    IDVillage: c.var.t("user.label.ID Village"),
    BirthDate: c.var.t("user.label.Birth Date"),
    MobilePhone: c.var.t("user.label.Mobile Phone"),
    IDEntity: c.var.t("user.label.ID Entity"),
    IDProgram: c.var.t("user.label.ID Program"),
    IDManufacture: c.var.t("user.label.ID Manufacture"),
  }
}

export const ROW_SHEET_USER = 10
