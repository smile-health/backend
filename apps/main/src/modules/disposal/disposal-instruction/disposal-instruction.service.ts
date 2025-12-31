import { DISPOSAL_INSTRUCTIONS } from "@/common/constants/disposal.js"
import { ActivityRepository } from "@/modules/activity/activity.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "@smile/lib/error.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { logger } from "@smile/lib/logger.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect, group } from "@smile/lib/utils.js"
import { Context } from "hono"
import _ from "lodash"
import { IntegrationRepository } from "../integration/integration.repository.js"
import { canCreateBast, canGetBast } from "../integration/integration.schema.js"
import {
  CreateBastRequest,
  DisposalCancellationRequest,
  GetBastRequest,
} from "../integration/wms/wms.schema.js"
import {
  DisposalInstruction,
  DisposalInstructionExportData,
  DisposalInstructionResponse,
  DisposalInstructionStatus,
} from "./disposal-instruction.model.js"
import { DisposalInstructionRepository } from "./disposal-instruction.repository.js"
import {
  CreateDisposalInstructionCommentRequest,
  CreateDisposalInstructionRequest,
  DisposalInstructionListPaginatedRequestDTO,
  DisposalInstructionTypesListPaginatedRequestDTO,
} from "./disposal-instruction.schema.js"

export class DisposalInstructionService {
  constructor(
    private readonly repository: DisposalInstructionRepository,
    private readonly entityRepo: EntityRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly userRepo: UserRepository,
    private readonly integrationRepo: IntegrationRepository
  ) {}

  async findByReportNumber(
    c: Context,
    reportNumber: string | null
  ): Promise<DisposalInstruction | null> {
    return await this.repository.findByReportNumber(c, reportNumber)
  }

