import { USER_GENDER } from "@/common/constants/users"
import { EntityRepository } from "@/modules/entity/entity.repository"
import { RoleRepository } from "@/modules/role/role.repository"
import { NotFoundError } from "@smile/lib/error"
import { PaginatedResponse } from "@smile/lib/types/paginate"
import { collect, getLabelByKey, merge } from "@smile/lib/utils"
import { omit } from "es-toolkit"
import { Context } from "hono"
import { UserRepository } from "../user.repository"
import { GetUserQueries, TIdUserReq, UserResponse } from "../user.schema"

export class UserExternalModule {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly entityRepo: EntityRepository,
    private readonly roleRepo: RoleRepository
  ) {}

  async list(c: Context, queries: GetUserQueries) {
    queries.isPaginate = true
    queries.offset = (queries.page - 1) * queries.paginate
    queries.external_properties = true

    const { users, total } = await this.userRepo.findAll(c, queries)

    if (users.length === 0) {
      return new PaginatedResponse<UserResponse>(queries)
    }

    const data = await this.#mapList(c, users)

    return new PaginatedResponse<UserResponse>(queries, data, total)
  }

  async detail(c: Context, params: TIdUserReq) {
    const user = await this.userRepo.findById(c, Number(params.id))
    if (!user.id) {
      throw new NotFoundError(
        `${c.var.t("validator.not_exist", { field: "user" })}`
      )
    }

    const [entity, role] = await Promise.all([
      this.entityRepo.findBasicById(c, user.entity_id ?? 0),
      this.roleRepo.findByID(c, user.role ?? 0),
    ])

    return {
      ...omit(user, [
        "password",
        "token_login",
        "sim_id",
        "sim_provider",
        "imei_number",
        "change_password",
        "fcm_token",
        "application_version",
        "iota_app_gui_theme",
        "mobile_phone_2",
        "mobile_phone_brand",
        "mobile_phone_model",
        "permission",
        "last_mobile_access",
        "timezone_id",
      ]),
      entity,
      role_label: role?.name ?? "-",
      gender_label: getLabelByKey(USER_GENDER, user?.gender),
    }
  }

  async #mapList(c: Context, data: UserResponse[]) {
    const entityIDs = collect(data, "entity_id")
    const roleIDs = collect(data, "role")
    const createdByIds = collect(data, "created_by")
    const updatedByIds = collect(data, "updated_by")
    const mergeByIds = merge(createdByIds, updatedByIds)

    const [entity, role, userBy] = await Promise.all([
      entityIDs.length > 0
        ? this.entityRepo.findBasicAllByIds(c, entityIDs)
        : {},
      roleIDs.length > 0 ? this.roleRepo.findByIDMapped(c, roleIDs) : {},
      mergeByIds.length > 0 ? this.userRepo.getByIDsMapped(c, mergeByIds) : {},
    ])

    return data.map(
      (el) =>
        ({
          ...omit(el, [
            "password",
            "token_login",
            "sim_id",
            "sim_provider",
            "imei_number",
            "change_password",
            "fcm_token",
            "application_version",
            "iota_app_gui_theme",
            "mobile_phone_2",
            "mobile_phone_brand",
            "mobile_phone_model",
            "permission",
            "last_mobile_access",
            "timezone_id",
          ]),
          entity: entity[Number(el.entity_id ?? 0)],
          role_label: role[Number(el?.role ?? 0)]?.name,
          user_created_by: userBy[el.created_by ?? 0]?.[0] ?? {},
          user_updated_by: userBy[el.updated_by ?? 0]?.[0] ?? {},
        }) as UserResponse
    )
  }
}
