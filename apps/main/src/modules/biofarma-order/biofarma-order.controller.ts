/* eslint-disable no-plusplus */
/* eslint-disable no-unused-vars */

/**
 * BiofarmaOrderController - Refactored Version
 * 
 * This controller handles Biofarma order operations including:
 * - Creating and managing Biofarma orders
 * - Synchronizing with SMILE system
 * - Processing SMDV orders
 * - Managing order cancellations and updates
 * 
 * Refactored for improved code organization and maintainability
 * while preserving all existing functionality.
 */

import axios from 'axios'
import moment from 'moment'
import _ from 'lodash'
import { logger } from '@smile/lib/logger.js'

import { db } from '@/common/infrastructure/database/index.js'
import { IntegrationBiofarmaOrders, IntegrationBiofarmaSmdvOrders } from '@/common/infrastructure/database/types/db.js'
import { Insertable, Updateable, sql } from 'kysely'
import { ORDER_CANCEL_REASON, ORDER_STATUS } from '@/common/constants/order.js'
import { getSmileHeader } from '../helpers/integrations/smileIntegrationHelper.js'
import env from '@/config/env.js'

// ============================================================================
// CONFIGURATION AND CONSTANTS
// ============================================================================

/**
 * Logger configuration for Biofarma operations
 */
// Logger is now imported from shared lib package

/**
 * Environment configuration constants
 */
// Configuration is now imported from shared env config

/**
 * Application state variables
 */
const STATE = {
  orderCreated: [],
  lastNoDO: null,
  lastOrder: {},
  totalData: null,
  lastData: 1,
  ACTIVITY_BIOFARMA: 8
}

/**
 * Business logic constants
 */
