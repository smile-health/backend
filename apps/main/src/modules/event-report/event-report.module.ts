import { Context } from "hono"
import moment from "moment"
import momentTZ from "moment-timezone"
import {
  DRAFT_STATUS_EVENT_REPORT,
  getNextStatusOptions,
  STATUS_LABEL_MAP,
  DraftStatusValues,
} from "@/common/constants/event-report.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { EventReportRepository } from "./event-report.repository.js"
import {
  CreateEventReportRequest,
  CreateEventReportHistoryDTO,
  CreateEventReportCommentDTO,
  CreateEventReportItemDTO,
  CreateEventReportDTO,
  UpdateEventReportDTO,
  GetEventReportQueries,
  UpdateLinkEventReportRequest,
  RowType,
} from "./event-report.schema.js"
import { EventReportTemplate } from "./event-report.excel.js"
import { EventReportHistoryRepository } from "../event-report-history/event-report-history.repository.js"
import { EventReportCommentRepository } from "../event-report-comment/event-report-comment.repository.js"
import { EventReportItemRepository } from "../event-report-item/event-report-item.repository.js"
import { EventReportStatusRepository } from "../event-report-status/event-report-status.repository.js"
import { pick } from "lodash"

export class EventReportModule {
  constructor(
    private readonly repo: EventReportRepository,
    private readonly eventReportHistoryRepo: EventReportHistoryRepository,
    private readonly eventReportCommentRepo: EventReportCommentRepository,
    private readonly eventReportItemRepo: EventReportItemRepository,
    private readonly eventReportStatusRepo: EventReportStatusRepository
  ) {}

  async create(c: Context, body: CreateEventReportRequest) {
    const userId = Number(c.var.userId)
    const programId = Number(c.get("programId"))
    const { comment, items } = body

    /* Create Event Report */
    const eventReport: CreateEventReportDTO = {
      entity_id: Number(body?.entity_id),
      has_order: Number(body?.has_order),
      order_id: body.order_id,
      do_number: body.do_number,
      arrived_date: body.arrived_date,
      status_id: DRAFT_STATUS_EVENT_REPORT.SUBMITTED,
      program_id: programId,
      created_by: userId,
      updated_by: userId,
    }
    const createdEventReport = await this.repo.create(c, eventReport)
    const createdEventReportId = Number(createdEventReport.insertId)

    /* Create Event Report History */
    const eventReportHistory: CreateEventReportHistoryDTO = {
      report_id: createdEventReportId,
      status_id: DRAFT_STATUS_EVENT_REPORT.SUBMITTED,
      created_by: userId,
    }

    const promises = [this.eventReportHistoryRepo.create(c, eventReportHistory)]

    /* Create Comment */
    if (comment) {
      const eventReportComment: CreateEventReportCommentDTO = {
        report_id: createdEventReportId,
        comment: comment,
        created_by: userId,
      }

      promises.push(this.eventReportCommentRepo.create(c, eventReportComment))
    }
    /* Create Event Report Item */
    const eventReportItem: CreateEventReportItemDTO[] = items.flatMap(
      (item) => {
        return {
          report_id: createdEventReportId,
          material_id: item.material_id,
          custom_material: item.custom_material,
          no_batch: item.batch_code,
          expired_date: item.expired_date,
          production_date: item.production_date,
          qty: item.qty,
          reason_id: item.reason_id,
          child_reason_id: item.child_reason_id,
          created_by: userId,
        }
      }
    )
    // Create Event Report Items
    for (const item of eventReportItem) {
      promises.push(this.eventReportItemRepo.create(c, item))
    }

    await Promise.all(promises)

    return { id: createdEventReportId }
  }

