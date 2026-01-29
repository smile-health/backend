const queueWorker = require('../constant')
const { CovidLog, HttpLog, FcmLog, WhatsappLog } = require('../db/index')

// const CovidLog = require("../db/models").CovidLog
exports.createCovidLogger = async (body) => {
  try {
    // models
    if (typeof body.res_body !== 'string')
      body.res_body = JSON.stringify(body.res_body)
    if (typeof body.payload !== 'string')
      body.payload = JSON.stringify(body.payload)

    await CovidLog.create(body)
    return true
  } catch (error) {
    console.error(error)
    return error
  }
}

exports.createHttpLogger = async (body) => {
  try {
    // models
    if (typeof body.res_body !== 'string')
      body.res_body = JSON.stringify(body.res_body)
    if (typeof body.payload !== 'string')
      body.payload = JSON.stringify(body.payload)

    await HttpLog.create(body)
    return true
  } catch (error) {
    console.error(error)
    return error
  }
}

exports.createLogger = async (data) => {
  try {
    if (data.worker_name === queueWorker.FIREBASE) {
      console.log(data)
      await FcmLog.create(data)
    }
    if (data.worker_name === queueWorker.WHATSAPP) {
      await WhatsappLog.create(data)
    }
    return true
  } catch (error) {
    console.error(error)
    return error
  }
}