const BUSINESS_CONSTANTS = {
  excludeName: [
    'COVID-19 VACCINE MODERNA :EUA2159700143A1',
    'VAKSIN COVID 19 SINOPHARM DUS 1 VIAL @1 DS (HIBAH UEA)'
  ],
  changeKodeArea: [
    { src: 1608, dest: 1609 },
    { src: 1609, dest: 1608 }
  ]
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if current data is the last data to be processed
 * @returns {boolean} True if this is the last data
 */
function isLastData(): boolean {
  return STATE.lastData === STATE.totalData
}

/**
 * Formats batch data for Biofarma orders
 * @param {Object} biofarmaOrder - The biofarma order data
 * @returns {Object} Formatted batch object
 */
function formatBatch(biofarmaOrder: any): object {
  return {
    code: biofarmaOrder.no_batch,
    expired_date: moment(biofarmaOrder.expired_date).format('YYYY-MM-DD'),
    production_date: '',
    manufacture_name: 'Biofarma',
    qty: biofarmaOrder.jm_dosis
  }
}

/**
 * Formats batch data for V2 Biofarma orders
 * @param {Object} biofarmaOrder - The biofarma order data
 * @returns {Object} Formatted batch object with activity ID
 */
function formatBatchV2(biofarmaOrder: any): object {
  return {
    code: biofarmaOrder.no_batch,
    expired_date: moment(biofarmaOrder.expired_date).format('YYYY-MM-DD'),
    production_date: '',
    manufacture_name: 'Biofarma',
    qty: biofarmaOrder.jm_dosis,
    activity_id: STATE.ACTIVITY_BIOFARMA,
  }
}

/**
 * Maps Biofarma data to SMILE format
 * @param {string} type - The type of mapping (provinsi/hub)
 * @param {Object} item - The item to map
 * @returns {Object} Mapped object in SMILE format
 */
function mapBiofarmaToSmile(type: string, item: any = {}): object {
  let kodeArea = item['KODE AREA']
  BUSINESS_CONSTANTS.changeKodeArea.forEach(kode => {
    if (item['KODE AREA'] === kode.src) {
      kodeArea = kode.dest
    }
  })

  return {
    no_do: item['NOMOR DO'],
    tanggal_do: item['TANGGAL DO'],
    no_po: item['NOMOR PO'],
    kode_area: kodeArea,
    pengirim: item['PENGIRIM'],
    tujuan: item['TUJUAN PENGIRIMAN'],
    alamat: item['ALAMAT'],
    produk: item['NAMA PRODUK'],
    no_batch: item['NO BATCH'],
    expired_date: item['EXPIRED DATE'],
    jm_vial: item['JUMLAH VIAL'],
    jm_dosis: item['JUMLAH DOSIS'],
    jm_vial_terima: item['JUMLAH VIAL DITERIMA'],
    jm_dosis_terima: item['JUMLAH DOSIS DITERIMA'],
    status: item['STATUS'],
    tanggal_kirim: item['TANGGAL KIRIM'],
    tanggal_terima: item['TANGGAL TERIMA'],
    biofarma_type: type,
    service_type: item['JENIS LAYANAN'] || null,
    no_document: item['NO SURAT'] || null,
    released_date: item['TANGGAL RELEASE'] || null,
    notes: item['KETERANGAN'] || null,
    code_product_kemenkes: item['KODE PRODUK KEMENKES'] || null,
    entrance_type: item['ENTRANCETYPE'] || null,
    grant_country: item['GRANTCOUNTRY'] || null,
    manufacture_country: item['MANUFACTURCOUNTRY'] || null,
  }
}

// ============================================================================
// MATERIAL HANDLING FUNCTIONS
// ============================================================================

/**
 * Retrieves material pelarut data from database
 * @returns {Promise<Object>} Object mapping material codes to pieces per unit
 */
async function getMaterialPelarut(): Promise<object> {
  const result = await db
     .selectFrom('materials')
     .select(['code', 'pieces_per_unit'])
     .where('code', 'like', '%pelarut%')
     .execute()
  
  // Convert array result to object { code: pieces_per_unit }
  const resultObj = result.reduce((acc, item) => {
    acc[item.code] = item.pieces_per_unit
    return acc
  }, {})
  
  return resultObj
}

/**
 * Processes biofarma order data if it contains pelarut material
 * @param {Object} biofarmaOrder - The biofarma order data
 * @param {Object} materialPelaruts - Material pelarut mapping
 * @returns {Promise<Object>} Processed biofarma order data
 */
async function getDataIfMaterialPelarut(biofarmaOrder: any, materialPelaruts: any): Promise<object> {
  if (!biofarmaOrder.produk.toLowerCase().includes('pelarut')) return biofarmaOrder
  
  if (Object.keys(materialPelaruts).length === 0) {
    materialPelaruts = await getMaterialPelarut()
  }
  
  const piecesPerUnit = materialPelaruts[biofarmaOrder.produk]
  
  return {
    ...biofarmaOrder,
    jm_dosis: biofarmaOrder.jm_vial * piecesPerUnit
  }
}

// ============================================================================
// ORDER VALIDATION AND COMPARISON
// ============================================================================

/**
 * Compares SMILE order quantities with Biofarma data
 * @param {Object} orderSmile - The SMILE order to compare
 * @returns {boolean} True if quantities match
 */
function sameQtySMILE(orderSmile: any): boolean {
  logger.info({ do: STATE.lastOrder.delivery_number })
  let isValid = true
  
  STATE.lastOrder.order_items.forEach(biofarmaItem => {
    const smileItem = orderSmile.order_items.find(order_item => {
      return order_item.material 
        ? order_item.material.code === biofarmaItem.material_code 
        : order_item.master_material.code === biofarmaItem.material_code
    })
    
    if (!smileItem) {
      isValid = false
    } else {
      logger.info({ material_code: isValid })
      biofarmaItem.batches.forEach(biofarmaBatch => {
        const smileBatch = smileItem.order_stocks.find(order_stock => {
          return order_stock.stock.batch.code === biofarmaBatch.code
        })
        
        if (!smileBatch) {
          isValid = false
        }
        
        logger.info({ batch_code: isValid })
        
        if (smileBatch && smileBatch.allocated_qty !== biofarmaBatch.qty) {
          isValid = false
        }
        
        logger.info({ qty: isValid })
      })
    }
  })
  
  return isValid
}

// ============================================================================
// AUTHENTICATION AND API FUNCTIONS
// ============================================================================

/**
 * Retrieves authentication token from Biofarma API
 * @returns {Promise<string|Error>} Access token or error
 */
async function getBiofarmaToken(): Promise<string | Error> {
  try {
    const resLogin = await axios({
      method: 'POST',
      url: `${env.BIOFARMA_URL}/api/auth/login`,
    data: {
      username: env.BIOFARMA_USER,
      password: env.BIOFARMA_PASSWORD
      }
    })
    return resLogin.data.access_token
  } catch (error) {
    return Error(error)
  }
}

/**
 * Makes SMDV data request to Biofarma API
 * @param {Object} params - Request parameters
 * @returns {Promise<Object>} API response data
 */
async function requestDataSMDV({ type, headers, filter }: any): Promise<object> {
  let endpoint = ''
  if (type == 'provinsi') {
    endpoint = '/api/public/get-data-dashboard-provinsi'
  } else if (type == 'hub') {
    endpoint = '/api/public/get-data-dashboard-hub'
  }

  const biofarmaDataURL = `${env.BIOFARMA_URL}${endpoint}`

  let result = await axios({
    method: 'POST',
    url: biofarmaDataURL,
    headers: headers,
    data: filter
  })

  logger.info({
    url: biofarmaDataURL,
    perPage: filter?.show,
    start_date: filter.start_date,
    end_date: filter.end_date
  })

  return result
}

// ============================================================================
// ORDER CREATION AND MANAGEMENT
// ============================================================================

/**
 * Creates order in SMILE system
 * @param {Object} smileOrder - Order data for SMILE
 * @returns {Promise<void>}
 */
async function createOrderSMILE(smileOrder: any): Promise<void> {
  const is_duplicate = STATE.orderCreated.includes(smileOrder.delivery_number)
  
  if (is_duplicate) {
    logger.info('================== check duplicate ===============', { 
      is_duplicate, 
      do: smileOrder.delivery_number 
    })
  } else {
    const orderData = await db
       .selectFrom('ws_orders')
       .selectAll()
       .where('status', '!=', ORDER_STATUS.CANCELED)
       .where('delivery_number', '=', smileOrder.delivery_number)
       .orderBy('updated_at', 'desc')
       .executeTakeFirst()
    
    if (orderData) {
      logger.info('================== order exist ===============', { 
        do: smileOrder.delivery_number, 
        status: orderData.status 
      })
    } else {
      const headers = await getSmileHeader(env.BF_SMILE_USER, env.BF_SMILE_PASS)
      const url = smileOrder.isV2 
        ? `${env.SMILE_URL}/v2/order/dropping` 
        : `${env.SMILE_URL}/order/covid`
      
      await axios({
        url,
        method: 'POST',
        headers: headers,
        data: smileOrder,
      }).then(() => {
        STATE.orderCreated.push(smileOrder.delivery_number)
        logger.info(
          '================== Create Success===============', 
          { url, do: smileOrder.delivery_number, batches: smileOrder.order_items }
        )
      }).catch(err => {
        STATE.orderCreated.push(smileOrder.delivery_number)
        logger.info(
          '================== Create Error ===============', 
          { url, do: smileOrder.delivery_number, batches: smileOrder.order_items, error: err.response.data }
        )
      })
    }
  }
}

/**
 * Cancels order in SMILE system and creates new one
 * @param {Object} biofarmaOrder - Biofarma order data
 * @param {Object} smileOrder - SMILE order data
 * @returns {Promise<void>}
 */
async function cancelOrderSMILE(biofarmaOrder: any, smileOrder: any): Promise<void> {
  logger.info('================== cancel ===============', { 
    do: smileOrder.delivery_number, 
    batch: smileOrder.no_batch 
  })
  
  const headers = await getSmileHeader(env.ADMIN_USER, env.ADMIN_PASS)
  let smileV2 = false
  
  // Determine if this is a V2 order
  for (let order_item of smileOrder.order_items) {
    if (order_item.material) {
      smileV2 = false
    } else {
      smileV2 = true
    }
  }
  
  const url = smileV2 
    ? `${env.SMILE_URL}/v2/order/${smileOrder.id}/cancel`
        : `${env.SMILE_URL}/order/${smileOrder.id}/cancel`
    
  await axios({
    method: 'PUT',
    url,
    headers: headers,
    data: {
      cancel_reason: ORDER_CANCEL_REASON.OTHERS,
      other_reason: 'Data Biofarma berubah',
    }
  }).then(async () => {
    await createOrderSMILE(biofarmaOrder)
    logger.info(
      '================== Update Success===============', 
      { url, do: smileOrder.delivery_number, batches: smileOrder.order_items }
    )
  }).catch(err => {
    logger.info(
      '================== Update Error ===============', 
      { url, do: smileOrder.delivery_number, batches: smileOrder.order_items, error: err.response.data }
    )
  })
}

/**
 * Updates existing SMILE order
 * @param {Object} smileOrder - SMILE order data
 * @param {Object} biofarmaOrder - Biofarma order data
 * @returns {Promise<void>}
 */
async function updateOrderSmile(smileOrder: any, biofarmaOrder: any): Promise<void> {
  // Check status of order in SMILE
  if (smileOrder.status === ORDER_STATUS.FULFILLED) {
    smileOrder.biofarma_changed = true
    await smileOrder.save()
  } else {
    // Cancel existing order and create new one
    await cancelOrderSMILE(biofarmaOrder, smileOrder)
  }
}

/**
 * Creates or updates order based on existing data
 * @param {Object} lastOrder - Last order data
 * @returns {Promise<void>}
 */
async function createOrder(lastOrder: any): Promise<void> {
  const smileOrder = await db
     .selectFrom('ws_orders')
     .selectAll()
     .where('delivery_number', '=', lastOrder.delivery_number)
     .where('status', '!=', ORDER_STATUS.CANCELED)
     .orderBy('updated_at', 'asc')
     .executeTakeFirst()
  
  if (smileOrder) {
    if (!sameQtySMILE(smileOrder)) {
      await updateOrderSmile(smileOrder, lastOrder)
    }
  } else {
    await createOrderSMILE(lastOrder)
  }
}

// ============================================================================
// ORDER PREPARATION FUNCTIONS
// ============================================================================

/**
 * Prepares SMILE order data from Biofarma order (V1)
 * @param {Object} biofarmaOrder - Biofarma order data
 * @param {Object} materialPelaruts - Material pelarut mapping
 * @returns {Promise<void>}
 */
async function prepareOrderSmile(biofarmaOrder: any = {}, materialPelaruts: any = {}): Promise<void> {
  biofarmaOrder = await getDataIfMaterialPelarut(biofarmaOrder, materialPelaruts)
  
  if (STATE.lastNoDO === biofarmaOrder.no_do) {
    // Check if material already exists in current order
    const orderItemIdx = STATE.lastOrder.order_items.findIndex(item => {
      return item.material_code === biofarmaOrder.produk
    })
    
    if (orderItemIdx >= 0) {
      // Find if batch code already exists
      const existBatch = STATE.lastOrder.order_items[orderItemIdx].batches.find(batch => {
        return batch.code === biofarmaOrder.no_batch
      })
      
      if (!existBatch) {
        // Add new batch to existing material
        STATE.lastOrder.order_items[orderItemIdx].batches.push(formatBatch(biofarmaOrder))
      }
    } else {
      // Add new material with batch
      STATE.lastOrder.order_items.push({
        material_code: biofarmaOrder.produk,
        batches: [formatBatch(biofarmaOrder)]
      })
    }
  } else {
    // Process previous order if exists
    if (STATE.lastNoDO !== null && STATE.lastOrder && STATE.lastOrder.customer_code) {
      await createOrder(STATE.lastOrder)
    }
    
    // Create new order entry
    STATE.lastOrder = {
      vendor_code: '00',
      customer_code: biofarmaOrder.kode_area ? biofarmaOrder.kode_area.toString() : '',
      sales_ref: '',
      delivery_number: biofarmaOrder.no_do,
      service_type: biofarmaOrder.service_type,
      no_document: biofarmaOrder.no_document,
      released_date: biofarmaOrder.released_date,
      notes: biofarmaOrder.notes,
      order_items: [{
        material_code: biofarmaOrder.produk,
        batches: [formatBatch(biofarmaOrder)]
      }],
    }
  }
  
  if (isLastData()) {
    // Create the final order
    await createOrder(STATE.lastOrder)
  }
}

/**
 * Prepares SMILE order data from Biofarma order (V2)
 * @param {Object} biofarmaOrder - Biofarma order data
 * @param {Object} materialPelaruts - Material pelarut mapping
 * @returns {Promise<void>}
 */
async function prepareOrderSmileV2(biofarmaOrder: any = {}, materialPelaruts: any = {}): Promise<void> {
  // Determine activity ID based on material activities
  const getActivitySix = await db
     .selectFrom('ws_material_activities as mmha')
     .leftJoin('ws_materials as mm', 'mm.id', 'mmha.material_id')
     .select('mm.code')
     .where('mmha.activity_id', '=', 6)
     .where('mm.is_vaccine', 'in', [0, 1])
     .where('mm.code', '=', biofarmaOrder.produk)
     .execute()
  
  const getActivityThree = await db
     .selectFrom('ws_material_activities')
     .select(['material_id', sql<number>`COUNT(*)`.as('jumlah')])
     .where('material_id', 'in', (eb) =>
       eb.selectFrom('ws_material_activities as mmha')
         .leftJoin('ws_materials as mm', 'mm.id', 'mmha.material_id')
         .select('mm.id')
         .where('mmha.activity_id', '=', 3)
         .where('mm.is_vaccine', 'in', [0, 1])
         .where('mm.code', '=', biofarmaOrder.produk)
         .groupBy('mm.id')
     )
     .groupBy('material_id')
     .execute()
  
  biofarmaOrder = await getDataIfMaterialPelarut(biofarmaOrder, materialPelaruts)

  // Set activity ID based on query results
  if (getActivitySix.length > 0) {
    STATE.ACTIVITY_BIOFARMA = 6
  } else if (getActivityThree[0]?.jumlah === 1) {
    STATE.ACTIVITY_BIOFARMA = 3
  } else {
    STATE.ACTIVITY_BIOFARMA = 1
  }

  if (STATE.lastNoDO === biofarmaOrder.no_do) {
    // Check if material already exists in current order
    const orderItemIdx = STATE.lastOrder.order_items.findIndex(item => {
      return item.material_code === biofarmaOrder.produk
    })
    
    if (orderItemIdx >= 0) {
      // Find if batch code already exists
      const existBatch = STATE.lastOrder.order_items[orderItemIdx].batches.find(batch => {
        return batch.code === biofarmaOrder.no_batch
      })
      
      if (!existBatch) {
        // Add new batch to existing material
        STATE.lastOrder.order_items[orderItemIdx].batches.push(formatBatchV2(biofarmaOrder))
      }
    } else {
      // Add new material with batch
      STATE.lastOrder.order_items.push({
        material_code: biofarmaOrder.produk,
        batches: [formatBatchV2(biofarmaOrder)]
      })
    }
  } else {
    // Process previous order if exists
    if (STATE.lastNoDO !== null && STATE.lastOrder && STATE.lastOrder.customer_code) {
      await createOrder(STATE.lastOrder)
    }
    
    // Create new order entry
    STATE.lastOrder = {
      vendor_code: '00',
      customer_code: biofarmaOrder.kode_area ? biofarmaOrder.kode_area.toString() : '',
      sales_ref: '',
      delivery_number: biofarmaOrder.no_do,
      service_type: biofarmaOrder.service_type,
      no_document: biofarmaOrder.no_document,
      released_date: biofarmaOrder.released_date,
      notes: biofarmaOrder.notes,
      order_items: [{
        material_code: biofarmaOrder.produk,
        batches: [formatBatchV2(biofarmaOrder)]
      }],
      activity_id: STATE.ACTIVITY_BIOFARMA,
      isV2: biofarmaOrder.isV2,
    }
  }
  
  if (isLastData()) {
    // Create the final order
    await createOrder(STATE.lastOrder)
  }
}

// ============================================================================
// ORDER PROCESSING FUNCTIONS
// ============================================================================

/**
 * Processes Biofarma orders and synchronizes with SMILE
 * @param {Object} params - Processing parameters
 * @returns {Promise<void>}
 */
async function processBiofarmaOrder({ type, orders = [], isV2 }: any): Promise<void> {
  // Filter orders with valid delivery numbers
  orders = orders.filter(item => {
    if (item['NOMOR DO'] !== null) {
      return item
    } else {
      STATE.lastData++
    }
  })
  
  // Filter out excluded product names
  orders = orders.filter(item => {
    if (!BUSINESS_CONSTANTS.excludeName.includes(item['NAMA PRODUK'])) {
      return item
    } else {
      STATE.lastData++
    }
  })

  const nomor_do = _.keys(_.groupBy(orders, 'NOMOR DO'))

  // Get existing SMILE orders
  const dataSmileOrders = await db
     .selectFrom('ws_orders')
     .selectAll()
     .where('delivery_number', 'in', nomor_do)
     .where('status', '!=', ORDER_STATUS.CANCELED)
     .orderBy('updated_at', 'asc')
     .execute()

  // Create lookup object for faster access
  const dataSmileOrderObj = dataSmileOrders.reduce((acc, item) => {
    acc[item.delivery_number] = item
    return acc
  }, {})

  let biofarmaOrders = []
  const materialPelaruts = await getMaterialPelarut()
  
  // Process each order
  for (let order of orders) {
    const formattedData = mapBiofarmaToSmile(type, order)
    const selectedOrder = dataSmileOrderObj[formattedData.no_do]

    if (selectedOrder) {
      formattedData.exist_smile = selectedOrder.id
    } else {
      formattedData.exist_smile = null
    }

    biofarmaOrders.push(formattedData)
    formattedData.isV2 = isV2
    
    if (isV2) {
      await prepareOrderSmileV2(formattedData, materialPelaruts)
    } else {
      await prepareOrderSmile(formattedData, materialPelaruts)
    }

    // Update processing state
    STATE.lastData++
    STATE.lastNoDO = formattedData.no_do
  }

  console.log('Data biofarma order ', biofarmaOrders.length)

  // Save to database
  try {
    await db
      .insertInto('integration_biofarma_orders')
      .values(biofarmaOrders)
      .onDuplicateKeyUpdate({
        updated_at: sql`CURRENT_TIMESTAMP`
      })
      .execute()
  } catch (err) {
    console.error(err)
  }
}

// ============================================================================
// MAIN EXPORT FUNCTIONS
// ============================================================================

/**
 * Creates Biofarma orders from external API
 * @param {Object} params - Creation parameters
 * @returns {Promise<void>}
 */
export async function createBiofarmaOrders({ type, monthly = false, filterDate, isV2 = false }: any): Promise<void> {
  STATE.lastNoDO = null
  let endpoint = ''
  
  if (type === 'provinsi') {
    endpoint = '/api/public/get-transaksi-provinsi'
  } else if (type === 'hub') {
    endpoint = '/api/public/get-transaksi-hub'
  }
  
  const biofarmaDataURL = `${env.BIOFARMA_URL}${endpoint}`
  const token = await getBiofarmaToken()
  const headers = { Authorization: `Bearer ${token}` }

  const perPage = 1
  let filter = {
    search: '',
    start_date: `${env.BIOFARMA_STARTDATE}`,
    show: perPage,
  }
  
  if (monthly) {
    filter.start_date = moment().subtract(60, 'days').format('YYYY-MM-DD')
  }
  
  if (filterDate) {
    filter.start_date = filterDate.start_date || ''
    filter.end_date = filterDate.end_date || ''
  }
  
  const { data: firstData } = await axios({
    method: 'POST',
    url: biofarmaDataURL,
    headers: headers,
    data: filter
  })

  logger.info({
    type: type,
    perPage: filter?.show,
    start_date: filter?.start_date,
    end_date: filter?.end_date,
    lastData: STATE.lastData,
    tanggal_do: firstData.data.length > 0 ? firstData.data[0]['TANGGAL DO'] : '-'
  })
  
  STATE.totalData = firstData.total
  console.log('totalData', STATE.totalData)

  if (STATE.totalData > 0) {
    filter = {
      ...filter,
      show: STATE.totalData
    }
    
    const { data: respBiofarma } = await axios({
      method: 'POST',
      url: biofarmaDataURL,
      headers: headers,
      data: filter
    })
    
    let { data: dataDO } = respBiofarma
    await processBiofarmaOrder({
      type,
      orders: dataDO.length > 0 ? dataDO : [],
      isV2
    })
  }
}

/**
 * Creates Biofarma SMDV orders
 * @param {Object} params - Creation parameters
 * @returns {Promise<Object>} Result object with status messages
 */
export async function createBiofarmaSMDVOrders({ start_date = null, end_date = null }: any): Promise<object> {
  const resultProvinsi = await getBiofarmaSMDV({ type: 'provinsi', start_date, end_date })
  const resultHub = await getBiofarmaSMDV({ type: 'hub', start_date, end_date })

  return {
    result_provinsi: resultProvinsi ? resultProvinsi.message : 'Failed to insert data',
    result_hub: resultHub ? resultHub.message : 'Failed to insert data'
  }
}

/**
 * Gets Biofarma SMDV data and saves to database
 * @param {Object} params - Request parameters
 * @returns {Promise<Object|null>} Result object or null
 */
export async function getBiofarmaSMDV({ type = 'provinsi', start_date = null, end_date = null }: any): Promise<object | null> {
  const token = await getBiofarmaToken()
  const headers = { Authorization: `Bearer ${token}` }

  let dt = new Date()
  let prevDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - 1)
  
  if (!start_date) start_date = moment(prevDate).format('YYYY-MM-DD')
  if (!end_date) end_date = start_date

  const perPage = 100000
  let filter = {
    search: '',
    start_date,
    end_date,
    show: perPage,
  }

  let { data: dataBiofarma } = await requestDataSMDV({ type, headers, filter })
  let totalDataSMDV = dataBiofarma.total

  if (totalDataSMDV > 0) {
    if (totalDataSMDV > dataBiofarma.data.length) {
      filter.show = totalDataSMDV
      dataBiofarma = (await requestDataSMDV({ type, headers, filter })).data
      totalDataSMDV = dataBiofarma.total
    }

    try {
      let { data } = dataBiofarma
      data = data.map(item => {
        var biofarma_id = item.no
        delete item.no
        return {
          biofarma_id,
          ...item
        }
      })
      
      await db
        .insertInto('integration_biofarma_smdv_orders')
        .values(data)
        .onDuplicateKeyUpdate({
          updated_at: sql`CURRENT_TIMESTAMP`
        })
        .execute()

      return {
        message: data.length + ' data inserted'
      }
    } catch (err) {
      return null
    }
  } else {
    return { message: 'Data is empty' }
  }
}