  async detail(c: Context, id: number) {
    const { programId } = c.var
    const roleId = Number(c.var.roleId)
    const response = await this.repo.getEventReportById(c, id, programId)

    if (response) {
      const [eventReportItems, eventReportComments, eventReportHistories] =
        await Promise.all([
          this.eventReportItemRepo.getEventReportItemsByReportId(
            c,
            response.id
          ),
          this.repo.getListComment(c, response.id),
          this.eventReportHistoryRepo.getListHistoryChangeStatus(
            c,
            response.id
          ),
        ])

      const latestStatus = (
        eventReportHistories.length > 0
          ? eventReportHistories.reduce((a, b) => {
              return new Date(a.created_at) > new Date(b.created_at) ? a : b
            })?.status_id
          : []
      ) as number

      // Collect user ids, reason ids
      const commentUserIds = eventReportComments.map((el) => el.created_by)
      const historyUserIds = eventReportHistories.map((el) => el.created_by)
      const userIds = eventReportItems.map((el) => el.created_by)
      userIds.push(Number(response?.created_by))
      userIds.push(...commentUserIds)
      userIds.push(...historyUserIds)
      const uniqueUserIds = [...new Set(userIds)]
      const reasonIds = [
        ...new Set(
          eventReportItems
            .flatMap((el) => [el.reason_id, el.child_reason_id])
            .filter((id): id is number => id !== null)
        ),
      ]
      const statusIds = [
        ...new Set(eventReportHistories.map((el) => el.status_id)),
      ]
      const nextStatus =
        getNextStatusOptions(latestStatus as DraftStatusValues, roleId)
          ?.nextStatus ?? []

      const [mapsUsers, mapsReasons, mapsStatuses] = await Promise.all([
        this.repo.getListUser(c, uniqueUserIds),
        this.repo.getListReason(c, reasonIds),
        this.eventReportStatusRepo.getEventReportStatusesByIds(c, [
          ...new Set([...statusIds, ...nextStatus]),
        ] as number[]),
      ])

      // maping user_created_by, reason, child_reason at event report items
      for (const item of eventReportItems) {
        item.reason =
          c.var.t(
            `event_report.label.${mapsReasons.find((el) => el.id === item.reason_id)?.title}`
          ) ?? null
        item.child_reason =
          c.var.t(
            `event_report.label.${mapsReasons.find((el) => el.id === item.child_reason_id)?.title}`
          ) ?? null
      }

      // maping user_created_by at event report comments
      for (const comment of eventReportComments) {
        comment.user =
          mapsUsers?.find((el) => el.id === comment.created_by) ?? null
      }

      // maping user_created_by at hasistory change status
      for (const history of eventReportHistories) {
        history.created_by =
          mapsUsers.find((el) => el.id === history.created_by) ?? null
        history.status_label = c.var.t(
          `event_report.label.${
            mapsStatuses.find((el) => el.id === history.status_id)?.title
          }`
        )
      }

      return {
        ...pick(response, [
          "id",
          "status_id",
          "order_id",
          "do_number",
          "arrived_date",
          "slip_link",
          "has_order",
          "created_at",
          "updated_at",
        ]),

        entity: {
          id: response.entity_id,
          name: response.entity_name,
          address: response.address,
          province_id: response.province_id,
          type: response.type,
        },
        user_created_by:
          mapsUsers.find((el) => el.id === response.created_by) ?? {},
        user_updated_by:
          mapsUsers.find((el) => el.id === response.updated_by) ?? {},
        user_finished_by:
          eventReportHistories.find(
            (el) =>
              el.status_id === DRAFT_STATUS_EVENT_REPORT.REPORTED_COMPLETED ||
              el.status_id === DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED
          )?.created_by ?? {},
        items: eventReportItems.map((item) => {
          const newItem = { ...item }
          delete newItem.reason_id
          delete newItem.child_reason_id
          return newItem
        }),
        comments: eventReportComments,
        history_change_status: eventReportHistories.sort(
          (a, b) => (a.id as number) - (b.id as number)
        ),
        follow_up_status: mapsStatuses
          .filter((el) => nextStatus.includes(el?.id))
          .map((el) => ({
            id: el.id,
            status_label: c.var.t(`event_report.label.${el.title}`),
          })),
      }
    }
  }

