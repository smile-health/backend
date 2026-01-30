const axios = require('axios')
const { Op } = require('sequelize')
const { checkSaranaBPOM } = require('./bpom-api.worker')
const { HttpLog } = require('./db/index')

async function retryTransaction(payload) {
  const retryStatus = []
  const { entity, transactions } = payload
  try {
    const entityKode = await checkSaranaBPOM(entity, false)

    for (let i = 0; i < transactions.length; i++) {
      let transaction = transactions[i]
      let data = transaction.data
      data.pelapor = entityKode

      const transStatus = await retryHttp({
        url: transaction.url,
        method: transaction.method,
        headers: transaction.headers,
        data: data,
      })
      retryStatus.push(transStatus)
    }
    return retryStatus
  } catch (errTrans) {
    retryStatus.push(errTrans.message)
    return retryStatus
  }
}

async function retryOrder(payload) {
  const retryStatus = []
  const { type, vendor, customer, orders } = payload
  try {
    const vendorKode = await checkSaranaBPOM(vendor, false)
    const customerKode = await checkSaranaBPOM(customer, false)

    for (let i = 0; i < orders.length; i++) {
      let order = orders[i]
      let data = order.data
      if (type === 'receive') {
        data.sumber = vendorKode
        data.pelapor = customerKode
      } else if (type === 'distribution') {
        data.tujuan = customerKode
        data.pelapor = vendorKode
      }

      const orderStatus = await retryHttp({
        url: order.url,
        method: order.method,
        headers: order.headers,
        data: data,
      })
      retryStatus.push(orderStatus)
    }
    return retryStatus
  } catch (errOrder) {
    retryStatus.push(errOrder.message)
    return retryStatus
  }
}

async function retryBPOM() {
  const bpomErrors = await HttpLog.findAll({
    where: [
      { worker_name: { [Op.in]: ['trans_bpom', 'order_bpom'] } },
      { res_status: { [Op.not]: '200' } },
      { retry_status: null },
    ],
  })

  for (let row of bpomErrors) {
    let { payload, worker_name } = row
    payload = JSON.parse(payload)
    let retryStatus = []
    switch (worker_name) {
      case 'trans_bpom':
        retryStatus = await retryTransaction(payload)
        break
      case 'order_bpom':
        retryStatus = await retryOrder(payload)
        break
      default:
        break
    }
    row.retry_status = JSON.stringify(retryStatus)
    await row.save()
  }
}

async function retryHttp(payload) {
  const response = await axios(payload)
  return response.status
}

module.exports = {
  retryBPOM,
}