/**
 * Main function to check and process Biofarma orders
 * @param {Object} params - Check parameters
 * @returns {Promise<void>}
 */
export async function checkBiofarmaOrder({ filterDate = null, monthly = false, isV2 = false }: any): Promise<void> {
  STATE.lastData = 1
  await createBiofarmaOrders({ type: 'provinsi', monthly, filterDate, isV2 })
  
  STATE.lastData = 1
  await createBiofarmaOrders({ type: 'hub', monthly, filterDate, isV2 })

  console.log('biofarma_order_finished')
  process.exit(0)
}

/**
 * Checks and processes Biofarma order deletions
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Result object with deletion status
 */
export async function checkDeleteBiofarma(req: any): Promise<object> {
  const result = {}
  await db.deleteFrom('delete_biofarma').execute()
  
  await Promise.all([
    deleteBiofarmaOrder('provinsi', req)
      .then(res => result['provinsi'] = res),
    deleteBiofarmaOrder('hub', req)
      .then(res => result['hub'] = res)
  ])
  
  return result
}

/**
 * Deletes Biofarma orders of specified type
 * @param {string} type - Order type (provinsi/hub)
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteBiofarmaOrder(type: string = 'provinsi', req: any): Promise<object> {
  try {
    const dataBiofarma = await db
      .selectFrom('dummy_biofarma')
      .selectAll()
      .where('type', '=', type)
      .execute()

    const noDos = dataBiofarma.map(item => item?.no_do)
    
    console.time(`get data biofarma order ${type}`)
    const dataOrder = await db
      .selectFrom('integration_biofarma_orders')
      .select(['id', 'no_do'])
      .where('no_do', 'in', noDos)
      .orderBy('tanggal_do', 'asc')
      .execute()
    console.timeEnd(`get data biofarma order ${type}`)
    
    const notFound = []
    const found = []
    
    dataBiofarma.forEach(item => {
      const find = dataOrder.find(iitem => iitem.no_do === item?.no_do)
      if (!find) {
        notFound.push(item)
      } else if (find) {
        found.push(item['no_do'])
      }
    })
    
    await db
      .insertInto('delete_biofarma')
      .values(notFound)
      .onDuplicateKeyIgnore()
      .execute()
    
    return {
      notFound: notFound.length,
      found: found.length
    }
  } catch (err) {
    console.error(err)
  }
}

// ============================================================================
// HTTP ENDPOINT HANDLERS
// ============================================================================

/**
 * HTTP handler for running Biofarma order deletion
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 * @returns {Promise<Object>} HTTP response
 */
