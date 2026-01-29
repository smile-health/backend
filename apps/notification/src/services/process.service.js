const fcmService = require('./fcm.service')
const { createLogger } = require('./log.service')
const whatsappService = require('./whatsapp.service')
const queueWorker = require('../constant')
const { Notification } = require('../db/index')

exports.process = async ({
  user,
  user_entity_tag_id,
  message,
  title,
  type,
  action_url,
  download_url,
  event_code,
  variables,
  template,
  worker,
  workerMedia,
  program_id,
  messageTranslation,
  titleTranslation,
  data,
}) => {
  try {
    const notification = {
      user_id: user.id,
      user_entity_tag_id,
      message,
      title,
      media: workerMedia,
      type,
      action_url,
      download_url,
      event_code,
      program_id,
      data,
      ...user,
    }
    delete notification.id

    // save to table notification
    await Notification.create(notification)

    // call service firebase
    console.log('worker', worker)
    console.log('queueWorker.FIREBASE', queueWorker.FIREBASE)
    console.log('user.fcm_token', user.fcm_token)
    if (worker === queueWorker.FIREBASE && user.fcm_token) {
      console.log(`======= Send FCM Notif for user ${user.user_id}`)
      console.log(`====== sendFCM Payload`, {
        fcmToken: user.fcm_token,
        title: titleTranslation,
        message: messageTranslation,
      })
      const { url, body, response } = await fcmService.sendFCM({
        fcmToken: user.fcm_token,
        title: titleTranslation,
        message: messageTranslation,
      })
      createLogger(setDataLogger(worker, url, body, response))
    }

    // WhatsApp call service with day and user_entity_tag_id conditions
    if (worker === queueWorker.WHATSAPP && user.mobile_phone) {
      const isProduction = process.env.NODE_ENV === 'production'
      const productionStartDate = process.env.WHATSAPP_PRODUCTION_START_DATE

      // If it is production and there is a production start date in .env, check the date
      if (isProduction && productionStartDate) {
        const productionStart = new Date(productionStartDate)
        const currentDate = new Date()

        // Date validation
        if (isNaN(productionStart.getTime())) {
          console.log(
            `======= Skip Whatsapp Notif for user ${user.user_id} - Invalid production start date`
          )
          console.log(
            '======= Reason: WHATSAPP_PRODUCTION_START_DATE format invalid in .env'
          )
          return
        }

        // If you haven't reached the production start date, skip WhatsApp
        if (currentDate < productionStart) {
          console.log(
            `======= Skip Whatsapp Notif for user ${user.user_id} - Production date restriction`
          )
          console.log(
            '======= Reason: NODE_ENV=production but current date is before production start date'
          )
          console.log('======= Details:', {
            nodeEnv: process.env.NODE_ENV,
            currentDate: currentDate.toISOString().split('T')[0],
            productionStartDate: productionStart.toISOString().split('T')[0],
          })
          return
        }
      }

      // Check if day and user_entity_tag_id are set in .env
      const allowedDays = process.env.WHATSAPP_ALLOWED_DAYS
        ? process.env.WHATSAPP_ALLOWED_DAYS.split(',').map((day) =>
            day.trim().toLowerCase()
          )
        : []

      const allowedUserEntityTagIds = process.env
        .WHATSAPP_ALLOWED_USER_ENTITY_TAG_IDS
        ? process.env.WHATSAPP_ALLOWED_USER_ENTITY_TAG_IDS.split(',').map(
            (id) => id.trim()
          )
        : []

      // If there is no day OR no user_entity_tag_id in .env, skip WhatsApp
      if (allowedDays.length === 0 || allowedUserEntityTagIds.length === 0) {
        console.log(
          `======= Skip Whatsapp Notif for user ${user.user_id} - WhatsApp disabled in env`
        )
        console.log(
          '======= Reason: Missing WHATSAPP_ALLOWED_DAYS or WHATSAPP_ALLOWED_USER_ENTITY_TAG_IDS in .env'
        )
        return // Langsung return, tidak kirim WhatsApp sama sekali
      }

      // Get current day name in lowercase (e.g., "monday", "tuesday")
      const currentDay = new Date()
        .toLocaleString('en-US', { weekday: 'long' })
        .toLowerCase()

      // Check if user has an allowed user_entity_tag_id
      const hasAllowedUserEntityTag =
        user_entity_tag_id &&
        allowedUserEntityTagIds.includes(user_entity_tag_id.toString())

      // Check if today is a permitted day
      const isAllowedDay = allowedDays.includes(currentDay)

      if (isAllowedDay && hasAllowedUserEntityTag) {
        console.log(`======= Send Whatsapp Notif for user ${user.user_id}`)
        console.log('=============================== Ready for send Whatsapp', {
          phoneNumber: user.mobile_phone,
          template,
          variables,
        })
        const { url, body, response } = await whatsappService.sendWhatsapp({
          phoneNumber: user.mobile_phone,
          template,
          variables,
        })
        createLogger(setDataLogger(worker, url, body, response))
      } else {
        console.log(
          `======= Skip Whatsapp Notif for user ${user.user_id} - Conditions not met`
        )
        console.log('======= Skip Details:', {
          currentDay,
          userEntityTagId: user_entity_tag_id,
          allowedDays,
          allowedUserEntityTagIds,
          isAllowedDay,
          hasAllowedUserEntityTag,
        })
      }
    }
  } catch (err) {
    console.log(err)
  }
}

exports.getNotificationById = async (id) => {
  return await Notification.findByPk(id)
}

exports.updateNotificationDataById = async (id, data) => {
  return await Notification.update({ data }, { where: { id } })
}

function setDataLogger(worker, url, body, response) {
  const data = {
    worker_name: worker,
    url: url,
    request_body: JSON.stringify(body || {}),
    response_body: JSON.stringify(response?.data || {}),
    response_status_code: response?.status || null,
    response_status_text: response?.statusText || null,
    method: response?.request?.method || null,
  }
  console.log('====== Logger data', data)
  return data
}
