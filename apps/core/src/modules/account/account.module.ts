import { DEVICE_TYPE } from "@/common/constants/users.js"
import env from "@/config/env.js"
import { BadRequestError, UnauthorizedError } from "@smile-health/lib/error.js"
import { pick } from "@smile-health/lib/utils.js"
import bcrypt from "bcrypt"
import { Context } from "hono"
import * as jwt from "jsonwebtoken"
import moment from "moment"
import { AuthKeycloakService } from "../auth/auth.keycloak.service.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { UserPublisher } from "../user/user.publisher.js"
import { UserRepository } from "../user/user.repository.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { ChangePasswordRequest, LoginRequest } from "./account.schema.js"

export class AccountModule {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly entityRepo: EntityRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly locationRepo: LocationRepository,
    private readonly authKeycloakService: AuthKeycloakService,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly userPublisher: UserPublisher
  ) {}

  async login(c: Context, req: LoginRequest) {
    const user = await this.userRepo.findByUsername(c, req.username)
    if (!user) {
      throw new UnauthorizedError(c.var.t("auth.invalid"))
    }

    const passwordMatch = await bcrypt.compare(req.password, user.password)
    if (!passwordMatch) {
      throw new UnauthorizedError(c.var.t("auth.invalid"))
    }

    if (!user.status) {
      throw new UnauthorizedError(c.var.t("auth.account_inactive"))
    }

    // temporary, if id keycloak not exist in table, create user to keycloak
    if (!user.keycloak_uuid || req.create) {
      try {
        const programIds = await this.workspaceRepo.getUserProgramIds(
          c,
          user.id
        )
        const authKeycloak = await this.authKeycloakService.createUser({
          username: user.username,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          password: req.password,
          program_ids: programIds.map((val: number) => String(val)),
          role_label: user.role_label ?? "None",
        })
        await this.userRepo.update(
          c,
          {
            keycloak_uuid: authKeycloak.keycloak_uuid,
            user_uuid: authKeycloak.user_uuid,
          },
          { id: user.id }
        )
      } catch (error) {
        console.log(`Failed insert data to keycloak ${JSON.stringify(error)}`)
      }
    }

    const [entity, allWorkspaces, manufacture] = await Promise.all([
      this.entityRepo.findBasicById(c, user.entity_id ?? 0),
      this.workspaceRepo.getByFromMappedWorkspace(c, "user", user.id),
      this.manufactureRepo.findOne(c, { id: user.manufacture_id }),
    ])

    const workspaces = allWorkspaces[user.id] ?? []

    const entityLocationId =
      entity?.village_id ??
      entity?.sub_district_id ??
      entity?.regency_id ??
      entity?.province_id ??
      "0"
    const entityLocation = await this.locationRepo.getDetails(
      c,
      Number(entityLocationId)
    )

    const payload = {
      account_id: user.id,
      workspaces: workspaces,
      role: user.role,
    }

    const token = jwt.sign(payload, env.APP_KEY, { expiresIn: "7d" })
    user.token_login = token
    c.set("user", user)

    await this.userRepo.updateUserTokenLogin(
      c,
      {
        token_login: token,
        fcm_token: req.fcm_token,
        last_login: moment().format("YYYY-MM-DD HH:mm:ss"),
        last_device: DEVICE_TYPE[c.req.header("device-type")!],
      },
      user.id
    )

    const baseResponse = {
      ...pick(user, [
        "id",
        "firstname",
        "lastname",
        "username",
        "email",
        "role",
      ]),
      entity: {
        ...entity,
        ...entityLocation,
      },
      manufacture,
      token,
    }

      return {
        ...baseResponse,
        programs: workspaces
          .filter((ws) => ws.is_beneficiaries === 0)
          .map((ws) => ws.id),
        beneficiaries: workspaces
          .filter((ws) => ws.is_beneficiaries === 1)
          .map((ws) => ws.id),
      }
  }

  async logout(c: Context) {
    return await this.userRepo.invalidateToken(c, c.var.accountID)
  }

  async getWorkspaces(c: Context) {
    const workspaces = await this.workspaceRepo.getByFromMappedWorkspace(
      c,
      "user",
      c.var.accountID
    )
    return workspaces[c.var.accountID] ?? []
  }

  async getProfile(c: Context) {
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
    } = await this.userRepo.findById(c, c.var.accountID)

    const [entity, allWorkspaces, manufacture] = await Promise.all([
      this.entityRepo.findBasicById(c, user.entity_id ?? 0),
      this.workspaceRepo.getByFromMappedWorkspace(c, "user", user.id),
      this.manufactureRepo.findOne(c, { id: user.manufacture_id }),
    ])

    const workspaces = allWorkspaces[user.id] ?? []
    const { client, resource_access } = c.var

    const baseResponse = {
      ...user,
      client: client
        ? {
            id: client.getId(),
            key: client.getKey(),
          }
        : null,
      external_roles:
        client && resource_access
          ? resource_access[client.getKey()]?.roles
          : [],
      entity,
      manufacture,
    }

    return {
      ...baseResponse,
      programs: workspaces.filter((w) => w.is_beneficiaries === 0),
      beneficiaries: workspaces.filter((w) => w.is_beneficiaries === 1),
    }
  }

  async changePassword(c: Context, data: ChangePasswordRequest) {
    const user = await this.userRepo.findOne(c, { id: c.var.user.id })

    const passwordMatch = await bcrypt.compare(data.password, user?.password)

    if (!passwordMatch) {
      throw new BadRequestError(c.var.t("auth.old_password_unmatch"))
    }

    if (user?.keycloak_uuid) {
      await this.authKeycloakService.updateUser(user?.keycloak_uuid ?? "", {
        username: user?.username,
        firstname: user?.firstname,
        lastname: user?.lastname,
        email: user?.email,
        password: data.new_password!,
        user_uuid: user.user_uuid,
      })
    }

    await this.userRepo.updatePassword(
      c,
      {
        new_password: await bcrypt.hash(data.new_password, 10),
      },
      c.var.user.id
    )

    await this.userPublisher.processUpdatePassword(c, c.var.accountID, data)
  }
}