  async update(c: Context, id: number, body: UpdateEventReportDTO) {
    const { update_status_id, comment } = body
    const userId = Number(c.var.userId)
    const promises: Promise<void>[] = []

    const updateDataEventReport = {
      updated_by: userId,
      updated_at: new Date(),
      status_id: update_status_id,
    }

    /* Create Event Report History */
    const eventReportHistory: CreateEventReportHistoryDTO = {
      report_id: id,
      status_id: update_status_id,
      created_by: userId,
    }

    if (comment) {
      const eventReportComment: CreateEventReportCommentDTO = {
        report_id: id,
        comment: comment,
        created_by: userId,
      }
      promises.push(this.eventReportCommentRepo.create(c, eventReportComment))
    }

    promises.push(
      this.repo.update(c, updateDataEventReport, {
        id: Number(id),
      }),
      this.eventReportHistoryRepo.create(c, eventReportHistory)
    )

    await Promise.all(promises)

    return {}
  }

  async list(c: Context, param: GetEventReportQueries) {
    const { entityId, roleId, programId } = c.var
    const { list, total } = await this.repo.getListEventReport(
      c,
      param,
      entityId,
      roleId,
      programId
    )

    // collect event report status ids
    const statusIds = [...new Set(list.map((el) => el.status_id))]

    const [mapsStatuses] = await Promise.all([
      statusIds.length > 0 &&
        this.eventReportStatusRepo.find(c, {
          id: statusIds,
        }),
    ])

    const response = list.map((el) => ({
      ...pick(el, [
        "id",
        "status_id",
        "name",
        "order_id",
        "do_number",
        "arrived_date",
        "created_at",
        "updated_at",
      ]),
      status: c.var.t(
        `event_report.label.${mapsStatuses.find((status) => status.id === el.status_id)?.title ?? ""}`
      ),
    }))

    return new PaginatedResponse(param, response, total)
  }

  async statusCount(c: Context) {
    const { entityId, roleId, programId } = c.var
    const result = await this.repo.statusCount(c, programId, entityId, roleId)

    const countMap = new Map<number | null, number>()
    let totalCount = 0
    for (const row of result) {
      countMap.set(row.status_id, row.count)
      totalCount += row.count
    }

    return Object.entries(STATUS_LABEL_MAP).map(([key, label]) => {
      const status_id = key === "null" ? null : Number(key)
      return {
        status_id,
        count: status_id === null ? totalCount : (countMap.get(status_id) ?? 0),
        label: c.var.t(`event_report.label.${label}`),
      }
    })
  }

  async updateLink(c: Context, id: number, body: UpdateLinkEventReportRequest) {
    const userId = Number(c.var.userId)
    const { link } = body

    const updateLinkDataEventReport = {
      updated_by: userId,
      updated_at: new Date(),
      link,
    }

    await this.repo.update(c, updateLinkDataEventReport, {
      id: Number(id),
    })

    return {}
  }

