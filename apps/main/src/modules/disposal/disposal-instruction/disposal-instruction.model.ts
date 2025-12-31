import {
  WsDisposalInstructionComments,
  WsDisposalInstructions,
  WsDisposalTransactions,
} from "@/common/infrastructure/database/types/db.js"
import { Selectable } from "kysely"

export const DisposalInstructionStatus = {
  CREATED: 1,
  REJECTED: 2,
}

export interface DisposalInstruction
  extends Selectable<WsDisposalInstructions> {
  id: number
  entity_id: number
  activity_id: number
  disposal_instruction_type_id: number
  device_type: number | null
  report_number: string | null
  item_count: number | null
  status: number | null
  created_at: Date
  updated_at: Date
  created_by: number
  updated_by: number
  deleted_at: Date | null
  deleted_by: number | null
}

export interface DisposalInstructionComment
  extends Selectable<WsDisposalInstructionComments> {
  id: number
  disposal_instruction_id: number
  comment: string | null
  status: number | null
  user_id: number | null
  created_at: Date
  updated_at: Date
  created_by: number
  updated_by: number
  deleted_at: Date | null
  deleted_by: number | null
}

export interface DisposalInstructionItem
  extends Selectable<WsDisposalTransactions> {
  id: number
  disposal_instruction_id: number
  material_id: number
  transaction_reason_id: number
  disposal_discard_qty: number | null
  disposal_received_qty: number | null
  quantity: number | null
  batch_number: string | null
  created_at: Date
  updated_at: Date
  created_by: number
  updated_by: number
  deleted_at: Date | null
  deleted_by: number | null

  change_qty: number | null
  opening_qty: number | null
  open_vial: number | null
  stock_disposal_id: number
  disposal_method_id: number
  disposal_transaction_type_id: number
}

export interface DisposalInstructionResponse {
  id: number
  activity_id: number
  created_at: string
  created_by: number
  sender_id: number
  device_type: number
  bast_no: string
  instruction_type_id: number
  instruction_type_label: string
  status: number
  status_label: string
  updated_at: string
  sender: {
    address: string
    id: number
    entity_name: string
    province_name: string
    regency_name: string
    status: number
    type: number
    type_label: string
    created_at: string
    updated_at: string
    unit: string
  } | null
  receiver: {
    name: string
    role: string
    address: string
    entity_name: string
    unit: string
  } | null
  activity: {
    id: number
    name: string
  } | null
  user_created_by: {
    firstname: string | null
    id: number
    lastname: string | null
    username: string | null
  } | null
  user_updated_by: {
    firstname: string | null
    id: number
    lastname: string | null
    username: string | null
  } | null
  disposal_items: DisposalInstructionItemResponse[]
  disposal_comments: DisposalInstructionCommentResponse[]
}

export interface DisposalInstructionItemResponse {
  created_at: string
  material_id: number
  qty: number
  opening_qty: number
  closing_qty: number
  master_material: {
    code: string
    description: string
    kfa_code: string
    kfa_level_id: number
    managed_in_batch: number
    name: string
    parent_id: number
    pieces_per_unit: number
    status: number
    temperature_max: number
    temperature_min: number
    temperature_sensitive: number
    unit: string
    unit_of_distribution: string
    updated_at: string
  } | null
  instruction_disposal_stocks: {
    disposal_discard_qty: number
    disposal_item_id: number
    disposal_received_qty: number | null
    id: number
    stock_id: number
    transaction_reasons: {
      id: number
      title: string
    } | null
    stock: {
      activity: {
        id: number
        name: string
      } | null
      activity_id: number | null
      batch: {
        code: string
        expired_date: string
        id: number
        manufacture: {
          name: string
        } | null
        manufacture_id: number
        manufacture_name: string
        production_date: string
        status: number
      } | null
      batch_id: number | null
      created_by: number
      created_at: string
      stock_id: number | null
      updated_by: number
      updated_at: string
    } | null
  }[]
  waste_info: {
    waste_bag_codes: string
    waste_bag_total_weight: string
    waste_bag_type_label: string
    waste_bag_histories: {
      status_id: string
      status_label: string
      updated_at: string
    }[]
  }[]
}

export interface DisposalInstructionCommentResponse {
  id: number
  comment: string
  created_at: string
  status: number
  user_id: number
  user: {
    id: number
    username: string
    firstname: string
    lastname: string
  } | null
}

export interface DisposalInstructionListResponse {
  id: number
  entity_id: number
  entity_name: string
  activity_id: number
  activity_name: string
  disposal_instruction_type_id: number
  disposal_instruction_type_name: string
  device_type: number | null
  report_number: string | null
  item_count: number | null
  status: number | null
  status_name: string
  created_at: string
  updated_at: string
}

export interface DisposalInstructionExportData {
  report_number: string | null
  entity_id: number | null
  entity_name: string | null
  entity_type: string | null
  province_name: string | null
  regency_name: string | null
  subdistrict_name: string | null
  material_id: number | null
  name: string | null
  code: string | null
  batch_code: string | null
  expired_date: Date | null
  manufacture_name: string | null
  transaction_reason: string | null
  activity_name: string | null
  opening_qty: number | null
  change_qty: number | null
  title: string | null
  user_created_fullname: string | null
  user_created_username: string | null

  created_at: Date | null
}