export async function runDeleteBiofarma(req: any, res: any, next: any): Promise<object> {
  try {
    const data = await checkDeleteBiofarma(req)
    return res.status(200).json({ message: 'success', data })
  } catch (err) {
    next(err)
  }
}

/**
 * Get dummy data for testing
 */
export async function getDataDummy(type: string = 'provinsi'): Promise<object> {
  const result = await db
    .selectFrom('dummy_biofarma')
    .selectAll()
    .where('type', '=', type)
    .execute()
  
  return {
    message: 'success',
    data: result
  }
}

/**
 * HTTP handler for getting dummy data
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 * @returns {Promise<void>}
 */
export async function getDataDummyHandler(req: any, res: any, next: any): Promise<void> {
  try {
    const { type = 'provinsi' } = req.query
    const data = await getDataDummy(type)
    return res.status(200).json(data)
  } catch (err) {
    console.error(err)
    next(err)
  }
}

/**
 * Get delete data
 */
export async function getDataDelete(): Promise<object> {
  const result = await db
    .selectFrom('delete_biofarma')
    .selectAll()
    .execute()
  
  return {
    message: 'success',
    data: result
  }
}

/**
 * HTTP handler for getting deletion data
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 * @returns {Promise<void>}
 */
export async function getDataDeleteHandler(req: any, res: any, next: any): Promise<void> {
  try {
    const data = await getDataDelete()
    return res.status(200).json(data)
  } catch (err) {
    next(err)
  }
}