  async createInstruction(
    c: Context,
    data: CreateDisposalInstructionRequest
  ): Promise<{ id: number }> {
    try {
      const existingInstruction = await this.repository.findByReportNumber(
        c,
        data.bast_no
      )
      if (existingInstruction) {
        throw new ValidationError(
          c.var.t("disposal_instruction.error.already_exists", {
            reportNumber: data.bast_no
          })
        )
      }

      const client = await this.integrationRepo.getClientByEntityId(
        c,
        data.customer_id
      )

      if (!client || !canCreateBast(client)) {
        throw new ValidationError(
          c.var.t("disposal_instruction.error.entity_not_integrated")
        )
      }

      const uniqueMaterialCount = new Set(
        data.disposal_items.map((item) => item.material_id)
      ).size

      const instructionId = await this.repository.createInstruction(c, {
        entity_id: data.customer_id,
        activity_id: data.activity_id,
        disposal_instruction_type_id: data.instruction_type_id,
        device_type: c.var.deviceType,
        report_number: data.bast_no,
        item_count: uniqueMaterialCount,
        status: DisposalInstructionStatus.CREATED,
      })

      const [entity, material, instructionType] = await Promise.all([
        this.entityRepo.getBasicDetail(c, data.customer_id),
        this.materialRepo.getMaterialMapped(
          c,
          collect(data.disposal_items, "material_id")
        ),
        this.repository.findInstructionTypeById(c, data.instruction_type_id),
      ])

      const { user } = c.var
      const createBastPayload: CreateBastRequest = {
        bast_no: data.bast_no,
        disposal_comments: data.disposal_comments ?? "-",
        instruction_type_id: data.instruction_type_id,
        instruction_type_label: instructionType.title,
        sender: {
          entity_id: entity.global_id,
          address: entity.address ?? "-",
          entity_name: entity.name ?? "-",
          province_name: entity.province_name ?? "-",
          regency_name: entity.city_name ?? "-",
          status: 1,
          type: entity.type,
          type_label: "",
        },
        disposal_items: data.disposal_items.map((item) => ({
          material_id: item.material_id,
          material_name: material[item.material_id]?.name ?? "-",
          qty: _.sumBy(
            _.flatMap(item.stocks, "disposal_stocks"),
            (disposalStock) => disposalStock.discard_qty + disposalStock.received_qty
          ),
        })),
        user_created_by: {
          email: user?.email ?? "",
          firstname: user?.firstname ?? "",
          lastname: user?.lastname ?? "",
          username: user?.username ?? "",
          user_uuid: user?.user_uuid ?? "",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const res = await client.createBast(c.var.token, createBastPayload)
      await this.integrationRepo.createLog({
        client_id: client.getClientId(),
        source_id: instructionId,
        source_type: "disposal_instruction",
        flow: "out",
        tag: `create_bast`,
        request: JSON.stringify(res.request),
        response: JSON.stringify(res.response),
      })

      if (res.response.error) {
        throw new BadRequestError(
          "Integration: Failed to create BAST to third party"
        )
      }

      const items = data.disposal_items.flatMap((item) =>
        item.stocks.flatMap((stock) =>
          stock.disposal_stocks.map((disposalStock) => ({
            material_id: item.material_id,
            disposal_stock_id: disposalStock.disposal_stock_id,
            transaction_reason_id: disposalStock.transaction_reasons?.id ?? 0,
            disposal_discard_qty: disposalStock.discard_qty,
            disposal_received_qty: disposalStock.received_qty,
            batch_number: stock.batch_id ? stock.batch_id.toString() : null,
          }))
        )
      )

      for (const item of items) {
        const getDisposalStock =
          await this.repository.findDisposalStockByIdAndTransactionReason(
            c,
            item.disposal_stock_id,
            item.transaction_reason_id
          )

        if (!getDisposalStock) {
          throw new ValidationError(
            c.var.t("disposal_instruction.error.disposal_stock_not_found", {
              disposalStockId: item.disposal_stock_id,
              transactionReasonId: item.transaction_reason_id
            })
          )
        }

        const currentDisposalDiscardQty =
          getDisposalStock.disposal_discard_qty ?? 0
        const currentDisposalReceivedQty =
          getDisposalStock.disposal_received_qty ?? 0
        const currentDisposalQty = getDisposalStock.disposal_qty ?? 0

        let disposalDiscardQty = 0
        let disposalReceivedQty = 0

        if (
          item.disposal_discard_qty !== undefined ||
          item.disposal_received_qty !== undefined
        ) {
          disposalDiscardQty = item.disposal_discard_qty ?? 0
          disposalReceivedQty = item.disposal_received_qty ?? 0
        }

        await this.repository.updateDisposalStock(c, getDisposalStock.id, {
          disposal_discard_qty: currentDisposalDiscardQty - disposalDiscardQty,
          disposal_received_qty:
            currentDisposalReceivedQty - disposalReceivedQty,
          disposal_qty:
            currentDisposalQty + disposalDiscardQty + disposalReceivedQty,
        })

        const openingQty =
          (getDisposalStock.disposal_discard_qty || 0) +
          (getDisposalStock.disposal_received_qty || 0)
        const changeQty = -(disposalDiscardQty + disposalReceivedQty)

        await this.repository.createInstructionItem(c, {
          disposal_instruction_id: instructionId,
          entity_id: data.customer_id,
          activity_id: data.activity_id,
          material_id: item.material_id,
          disposal_discard_qty: disposalDiscardQty,
          disposal_received_qty: disposalReceivedQty,
          quantity: disposalDiscardQty + disposalReceivedQty,
          transaction_reason_id: item.transaction_reason_id || 0,
          report_number: data.bast_no,
          comment: null,
          change_qty: changeQty || 0,
          open_vial: 0,
          opening_qty: openingQty || 0,
          stock_disposal_id: getDisposalStock.id || 0,
          disposal_method_id: DISPOSAL_INSTRUCTIONS.METHOD,
          disposal_transaction_type_id: 4,
          batch_number: item.batch_number || null,
        })
      }

      if (data.disposal_comments)
        await this.repository.createInstructionComment(c, {
          disposal_instruction_id: instructionId,
          comment: data.disposal_comments,
          status: 1,
          user_id: c.get("userId") || 0,
        })

      return { id: instructionId }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw error
    }
  }

  async getInstructionById(
    c: Context,
    id: number
  ): Promise<DisposalInstructionResponse | null> {
    const instruction = await this.repository.findById(c, id)
    if (!instruction) {
      throw new NotFoundError(
        c.var.t("disposal_instruction.error.not_found")
      )
    }

    const { t } = c.var

    const [items, comments] = await Promise.all([
      this.repository.findInstructionItems(c, id),
      this.repository.findInstructionComments(c, id),
    ])
    const userIds = [
      ...new Set(comments.map((item) => item.user_id)),
      instruction.created_by,
      instruction.updated_by,
    ]

    const [sender, materialMap, activityMap, userMap] = await Promise.all([
      this.entityRepo.getBasicDetail(c, instruction.entity_id),
      this.materialRepo.getMaterialMapped(c, collect(items, "material_id")),
      this.activityRepo.getActivityMapped(c, collect(items, "activity_id")),
      this.userRepo.getBasicDetailMapped(c, userIds),
    ])

    const client = await this.integrationRepo.getClientByEntityId(
      c,
      instruction.entity_id
    )
    if (!client || !canGetBast(client)) {
      throw new ValidationError(
        t("disposal_instruction.error.entity_not_integrated")
      )
    }

    const getBastPayload: GetBastRequest = {
      bast_no: instruction.report_number || "",
    }

    let receiver: any = null
    let wmsDisposalItems: any[] = []

    try {
      const res = await client.getBast(c.var.token, getBastPayload)

      if (res.response.status === 200) {
        receiver = res.response.body?.data?.receiver ?? null
        wmsDisposalItems = res.response.body?.data?.disposal_items ?? []
      } else {
        await this.integrationRepo.createLog({
          client_id: client.getClientId(),
          source_id: instruction.id,
          source_type: "disposal_instruction",
          flow: "out",
          tag: `get_bast_detail`,
          request: JSON.stringify(res.request),
          response: JSON.stringify(res.response),
        })
      }
    } catch (error: any) {
      logger.error(error)
      await this.integrationRepo.createLog({
        client_id: client.getClientId(),
        source_id: instruction.id,
        source_type: "disposal_instruction",
        flow: "out",
        tag: `get_bast_detail`,
        request: JSON.stringify(getBastPayload),
        response: JSON.stringify({ error: error.message || "Unknown error" }),
      })
    }

    const disposalInstructionType = await c.var.trx
      .selectFrom("ws_disposal_instruction_types")
      .select(["id", "title"])
      .where("id", "=", instruction.disposal_instruction_type_id)
      .executeTakeFirst()

    const statusLabel = instruction.status === 1 ? "CREATED" : "REJECTED"
    const mapItem = group(items, "material_id")

    return {
      id: instruction.id,
      activity_id: instruction.activity_id,
      created_at: instruction.created_at.toISOString(),
      created_by: instruction.created_by,
      sender_id: instruction.entity_id,
      device_type: instruction.device_type || 1, // Default to 1 if null
      bast_no: instruction.report_number || "",
      instruction_type_id: instruction.disposal_instruction_type_id,
      instruction_type_label: disposalInstructionType?.title
        ? t(
            `disposal.instruction.type.${disposalInstructionType.title.toLowerCase().replace(/\s+/g, "_")}`,
            disposalInstructionType.title
          )
        : "",
      status: instruction.status || 1, // Default to 1 if null
      status_label: statusLabel,
      updated_at: instruction.updated_at.toISOString(),
      sender: sender
        ? {
            ...sender,
            unit: DISPOSAL_INSTRUCTIONS.SENDER,
          }
        : null,
      receiver: receiver?.user_uuid
        ? {
            ...receiver,
            unit: DISPOSAL_INSTRUCTIONS.RECEIVER,
          }
        : null,
      activity: activityMap[instruction.activity_id] ?? null,
      user_created_by: userMap[instruction.created_by] ?? null,
      user_updated_by: userMap[instruction.updated_by] ?? null,
      disposal_items: Object.keys(mapItem).map((key) => {
        const stocks = mapItem[Number(key)] ?? []
        const filteredDisposalItems = wmsDisposalItems.filter(
          (item) => item.material_id === Number(key)
        )
        const wasteInfo = collect(filteredDisposalItems, "waste_info").map(
          (item) => ({
            ...item,
            waste_bag_histories: item.waste_bag_histories.map((bag) => ({
              status_id: bag.status,
              status_label: bag[`status_label_${c.var.language}`],
              updated_at: bag.updated_at,
            })),
          })
        )

        const openingQty = _.sumBy(stocks, "opening_qty")
        const changeQty = _.sumBy(stocks, "change_qty")

        return {
          created_at:
            _.maxBy(stocks, "created_at")?.created_at.toISOString() ||
            new Date().toISOString(),
          material_id: Number(key),
          qty: Math.abs(changeQty),
          opening_qty: openingQty,
          closing_qty: openingQty + changeQty,
          master_material: materialMap[key] || null,
          instruction_disposal_stocks: stocks.map((stock) => ({
            disposal_discard_qty:
              stock.disposal_discard_qty !== null
                ? stock.disposal_discard_qty
                : 0,
            disposal_item_id: stock.id,
            disposal_received_qty: stock.disposal_received_qty,
            id: stock.id,
            stock_id: stock.stock_id ?? null,
            transaction_reasons: stock.transaction_reason_id
              ? {
                  id: stock.transaction_reason_id,
                  title: stock.transaction_reason_title
                    ? t(`transaction.reason.${stock.transaction_reason_title}`)
                    : "",
                }
              : null,
            stock: {
              activity: activityMap[stock.activity_id ?? 0] ?? null,
              activity_id: stock.activity_id ?? null,
              batch: stock.batch_id
                ? {
                    code: stock.batch_code || "",
                    expired_date: stock.expired_date?.toISOString() || "",
                    id: stock.batch_id || 0,
                    manufacture: stock.manufacture_id
                      ? {
                          name: stock.manufacture_name || "",
                        }
                      : null,
                    manufacture_id: stock.manufacture_id || 0,
                    manufacture_name: stock.manufacture_name || "",
                    production_date: stock.production_date?.toISOString() || "",
                    status: stock.batch_status || 0,
                  }
                : null,
              batch_id: stock.batch_id,
              created_by: stock.created_by || 0,
              created_at:
                stock.created_at?.toISOString() || new Date().toISOString(),
              stock_id: stock.stock_id ?? null,
              updated_by: stock.updated_by || 0,
              updated_at:
                stock.updated_at?.toISOString() || new Date().toISOString(),
            },
          })),
          waste_info: wasteInfo,
        }
      }),
      disposal_comments: comments.map((comment) => {
        const user = userMap[comment.user_id || 0]
        return {
          id: comment.id,
          comment: comment.comment || "",
          created_at: comment.created_at.toISOString(),
          status: comment.status || 0,
          user_id: comment.user_id || 0,
          user: user
            ? {
                id: user.id,
                username: user.username || "",
                firstname: user.firstname || "",
                lastname: user.lastname || "",
              }
            : null,
        }
      }),
    }
  }

  async getInstructionList(
    c: Context,
    params: DisposalInstructionListPaginatedRequestDTO
  ): Promise<PaginatedResponse<any>> {
    const paginationParams = {
      page: params.page ? Number(params.page) : 1,
      paginate: params.paginate ? Number(params.paginate) : 50,
    }

    const cleanParams = {
      ...params,
      page: params.page,
      paginate: params.paginate,
      activity_id:
        params.activity_id !== undefined
          ? Number(params.activity_id)
          : undefined,
    }

    const { data: basicData, total } = await this.repository.findAll(
      c,
      cleanParams
    )

    if (basicData.length === 0) {
      return new PaginatedResponse(paginationParams)
    }

    const disposalInstructionTypes = await c.var.trx
      .selectFrom("ws_disposal_instruction_types")
      .select(["id", "title"])
      .execute()

    const disposalInstructionTypeMap = disposalInstructionTypes.reduce(
      (acc, type) => {
        acc[type.id] = type.title
        return acc
      },
      {} as Record<number, string>
    )

    const instructionIds = basicData.map((item) => item.id)
    const disposalItemsCounts = await c.var.trx
      .selectFrom("ws_disposal_transactions")
      .select([
        "disposal_instruction_id",
        (eb) => eb.fn.count("material_id").distinct().as("items_count"),
      ])
      .where("disposal_instruction_id", "in", instructionIds)
      .where("disposal_transaction_type_id", "=", 4)
      .groupBy("disposal_instruction_id")
      .execute()

    const disposalItemsCountMap = disposalItemsCounts.reduce(
      (acc, item) => {
        acc[item.disposal_instruction_id] = Number(item.items_count)
        return acc
      },
      {} as Record<number, number>
    )

    const userIds = collect(basicData, "created_by")
    const users =
      userIds.length > 0
        ? await c.var.trx
            .selectFrom("ws_users")
            .select(["id", "username", "email", "firstname", "lastname"])
            .where("id", "in", userIds)
            .execute()
        : []

    const userMap = users.reduce(
      (acc, user) => {
        acc[user.id] = user
        return acc
      },
      {} as Record<
        number,
        {
          id: number
          username: string | null
          email: string | null
          firstname: string | null
          lastname: string | null
        }
      >
    )

    const list = basicData.map((res) => ({
      id: res.id,
      device_type: res.device_type,
      status_id: res.status,
      status_label: res.status === 1 ? "CREATED" : "REJECTED",
      activity_id: res.activity_id,
      activity_label: res.activity_name,
      instruction_type_id: res.disposal_instruction_type_id,
      instruction_type_label:
        res.disposal_instruction_type_id !== null &&
        res.disposal_instruction_type_id !== undefined
          ? c.var.t(
              `disposal.instruction.type.${disposalInstructionTypeMap[res.disposal_instruction_type_id]?.toLowerCase().replace(/\s+/g, "_") || ""}`,
              disposalInstructionTypeMap[res.disposal_instruction_type_id] || ""
            )
          : "",
      bast_no: res.report_number,
      sender_id: res.entity_id,
      sender_entity_name: res.entity_name,
      disposal_items_count: disposalItemsCountMap[res.id] || 0,
      created_at: res.created_at.toISOString(),
      updated_at: res.updated_at.toISOString(),
      user_created_by:
        res.created_by && userMap[res.created_by]
          ? {
              id: res.created_by,
              username: userMap[res.created_by]?.username || null,
              email: userMap[res.created_by]?.email || null,
              firstname: userMap[res.created_by]?.firstname || null,
              lastname: userMap[res.created_by]?.lastname || null,
            }
          : null,
    }))

    return new PaginatedResponse(paginationParams, list, total)
  }

  async getInstructionTypesList(
    c: Context,
    params: DisposalInstructionTypesListPaginatedRequestDTO
  ): Promise<PaginatedResponse<any>> {
    const paginationParams = {
      page: params.page ? Number(params.page) : 1,
      paginate: params.paginate ? Number(params.paginate) : 100,
    }

    const cleanParams = {
      ...params,
      page: params.page,
      paginate: params.paginate,
    }

    const { data, total } = await this.repository.findAllInstructionTypes(
      c,
      cleanParams
    )

    if (data.length === 0) {
      return new PaginatedResponse(paginationParams)
    }

    const { t } = c.var

    const list = data.map((item) => ({
      id: item.id,
      title: t(
        `disposal.instruction.type.${item.title.toLowerCase().replace(/\s+/g, "_")}`,
        item.title
      ),
    }))

    return new PaginatedResponse(paginationParams, list, total)
  }

  async generateHandoverLetterReport(c: Context, instructionId: number) {
    const { DetailHandoverLetterExport } = await import(
      "./disposal-instruction.excel.js"
    )

    const instruction = await this.repository.findById(c, instructionId)
    if (!instruction) {
      throw new NotFoundError(
        `Disposal instruction with ID ${instructionId} not found or not accessible in the current program`
      )
    }

    if (!instruction.report_number) {
      throw new ValidationError("Disposal instruction is missing report number")
    }

    try {
      const excelTemplate = new DetailHandoverLetterExport()

      const { t, language } = c.var
      excelTemplate.setTimezone(c.req.header("Timezone"))
      excelTemplate.setLanguage(language)

      const items = await this.repository.findInstructionItems(c, instructionId)

      const entity = await this.entityRepo.getBasicDetail(
        c,
        instruction.entity_id
      )

      excelTemplate.setTitle(
        `${t("disposal.instruction.handover_letter.title", "Handover Letter Report")} ${entity?.name ?? ""}`
      )

      await excelTemplate.loadFile(c)

      const activity = await this.activityRepo.findById(
        c,
        instruction.activity_id,
        c.var.programId
      )

      const materialIds = items
        .map((item) => item.material_id)
        .filter((id) => id !== null && id !== undefined) as number[]
      const materialMap =
        materialIds.length > 0
          ? await this.materialRepo.getMaterialMapped(c, materialIds)
          : {}

      const client = await this.integrationRepo.getClientByEntityId(
        c,
        instruction.entity_id
      )

      let receiver: any = null
      let wmsDisposalItems: any[] = []

      if (client && canGetBast(client)) {
        try {
          const getBastPayload: GetBastRequest = {
            bast_no: instruction.report_number || "",
          }
          const res = await client.getBast(c.var.token, getBastPayload)

          if (res.response.status === 200) {
            receiver = res.response.body?.receiver ?? null
            wmsDisposalItems = res.response.body?.disposal_items ?? []
          }
        } catch (error: any) {
          console.error("Error fetching receiver information:", error)
        }
      }

      const handoverData = {
        no_ba_serah_terima: instruction.report_number || "-",
        aktivitas: activity?.name || "-",
        entitas: entity?.name || "-",
        kota: entity?.regency_name || "-",
        provinsi: entity?.province_name || "-",
        materials:
          items.map((item: any, index: number) => ({
            no: index + 1,
            nama_material:
              (item.material_id && materialMap[item.material_id]?.name) || "-",
            batch: item.batch_code || "-",
            kuantitas:
              item.disposal_discard_qty || item.disposal_received_qty || 0,
            alasan: item.transaction_reason_title || "-",
          })) || [],
        created_at: new Date().toISOString(),
      }

      const sheet1Name = t(
        "disposal.instruction.handover_letter.sheet_name",
        "Laporan"
      )

      await excelTemplate.addRows(
        sheet1Name,
        [
          [handoverData.no_ba_serah_terima || "-"],
          [handoverData.aktivitas || "-"],
          [""],
          [handoverData.entitas || "-"],
          [handoverData.kota || "-"],
          [handoverData.provinsi || "-"],
        ],
        6,
        "B"
      )

      await excelTemplate.addRows(
        sheet1Name,
        [
          [receiver?.entity_name || "-"],
          [receiver?.regency_name || "-"],
          [receiver?.province_name || "-"],
        ],
        9,
        "D"
      )

      const materialsDataSheet1: any[] = []
      handoverData.materials.forEach((item) => {
        const row = [
          item.no,
          item.nama_material,
          item.batch,
          item.kuantitas,
          item.alasan,
        ]
        materialsDataSheet1.push(row)
      })

      await excelTemplate.addRows(sheet1Name, materialsDataSheet1, 15, "A", {
        border: true,
      })

      await excelTemplate.addRows(
        sheet1Name,
        [
          [t("disposal.instruction.handover_letter.description", "Keterangan")],
          [""],
          [
            "",
            "",
            t(
              "disposal.instruction.handover_letter.first_party",
              "PIHAK PERTAMA"
            ),
            "",
            t(
              "disposal.instruction.handover_letter.second_party",
              "PIHAK KEDUA"
            ),
          ],
          [""],
          [""],
          [""],
          ["", "", "_______________", "", "_______________"],
          [""],
          [
            "",
            t("disposal.instruction.handover_letter.date", "Tanggal"),
            new Date(handoverData.created_at).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }) +
              " " +
              new Date(handoverData.created_at).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }),
          ],
        ],
        15 + handoverData.materials.length + 1,
        "A"
      )

