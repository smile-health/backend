const amqp = require('amqplib/callback_api')

const { Notification } = require('./db/index')
const fcmService = require('./services/fcm.service')
const smsService = require('./services/sms.service')
const EmailService = require('./services/smtp.service')

const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'

const worker = 'multi-notification'
const { testPayload } = require('./services/test.service')
const whatsappService = require('./services/whatsapp.service')

// payload
// media: [ 'sms', 'email', 'fcm' ]
// user: { mobile_phone: , email: , fcm_token, province_id, regency_id, entity_id, entity_type }
// message: 'text'

async function processNotif({
  media,
  user,
  message,
  title,
  type,
  action_url,
  download_url,
  template,
  variables,
}) {
  try {
    // await
    const notif = {
      user_id: user.id,
      message,
      title,
      media: JSON.stringify(media),
      type,
      action_url,
      download_url,
      ...user,
    }
    delete notif.id
    await Notification.create(notif)

    for (let med of media) {
      if (med === 'sms' && user.mobile_phone) {
        // send sms
        await smsService.sendSms(user.mobile_phone, message)
      } else if (med === 'whatsapp' && user.mobile_phone) {
        // send whatsapp
        await whatsappService.sendWhatsapp({
          phoneNumber: user.mobile_phone,
          template,
          variables,
        })
      } else if (med === 'email' && user.email) {
        // send email
        await EmailService.sendMail(user.email, title, message)
      } else if (med === 'fcm' && user.fcm_token) {
        // send fcm
        console.log(
          `======= Send FCM Notif for user ${user.id} from multinotif`
        )
        await fcmService.sendFCM({ fcmToken: user.fcm_token, title, message })
      }
    }
  } catch (err) {
    console.log(err)
  }
}

// Consumer
const consumeNotification = () => {
  amqp.connect(amqServer, { frameMax: 1048576 }, function (error0, connection) {
    if (error0) {
      throw error0
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1
      }
      channel.assertQueue(worker, {
        durable: true,
      })
      channel.prefetch(1)
      console.log(
        ' [*] Waiting for messages in %s. To exit press CTRL+C',
        worker
      )

      channel.consume(
        worker,
        async function (msg) {
          if (msg != null) {
            console.log(' [x] Received %s', msg.content.toString())
            // get covid data & create
            const messageData = JSON.parse(msg.content.toString())
            // save to database
            // await saveToDB({ media, user, message, title })
            await processNotif(messageData)
            channel.ack(msg)
          }
        },
        {
          noAck: false,
        }
      )
    })
  })
}

const testingPayload = {
  media: [
    // 'sms',
    'fcm',
    // 'email'
  ],
  user: {
    id: 29,
    email: 'eko1@badr-interactive.com',
    mobile_phone: '085155100904',
    fcm_token: 'AABB',
    province_id: 32,
    regency_id: null,
    entity_id: 3,
  },
  message:
    'SMILE-ID ADS 0.5 ml COVID19 (buah) Batch 14HARIPROVB akan kadaluwarsa dalam 15 hari (09-10-2021) di DINKES KOTA BOGOR 400, PUSKESMAS BOGOR SELATAN 100, lebih lengkap cek di rebrand.ly/d57rsn5',
  title: 'Expired Batch',
  type: 'ed-30',
  action_url: 'rebrand.ly/d57rsn5',
}
// Publisher
const testMultiNotifWorker = () => {
  testPayload(worker, testingPayload)
}

const testMultiNotif = function () {
  console.log('testing send multnotif')
  processNotif(testingPayload)
}

module.exports = {
  consumeNotification,
  testMultiNotifWorker,
  testMultiNotif,
}
