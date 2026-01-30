import {
  DAILY_RECAP_EMAIL,
  USER_CHANGELOGS_FIELD,
  USER_GENDER,
  USER_ROLE,
  USER_STATUS,
} from "@/common/constants/users.js"
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "@smile-health/lib/error.js"
import { logger } from "@smile-health/lib/logger.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import {
  collect,
  formatDateWithTimezone,
  getLabelByKey,
} from "@smile-health/lib/utils.js"
import bcrypt from "bcrypt"
import { merge } from "es-toolkit"
import { Context } from "hono"
import { StatusCodes } from "http-status-codes"
import moment from "moment"
import path from "path"
import { AuthKeycloakService } from "../auth/auth.keycloak.service.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { IntegrationRepository } from "../integration/integration.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { RoleRepository } from "../role/role.repository.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { UserTemplateXlsx } from "./user.excel.js"
import { UserPublisher } from "./user.publisher.js"
import { UserRepository } from "./user.repository.js"
import {
  extractJSONFromString,
  GetUserQueries,
  TCreateUserReq,
  TExportUser,
  TIdUserReq,
  TImportUser,
  TUpdateUserReq,
  TWorkspaces,
  UpdateLastLoginRequest,
  UpdateStatusRequest,
  UserChangeLogsRequest,
  UserResponse,
} from "./user.schema.js"

export class UserModule {
  constructor(
    private readonly repository: UserRepository,
    private readonly entityRepo: EntityRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly locationRepo: LocationRepository,
    private readonly roleRepo: RoleRepository,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly integrationRepo: IntegrationRepository,
    private readonly authKeycloakService: AuthKeycloakService,
    private readonly userPublisher: UserPublisher
  ) {}

  async getList(c: Context, queries: GetUserQueries) {
    queries.isPaginate = true
    queries.offset = (queries.page - 1) * queries.paginate

    const { users, total } = await this.repository.findAll(c, queries)

    if (users.length === 0) {
      return new PaginatedResponse<UserResponse>(queries)
    }

    const data = await this.#mapList(c, users)

    return new PaginatedResponse<UserResponse>(queries, data, total)
  }