      return await excelTemplate.generate()
    } catch (error) {
      console.error("Error generating handover letter report:", error)
      throw error
    }
  }

  async exportExcel(
    c: Context,
    params: DisposalInstructionListPaginatedRequestDTO
  ) {
    const BaseTemplate = (await import("@smile/lib/excel/index.js")).default
    const { mapAsyncIterable } = await import("@smile/lib/utils.js")

    const excelTemplate = new BaseTemplate(14, 1, PROCESSOR.XLSXPOPULATE)
    const { t, language } = c.var
    const title = t(
      "disposal.instruction.export.title",
      "Disposal Instructions"
    )
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setLanguage(language)

    const sheetName = title.substring(0, 31)
    await excelTemplate.initSheet(sheetName)
    excelTemplate.setColumns(
      [
        {
          header: t(
            "disposal.instruction.export.handover_report_number",
            "Handover Report Number"
          ),
          width: 30,
        },
        {
          header: t("disposal.instruction.export.entity_id", "Entity ID"),
          width: 10,
        },
        {
          header: t("disposal.instruction.export.entity_name", "Entity Name"),
          width: 30,
        },
        {
          header: t(
            "disposal.instruction.export.province_name",
            "Province Name"
          ),
          width: 20,
        },
        {
          header: t(
            "disposal.instruction.export.district_regency_name",
            "District/Regency Name"
          ),
          width: 20,
        },
        {
          header: t(
            "disposal.instruction.export.subdistrict_name",
            "Subdistrict Name"
          ),
          width: 20,
        },
        {
          header: t("disposal.instruction.export.entity_type", "Entity Type"),
          width: 15,
        },
        {
          header: t("disposal.instruction.export.material_id", "Material ID"),
          width: 15,
        },
        {
          header: t(
            "disposal.instruction.export.trademark_name",
            "Trademark Name"
          ),
          width: 35,
        },
        {
          header: t("disposal.instruction.export.kfa_code", "KFA Code"),
          width: 15,
        },
        {
          header: t("disposal.instruction.export.batch_code", "Batch Code"),
          width: 15,
        },
        {
          header: t("disposal.instruction.export.expired_date", "Expired Date"),
          width: 15,
        },
        {
          header: t(
            "disposal.instruction.export.manufacture_name",
            "Manufacture Name"
          ),
          width: 20,
        },
        {
          header: t(
            "disposal.instruction.export.discard_transaction_reason",
            "Discard Transaction Reason"
          ),
          width: 25,
        },
        {
          header: t(
            "disposal.instruction.export.activity_name",
            "Activity Name"
          ),
          width: 20,
        },
        {
          header: t(
            "disposal.instruction.export.opening_stock",
            "Disposal Instruction Opening Stock"
          ),
          width: 20,
        },
        {
          header: t(
            "disposal.instruction.export.quantity_issued",
            "Quantity Issued"
          ),
          width: 15,
        },
        {
          header: t(
            "disposal.instruction.export.closing_stock",
            "Disposal Instruction Closing Stock"
          ),
          width: 20,
        },
        {
          header: t(
            "disposal.instruction.export.instruction_type",
            "Disposal Instruction Type"
          ),
          width: 20,
        },
        {
          header: t("disposal.instruction.export.created_by", "Created By"),
          width: 20,
        },
        {
          header: t("disposal.instruction.export.created_at", "Created At"),
          width: 20,
        },
      ],
      "A1",
      sheetName
    )

    const stream: AsyncIterable<DisposalInstructionExportData> =
      (await this.repository.getDetailedStreamData(
        c,
        params
      )) as AsyncIterable<DisposalInstructionExportData>

    const data = mapAsyncIterable(stream, (item) => {
      const fullName = item.user_created_fullname || "-"
      const formatDate = (
        dateInput: string | Date | null | undefined
      ): string => {
        if (!dateInput) return "-"

        let date: Date
        if (typeof dateInput === "string") {
          date = new Date(dateInput)
        } else {
          date = dateInput
        }

        return isNaN(date.getTime())
          ? "-"
          : `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
      }

      return {
        "Handover Report Number": item.report_number || "-",
        "Entity ID": item.entity_id || "-",
        "Entity Name": item.entity_name || "-",
        "Province Name": item.province_name || "-",
        "District/Regency Name": item.regency_name || "-",
        "Subdistrict Name": item.subdistrict_name || "-",
        "Entity Type": item.entity_type
          ? t(
              `entity_type.label.${item.entity_type.toLowerCase()}`,
              item.entity_type
            )
          : "-",
        "Material ID": item.material_id || "-",
        "Trademark Name": item.name || "-",
        "KFA Code": item.code || "-",
        "Batch Code": item.batch_code || "-",
        "Expired Date": formatDate(item.expired_date),
        "Manufacture Name": item.manufacture_name || "-",
        "Discard Transaction Reason": item.transaction_reason || "-",
        "Activity Name": item.activity_name || "-",
        "Disposal Instruction Opening Stock": item.opening_qty || 0,
        "Quantity Issued": item.change_qty ? Math.abs(item.change_qty) : 0,
        "Disposal Instruction Closing Stock":
          (item.opening_qty || 0) + (item.change_qty || 0),
        "Disposal Instruction Type": item.title
          ? t(
              `disposal.instruction.type.${item.title.toLowerCase().replace(/\s+/g, "_")}`,
              item.title
            )
          : "-",
        "Created By": fullName,
        "Created At": formatDate(item.created_at),
      }
    })

    await excelTemplate.addRows(sheetName, data)

    return await excelTemplate.generate()
  }

  async cancelInstruction(
    c: Context,
    data: DisposalCancellationRequest
  ): Promise<void> {
    const instruction = await this.repository.findByReportNumber(
      c,
      data.bast_no
    )

    if (!instruction) {
      throw new NotFoundError(
        `Disposal instruction with BAST number '${data.bast_no}' not found`
      )
    }

    if (instruction.status === DisposalInstructionStatus.REJECTED) {
      throw new ValidationError(
        `Disposal instruction with BAST number '${data.bast_no}' is already rejected`
      )
    }

    const disposalItems = await this.repository.findInstructionItems(
      c,
      instruction.id
    )

    for (const item of disposalItems) {
      const disposalStock =
        await this.repository.findDisposalStockByIdAndTransactionReason(
          c,
          item.stock_disposal_id,
          item.transaction_reason_id
        )

      if (disposalStock) {
        const currentDisposalDiscardQty =
          disposalStock.disposal_discard_qty ?? 0
        const currentDisposalReceivedQty =
          disposalStock.disposal_received_qty ?? 0
        const currentDisposalQty = disposalStock.disposal_qty ?? 0

        const discardQtyToReturn = item.disposal_discard_qty ?? 0
        const receivedQtyToReturn = item.disposal_received_qty ?? 0

        await this.repository.updateDisposalStock(c, disposalStock.id, {
          disposal_discard_qty: currentDisposalDiscardQty + discardQtyToReturn,
          disposal_received_qty:
            currentDisposalReceivedQty + receivedQtyToReturn,
          disposal_qty:
            currentDisposalQty - (discardQtyToReturn + receivedQtyToReturn),
        })
      }
    }

    // Update local instruction status to cancelled (status = 2)
    await this.repository.update(
      c,
      { status: DisposalInstructionStatus.REJECTED },
      { id: instruction.id }
    )

    // Add cancellation comment
    await this.repository.createInstructionComment(c, {
      disposal_instruction_id: instruction.id,
      comment: data.comment,
      status: DisposalInstructionStatus.REJECTED,
      user_id: c.get("userId") || 0,
    })
  }

  async createInstructionComment(
    c: Context,
    instructionId: number,
    body: CreateDisposalInstructionCommentRequest
  ) {
    const instruction = await this.repository.findById(c, instructionId)

    if (!instruction) {
      throw new NotFoundError(
        `Disposal instruction with ID ${instructionId} not found`
      )
    }

    const userId = c.get("userId") || 0
    await this.repository.createInstructionComment(c, {
      disposal_instruction_id: instructionId,
      comment: body.comment,
      status: instruction.status, // Get status based on current instruction status
      user_id: userId,
    })
  }
}
