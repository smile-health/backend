import { NotFoundError } from "@smile/lib/error.js"
import { ExportTemplate } from "@smile/lib/excel.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import moment from "moment"
import { EntityRepository } from "../entity/entity.repository.js"
import { RoleRepository } from "../role/role.repository.js"
import { UserPublisher } from "./user.publisher.js"
import { UserRepository } from "./user.repository.js"
import {
  GetUserQueries,
  UpdateStatusRequest,
  UserResponse,
} from "./user.schema.js"

export class UserModule {
  constructor(
    private readonly repository: UserRepository,
    private readonly entityRepo: EntityRepository,
    private readonly roleRepo: RoleRepository,
    private readonly publisher: UserPublisher
  ) {}

  async list(c: Context, queries: GetUserQueries) {
    queries.isPaginate = true
    queries.offset = (queries.page - 1) * queries.paginate

    const { users, total } = await this.repository.findAll(c, queries)

    if (users.length == 0) {
      return new PaginatedResponse(queries)
    }

    const mapUsers = await this.#mapList(c, users)

    return new PaginatedResponse(queries, mapUsers, Number(total))
  }

  async detail(c: Context, id: number) {
    const user = await this.repository.findOne(c, {
      id: Number(id),
    })

    if (!user) {
      throw new NotFoundError(
        `${c.var.t("validator.not_exist", { field: c.var.t("common.user") })}`
      )
    }

    const [entity] = await Promise.all([
      this.entityRepo.getBasicDetail(c, user.entity_id ?? 0),
    ])

    return {
      ...user,
      entity: entity ?? {},
    }
  }

  async updateStatus(c: Context, id: number, req: UpdateStatusRequest) {
    const user = await this.repository.findOne(c, { id })
    if (!user) {
      throw new NotFoundError("User not found")
    }

    await this.repository.updateStatus(c, id, req.status)
    await this.publisher.processUpdateStatus(c, {
      id: Number(user.global_id),
      program_id: c.var.programId,
      status: req.status,
    })
  }

  async exportExcel(c: Context, queries: GetUserQueries) {
    queries.isPaginate = false
    const title = c.var.t("common.user")
    const excelTemplate = new ExportTemplate(title)

    excelTemplate.setColumns([
      {
        key: "username",
        header: c.var.t("user.label.username"),
        width: 50,
      },
      {
        key: "fullname",
        header: c.var.t("user.label.fullname"),
        width: 50,
      },
      {
        key: "role_label",
        header: c.var.t("user.label.role"),
        width: 30,
      },
      {
        key: "entity",
        header: c.var.t("user.label.entity"),
        width: 50,
      },
      {
        key: "last_login",
        header: c.var.t("user.label.last_login"),
        width: 50,
      },
      {
        key: "status",
        header: c.var.t("common.status"),
        width: 50,
      },
      {
        key: "created_at",
        header: c.var.t("common.created_at"),
        width: 30,
      },
      {
        key: "updated_at",
        header: c.var.t("common.updated_at"),
        width: 30,
      },
    ])

    const data = await this.repository.findAll(c, queries)

    const items = await this.#mapList(c, data.users)
    for await (const user of items) {
      const row = {
        ...user,
        fullname: user.firstname + " " + user.lastname,
        last_login: user.last_login,
        entity: user.entity?.name,
        status:
          user.status == 1
            ? c.var.t("common.active")
            : c.var.t("common.inactive"),
      }
      excelTemplate.addRow(row)
    }

    const formatDate =
      moment().format("MM-DD-YYYY HH_mm_ss") +
      " GMT" +
      moment().format("Z").replace(":00", "")
    const filename = `${title} ${formatDate}`

    return await excelTemplate.generate(filename)
  }

  async getChangeLogs(c: Context, id: number) {
    return this.repository.findChangeLogs(c, id).then(async (result) => {
      const userIDs = result.map((el) => el.user_id)

      const [users] = await Promise.all(
        result.length > 0 ? [this.repository.getByIDsMapped(c, userIDs)] : []
      )

      result.forEach((el) => {
        const userChangeLog = el
        userChangeLog.updated_by = users![Number(el.user_id)]![0]!.firstname
      })
      return result
    })
  }

  async #mapList(c: Context, data: UserResponse[]) {
    const entityIds = collect(data, "entity_id")
    const roleIds = collect(data, "role")

    const [entity, role] = await Promise.all(
      data.length > 0
        ? [
            this.entityRepo.getBasicDetailMapped(c, entityIds),
            this.roleRepo.findByIDMapped(c, roleIds),
          ]
        : []
    )

    const mapUsers = data.map(
      (el) =>
        ({
          ...el,
          entity: entity![Number(el.entity_id)] ?? {},
          role_label: role![Number(el.role)]?.name ?? "",
        }) as UserResponse
    )

    return mapUsers
  }
}