  async validateUserExists(c: Context, username: string) {
    const user = await this.repository.dataExists(c, {
      column: "username",
      value: username,
    })

    if (!user) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("common.user"),
        })
      )
    }

    // Return only safe user data (no sensitive information)
    return {
      id: user.id,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role_label: user.role_label,
    }
  }

  async createUser(c: Context, data: TCreateUserReq, returnDetail = true) {
    const { program_ids: workspace_ids, external_roles, ...crte } = data
    const { client } = c.var

    // add prosess check if keycloak doesnt exists
    const userExist = await this.repository.checkUsernameEmail(
      c,
      crte.username,
      crte.email
    )

    const roleMapping = await this.roleRepo.getClientRoleMapping(
      c,
      client?.getId()
    )
    if (userExist) {
      try {
        const checkUserKC = await this.authKeycloakService.getUser(
          userExist?.keycloak_uuid ?? ""
          // Later try to get the User details from KC based upon the USER ID and match email and username.
        )
        if (checkUserKC?.data) {
          return {
            code: StatusCodes.CONFLICT,
            success: false,
            message: c.var.t("validator.exist", {
              field: c.var.t("common.user"),
            }),
          }
        }
      } catch (error: any) {
        if (error?.message?.includes("Failed get user")) {
          const authKeycloak = await this.authKeycloakService.createUser({
            username: userExist.username,
            firstname: userExist.firstname,
            lastname: userExist.lastname,
            email: userExist.email,
            role_label: userExist.role_label!,
            program_ids: workspace_ids!.map((val) => String(val)),
            password: data.password ?? "Smile12*",
            clients: client
              ? [
                  {
                    id: client.getUUID(),
                    roles: external_roles ?? [userExist.role_label!],
                  },
                ]
              : [],
          })

          await Promise.all([
            this.repository.update(
              c,
              {
                keycloak_uuid: authKeycloak.keycloak_uuid,
                user_uuid: authKeycloak.user_uuid,
                role: roleMapping[data.role]?.internal_id ?? data.role,
              },
              { id: userExist?.id }
            ),
            this.integrationRepo.upsertAssociation(c, userExist?.id, "user"),
          ])

          logger.warn(`User already created in keycloak`)
          return {
            code: StatusCodes.CONFLICT,
            success: false,
            message: c.var.t("validator.exist", {
              field: c.var.t("common.user"),
            }),
            data: await this.detail(c, { id: userExist.id }),
          }
        }
        return {
          code: StatusCodes.INTERNAL_SERVER_ERROR,
          success: false,
          message: "Internal server error",
        }
      }
    }

    const bcryptPassword = await bcrypt.hash(crte.password, 10)
    const { external_properties, integration_client_id, ...restCrte } = crte
    const result = await this.repository.create(c, {
      ...restCrte,
      password: bcryptPassword, // after integration with auth keycloak done, it will be removed
    })
    const userId = Number(result.insertId)

    const role = await this.roleRepo.findByID(c, data.role)
    const roleLabel = role?.type ?? role?.name ?? "Super Admin"
    const authKeycloak = await this.authKeycloakService.createUser({
      ...data,
      clients: client
        ? [
            {
              id: client.getUUID(),
              roles: external_roles ?? [roleLabel],
            },
          ]
        : [],
      role_label: roleMapping[data.role ?? 0]?.role_label ?? roleLabel,
      program_ids: (workspace_ids ?? [])!.map((val) => String(val)),
    })

    await Promise.all([
      this.repository.update(
        c,
        {
          keycloak_uuid: authKeycloak.keycloak_uuid,
          user_uuid: authKeycloak.user_uuid,
          role: roleMapping[data.role]?.internal_id ?? data.role,
        },
        { id: userId }
      ),
      this.#manageWorkspaces(c, userId, workspace_ids ?? []),
      this.userPublisher.processCreate(c, userId, data),
      this.integrationRepo.upsertAssociation(
        c,
        userId,
        "user",
        JSON.stringify({ role, ...external_properties }),
        integration_client_id
      ),
    ])

    return {
      code: StatusCodes.CREATED,
      success: true,
      data: returnDetail ? await this.detail(c, { id: userId }) : null,
    }
  }

  async detail(c: Context, data: TIdUserReq) {
    const {
      password,
      token_login,
      sim_id,
      sim_provider,
      imei_number,
      change_password,
      fcm_token,
      application_version,
      iota_app_gui_theme,
      mobile_phone_2,
      mobile_phone_brand,
      mobile_phone_model,
      permission,
      last_mobile_access,
      timezone_id,
      ...user
    } = await this.#existUser(c, data.id)
    
    const [entity, workspaces, location, role, manufacture, kcUser] =
      await Promise.all([
        this.entityRepo
          .findBasicById(c, user.entity_id ?? 0)
          .then(async (entity) => {
            const allWorkspaces =
              await this.workspaceRepo.getByFromMappedWorkspace(
                c,
                "entity",
                entity?.id ?? 0
              )
            const entityWorkspaces = allWorkspaces[user.entity_id ?? 0] ?? []

              return {
                ...entity,
                programs: entityWorkspaces.filter((w: any) => w.is_beneficiaries === 0),
                beneficiaries: entityWorkspaces.filter((w: any) => w.is_beneficiaries === 1),
              }
          }),
        this.workspaceRepo.getByFromMappedWorkspace(c, "user", user.id),
        this.locationRepo.getDetails(c, Number(user.village_id)),
        this.roleRepo.findByID(c, user.role ?? 0),
        this.manufactureRepo.findOne(c, { id: user.manufacture_id }),
        this.authKeycloakService.getUser(user.keycloak_uuid ?? ""),
      ])
    const { client } = c.var

    const userWorkspaces = workspaces[user.id] ?? []

    const baseResponse = {
      ...user,
      entity,
      manufacture,
      location,
      role_label: user.external_properties?.role?.name ?? user.role_label,
      external_roles: client
        ? kcUser?.data?.roleMappings?.clientMappings[
            client.getKey()
          ]?.mappings?.map((r) => r.name)
        : [],
      gender_label: getLabelByKey(USER_GENDER, user?.gender),
    }

    return {
      ...baseResponse,
      program_ids: userWorkspaces.filter((ws) => ws.is_beneficiaries === 0).map((ws) => ws.id),
      beneficiaries_ids: userWorkspaces.filter((ws) => ws.is_beneficiaries === 1).map((ws) => ws.id),
    } as UserResponse
  }


  async update(c: Context, data: TUpdateUserReq, id: number) {
    let isChangeProgramIds: boolean = true
    const {
      program_ids: workspace_ids,
      external_roles,
      integration_client_id,
      external_properties,
      ...user
    } = data
    const dataPrevious = await this.#existUser(c, id)
    let hashPassword: string | undefined

    const { client } = c.var

    if (c.var.role != USER_ROLE.SUPERADMIN) {
      isChangeProgramIds = false
    }

    const isEntityChanged = user.entity_id
      ? dataPrevious.entity_id !== user.entity_id
      : false

    if (user.password) {
      hashPassword = await bcrypt.hash(user.password, 10)
    }

    const role = await this.roleRepo.findByID(c, user.role)
    const roleLabel = role?.type ?? role?.name ?? "Super Admin"
    const roleMapping = await this.roleRepo.getClientRoleMapping(
      c,
      client?.getId()
    )

    const updateUserAuthKeycloak = {
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email!,
      password: user.password,
      user_uuid: dataPrevious.user_uuid,
      program_ids: isChangeProgramIds
        ? (workspace_ids ?? []).map((val) => String(val))
        : undefined,
      role_label: roleMapping[user.role ?? 0]?.role_label ?? roleLabel,
      clients: client
        ? [
            {
              id: client.getUUID(),
              roles: external_roles ?? [roleLabel],
            },
          ]
        : [],
    }

    let userNotFound = false

    try {
      await this.authKeycloakService.updateUser(
        dataPrevious.keycloak_uuid ?? "",
        updateUserAuthKeycloak
      )
    } catch (error: any) {
      logger.error(
        error,
        `error failed update user auth service by keycloak ${error} - ${JSON.stringify(updateUserAuthKeycloak)}`
      )
      const errorMessage = extractJSONFromString(error?.message)

      if (errorMessage) {
        c.set("errors", errorMessage)
        throw new ValidationError()
      } else {
        // bypass update error on user not found on keycloak
        if (
          String(error).includes("User not found") ||
          !dataPrevious.keycloak_uuid
        ) {
          userNotFound = true
        } else {
          throw new BadRequestError(c.var.t("auth.failed_verif"))
        }
      }
    }

    await Promise.all([
      this.repository.update(
        c,
        {
          ...user,
          role: roleMapping[user.role ?? 0]?.internal_id ?? user.role,
          password: hashPassword!,
          keycloak_uuid: userNotFound ? null : dataPrevious.keycloak_uuid, // reset keycloak uuid on user keycloak not found
        },
        { id }
      ),
      this.assignChangeLogs(c, dataPrevious),
      isChangeProgramIds && workspace_ids && workspace_ids.length > 0
        ? this.workspaceRepo.attachWithUserID(
            c,
            id,
            workspace_ids,
            isEntityChanged
          )
        : null,
      this.userPublisher.processUpdate(c, id, data),
      this.integrationRepo.upsertAssociation(
        c,
        id,
        "user",
        JSON.stringify({ role, ...external_properties }),
        integration_client_id
      ),
    ])

    return this.detail(c, { id })
  }

  async getChangeLogs(c: Context, id: number) {
    return this.repository.findChangeLogs(c, id).then(async (result) => {
      const userIDs = result.map((el) => Number(el.updated_by) || 0)

      const [users] = await Promise.all(
        result.length > 0
          ? [this.repository.getBasicDetailMapped(c, userIDs)]
          : []
      )

      result.forEach((el) => {
        const userChangeLog = el
        userChangeLog.updated_by =
          users![Number(el.updated_by)]?.firstname ?? "-"
      })
      return result
    })
  }

  async assignChangeLogs(c: Context, dataPrevious: UserResponse) {
    const oldValue = {}
    const newValue = {}
    const dataCurrent = await this.#existUser(c, dataPrevious.id)
    USER_CHANGELOGS_FIELD.forEach((el) => {
      if (dataCurrent[el] !== dataPrevious[el]) {
        if (el === "password") {
          oldValue[el] = 0
          newValue[el] = 1
        } else {
          oldValue[el] = dataPrevious[el]
          newValue[el] = dataCurrent[el]
        }
      }
    })

    if (
      JSON.stringify(newValue) !== "{}" ||
      JSON.stringify(oldValue) !== "{}"
    ) {
      const dataChangeLogs: UserChangeLogsRequest = {
        user_id: dataPrevious.id,
        field: "",
        old_value: JSON.stringify(oldValue).toString(),
        new_value: JSON.stringify(newValue).toString(),
        updated_by: dataCurrent.updated_by?.toString(),
      }
      await this.repository.createChangeLogs(c, dataChangeLogs)
    }
  }

  async updateStatus(c: Context, id: number, data: UpdateStatusRequest) {
    const user = await this.repository.findOne(c, { id: id })
    if (user) {
      await this.authKeycloakService.updateUser(user?.keycloak_uuid ?? "", {
        username: user?.username,
        firstname: user?.firstname,
        lastname: user?.lastname,
        email: user?.email,
        enabled: !!data.status,
      })
    }

    await Promise.all([
      this.repository.update(c, { status: data.status }, { id }),
    ])

    return this.detail(c, { id })
  }

  async exportExcel(c: Context, queries: GetUserQueries) {
    queries.isPaginate = false
    const title = c.var.t("common.user")
    const excelTemplate = new UserTemplateXlsx()
    const timezone = c.req.header("Timezone")

    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)
    await excelTemplate.initSheet(title)

    let excelColumns = [
      {
        header: c.var.t("user.label.id"),
        width: 10,
      },
      {
        header: c.var.t("user.label.username"),
        width: 40,
      },
      {
        header: c.var.t("user.label.fullname"),
        width: 40,
      },
      {
        header: c.var.t("user.label.role"),
        width: 20,
      },
      {
        header: c.var.t("user.label.entity"),
        width: 40,
      },
      {
        header: c.var.t("common.program"),
        width: 40,
      },
      {
        header: c.var.t("user.label.last_login"),
        width: 20,
      },
      {
        header: c.var.t("common.status"),
        width: 20,
      },
      {
        header: c.var.t("user.label.receive_daily_recap_email"),
        width: 20,
      },
      {
        header: c.var.t("common.created_at"),
        width: 20,
      },
      {
        header: c.var.t("common.created_by"),
        width: 20,
      },
      {
        header: c.var.t("common.updated_at"),
        width: 20,
      },
      {
        header: c.var.t("common.updated_by"),
        width: 20,
      },
    ]

    if (c.var.role !== USER_ROLE.SUPERADMIN) {
      excelColumns = excelColumns.filter(
        (col) => col.header !== c.var.t("user.label.receive_daily_recap_email")
      )
    }

    excelTemplate.setColumns(excelColumns)

    const data = await this.repository.findAll(c, queries)
    const items = await this.#mapList(c, data.users)

    const setRows: TExportUser[] = []
    for (const user of items) {
      const row: TExportUser = {
        id: user.id,
        username: user.username,
        fullname: user?.firstname + " " + user?.lastname,
        role_label: user.role_label,
        entity: user.entity?.name,
        program: user.programs?.map((el) => el.name).join(", "),
        last_login: user?.last_login,
        status:
          user?.status === USER_STATUS.ACTIVE
            ? c.var.t("common.active")
            : c.var.t("common.inactive"),
        daily_recap_email:
          user?.daily_recap_email === DAILY_RECAP_EMAIL.YES
            ? c.var.t("common.yes")
            : c.var.t("common.no"),
        created_at: moment(user.created_at).format("YYYY-MM-DD h:mm:ss"),
        user_created_by: user.user_created_by?.firstname ?? "-",
        updated_at: formatDateWithTimezone(user.updated_at, timezone),
        user_updated_by: user.user_updated_by?.firstname ?? "-",
      }

      if (c.var.role !== USER_ROLE.SUPERADMIN) {
        delete row.daily_recap_email
      }

      setRows.push(row)
    }

    await excelTemplate.addRows(title, setRows)

    return await excelTemplate.generate()
  }

  async templateExcel(c: Context) {
    const excelTemplate = new UserTemplateXlsx()
    const language = c.var.language
    const templatePath = path.resolve(
      "public",
      "templates",
      "user",
      `user_template_${language}.xlsx`
    )

    await excelTemplate.loadFromFile(templatePath)
    await Promise.allSettled([
      excelTemplate.setMasterList(
        c.var.t("user.sheet.list_village"),
        await this.locationRepo.getDistrictStream(c)
      ),
      excelTemplate.setMasterList(
        c.var.t("user.sheet.list_program"),
        this.workspaceRepo.getStreamData(c)
      ),
      excelTemplate.setMasterList(
        c.var.t("user.sheet.list_manufacture"),
        this.manufactureRepo.getStreamData(c)
      ),
    ])

    return await excelTemplate.generate("Template Import User")
  }

  async importExcel(c: Context, rows: TImportUser[]) {
    for (const [index, row] of rows.entries()) {
      const user: TCreateUserReq = {
        username: row.username,
        role: row.role,
        view_only: row.view_only,
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        daily_recap_email: row.daily_recap_email,
        gender: row.gender,
        address: row?.address,
        village_id: row?.village_id,
        date_of_birth: row?.date_of_birth,
        mobile_phone: row?.mobile_phone,
        entity_id: row.entity_id,
        manufacture_id: row?.manufacture_id,
        password: row.password,
        program_ids: row.program_ids,
      }

      const inserted = await this.createUser(c, user, false)
      if (!inserted.success) {
        c.addError(
          `${index + 10}`,
          c.var.t("validator.exist", {
            field: c.var.t("common.user"),
          }),
          `${user.username} and ${user.email}`
        )
      }
    }

    if (c.var.errors) {
      return {
        success: false,
        data: null,
        errors: c.var.errors,
      }
    }

    return {
      success: true,
      data: rows.length,
      errors: null,
    }
  }

  async updateUserLastAndFcmByUUID(
    c: Context,
    data: UpdateLastLoginRequest,
    id: string
  ) {
    await this.repository.updateUserLastAndFcmByUUID(c, data, id)
  }

  async #existUser(c: Context, id: number | string) {
    const user = await this.repository.findById(c, id)
    if (!user.id) {
      throw new NotFoundError(
        `${c.var.t("validator.not_exist", { field: "user" })}`
      )
    }
    return user
  }

  async #manageWorkspaces(c: Context, userId: number, workspaceIds?: number[]) {
    await this.workspaceRepo.attachWithUserID(
      c,
      Number(userId),
      workspaceIds ?? []
    )
  }
  async #mapList(c: Context, data: UserResponse[]) {
    const userIDs = collect(data, "id")
    const entityIDs = collect(data, "entity_id")
    const roleIDs = collect(data, "role")
    const createdByIds = collect(data, "created_by")
    const updatedByIds = collect(data, "updated_by")
    const mergeByIds = merge(createdByIds, updatedByIds)

    const [entity, workspaces, role, userBy] = await Promise.all([
      entityIDs.length > 0
        ? this.entityRepo.findBasicAllByIds(c, entityIDs)
        : [],
      userIDs.length > 0
        ? this.workspaceRepo.getByFromMappedWorkspace(c, "user", userIDs)
        : {},
      roleIDs.length > 0 ? this.roleRepo.findByIDMapped(c, roleIDs) : {},
      mergeByIds.length > 0
        ? this.repository.getByIDsMapped(c, mergeByIds)
        : {},
    ])

    return data.map(
      ({
        password,
        token_login,
        sim_id,
        sim_provider,
        imei_number,
        change_password,
        fcm_token,
        application_version,
        iota_app_gui_theme,
        mobile_phone_2,
        mobile_phone_brand,
        mobile_phone_model,
        permission,
        last_mobile_access,
        timezone_id,
        metadata,
        ...el
      }) =>
        ({
          ...el,
          external_properties: metadata ?? el.external_properties,
          entity: entity[Number(el.entity_id ?? 0)],
          programs: (workspaces[Number(el.id)] as TWorkspaces[]) ?? [],
          role_label: metadata?.role?.name ?? role[Number(el?.role ?? 0)]?.name,
          user_created_by: userBy[el.created_by ?? 0]?.[0] ?? {},
          user_updated_by: userBy[el.updated_by ?? 0]?.[0] ?? {},
        }) as UserResponse
    )
  }
}
