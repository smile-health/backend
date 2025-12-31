import moment from "moment"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import env from "@/config/env.js"
import { NotFoundError } from "@smile/lib/error.js"
import { ExportTemplate } from "@smile/lib/excel.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { EntityRepository } from "../entity/entity.repository.js"
import { RoleRepository } from "../role/role.repository.js"
import { UserRepository } from "./user.repository.js"
import { GetUserQueries, SyncUserRequest, UserResponse } from "./user.schema.js"

export class UserModule {
  constructor(
    private repository: UserRepository,
    private readonly entityRepo: EntityRepository,
    private readonly roleRepo: RoleRepository
  ) {}

  async syncData(c: CustomContext<DB>, req: SyncUserRequest) {
    const [user, entity] = await Promise.all([
      this.repository.findUserByGlobalID(c, req.user.id),
      this.repository.findEntityByGlobalID(c, req.user.entity_id ?? -1),
    ])

    req.user.status = Number(req.workspace_ids.includes(env.WORKSPACE_ID))
    req.user.entity_id = entity?.id
    req.user.global_id = req.user.id
    req.user.id = user ? user.id : 0

    await this.repository.upsertUser(c, req)
  }

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
    const user = await this.repository.findDynamic(c, "id", "=", id, true)

    if (!user[0]) {
      throw new NotFoundError("User not found")
    }

    const [entity] = await Promise.all([
      this.entityRepo.getBasicDetail(c, user[0].entity_id ?? 0),
    ])

    return {
      ...user[0],
      entity: entity ?? {},
    }
  }

  async exportExcel(c: Context, queries: GetUserQueries) {
    queries.isPaginate = false
    const language = c.var.language!
    const title = "User"
    const excelTemplate = new ExportTemplate(title)

    excelTemplate.setColumns([
      {
        key: "username",
        header: this.#getTranslation(language, "Username", "Nama Alias"),
        width: 50,
      },
      {
        key: "fullname",
        header: this.#getTranslation(language, "Full Name", "Nama Lengkap"),
        width: 50,
      },
      {
        key: "role_label",
        header: this.#getTranslation(language, "Role", "Peran"),
        width: 30,
      },
      {
        key: "entity",
        header: this.#getTranslation(language, "Entity", "Entitas"),
        width: 50,
      },
      {
        key: "last_login",
        header: this.#getTranslation(language, "Last Login", "Login Terakhir"),
        width: 50,
      },
      {
        key: "status",
        header: this.#getTranslation(language, "Status", "Status"),
        width: 50,
      },
      {
        key: "created_at",
        header: this.#getTranslation(
          language,
          "Created Date",
          "Tanggal Dibuat"
        ),
        width: 30,
      },
      {
        key: "updated_at",
        header: this.#getTranslation(
          language,
          "Updated Date",
          "Tanggal Diubah"
        ),
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
            ? this.#getTranslation(language, "Active", "Aktif")
            : this.#getTranslation(language, "Inactive", "Tidak Aktif"),
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

  #getTranslation(language: string, en: string, id: string): string {
    const translation: string = language === "en" ? en : id
    return translation
  }
}