  async export(c: Context, param: GetEventReportQueries) {
    const { entityId, roleId, programId } = c.var
    const lists = await this.repo.getListEventReportStream(
      c,
      param,
      entityId,
      roleId,
      programId
    )

    const rows: RowType[][] = []
    const timezone = c.req.header("Timezone") || "UTC"
    for await (const item of lists) {
      const row = [
        `LK-${item.id}`,
        item.name ?? "",
        item.province_name ?? "",
        item.regency_name ?? "",
        item.order_id ?? "",
        item.do_number ?? "",
        item.arrived_date
          ? momentTZ(item.arrived_date).tz(timezone).format("DD/MM/YYYY")
          : "",
        item.material_name ? item.material_name : item.custom_material,
        item.no_batch ?? "",
        item.expired_date ? moment(item.expired_date).format("DD/MM/YYYY") : "",
        item.qty ?? "",
        item.parent_reason_title
          ? c.var.t(`event_report.label.${item.parent_reason_title}`)
          : "",
        item.child_reason_title
          ? c.var.t(`event_report.label.${item.child_reason_title}`)
          : "",
        item.finished_at
          ? this.#formatLeadTime(item.created_at, item.finished_at)
          : this.#formatLeadTime(item.created_at),
        item.has_order === 1 ? "Yes" : "No",
        item.status_title
          ? c.var.t(`event_report.label.${item.status_title}`)
          : "",
        item.comment,
        momentTZ(item.created_at).tz(timezone).format("DD/MM/YYYY HH:mm:ss"),
        momentTZ(item.updated_at).tz(timezone).format("DD/MM/YYYY HH:mm:ss"),
        item.link,
      ]

      rows.push(row)
    }

    const columns = [
      {
        key: "id",
        header: c.var.t("event_report.label.xls.id"),
        width: 15,
      },
      {
        key: "name",
        header: c.var.t("event_report.label.xls.name"),
        width: 15,
      },
      {
        key: "province_name",
        header: c.var.t("event_report.label.xls.province_name"),
        width: 15,
      },
      {
        key: "regency_name",
        header: c.var.t("event_report.label.xls.regency_name"),
        width: 15,
      },
      {
        key: "order_id",
        header: c.var.t("event_report.label.xls.order_id"),
        width: 15,
      },
      {
        key: "do_number",
        header: c.var.t("event_report.label.xls.no_packing_slip"),
        width: 15,
      },
      {
        key: "arrived_date",
        header: c.var.t("event_report.label.xls.arrived_date"),
        width: 15,
      },
      {
        key: "material_name",
        header: c.var.t("event_report.label.xls.material_name"),
        width: 15,
      },
      {
        key: "no_batch",
        header: c.var.t("event_report.label.xls.no_batch"),
        width: 15,
      },
      {
        key: "expired_date",
        header: c.var.t("event_report.label.xls.expired_date"),
        width: 15,
      },
      {
        key: "qty",
        header: c.var.t("event_report.label.xls.qty"),
        width: 15,
      },
      {
        key: "parent_reason_title",
        header: c.var.t("event_report.label.xls.parent_reason_title"),
        width: 15,
      },
      {
        key: "child_reason_title",
        header: c.var.t("event_report.label.xls.child_reason_title"),
        width: 15,
      },
      {
        key: "lead_time",
        header: c.var.t("event_report.label.xls.lead_time"),
        width: 15,
      },
      {
        key: "is_canceled",
        header: c.var.t("event_report.label.xls.is_canceled"),
        width: 15,
      },
      {
        key: "status_title",
        header: c.var.t("event_report.label.xls.status_title"),
        width: 15,
      },
      {
        key: "comment",
        header: c.var.t("event_report.label.xls.comment"),
        width: 15,
      },
      {
        key: "created_at",
        header: c.var.t("event_report.label.xls.created_at"),
        width: 15,
      },
      {
        key: "updated_at",
        header: c.var.t("event_report.label.xls.updated_at"),
        width: 15,
      },
      {
        key: "link",
        header: c.var.t("event_report.label.xls.link"),
        width: 15,
      },
    ]

    // Create Excel File
    const sheet = c.var.t("event_report.header.event_report")
    const excelTemplate = new EventReportTemplate()
    await excelTemplate.initSheet(sheet)

    excelTemplate.setTitle(c.var.t("event_report.header.event_report"))
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setColumns(columns)
    await excelTemplate.addRows(sheet, rows)

    return excelTemplate.generate()
  }

  #formatLeadTime(createdAt: Date | string, finishedAt?: Date | string) {
    const start = new Date(createdAt)
    const now = finishedAt ? new Date(finishedAt) : new Date()

    const diffInMs = now.getTime() - start.getTime()

    const totalSeconds = Math.floor(diffInMs / 1000)
    const seconds = totalSeconds % 60

    const totalMinutes = Math.floor(totalSeconds / 60)
    const minutes = totalMinutes % 60

    const totalHours = Math.floor(totalMinutes / 60)

    const pad = (num: number) => num.toString().padStart(2, "0")

    return `${totalHours}:${pad(minutes)}:${pad(seconds)}`
  }
}
