const amqp = require('amqplib/callback_api')
const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'
const queueWorker = require('./constant')
const processService = require('./services/process.service')
const worker = queueWorker.STOP_NOTIF

const stopNotifications = () => {
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
        ' [*] Running Stop Notification. To exit press CTRL+C',
        worker
      )

      channel.consume(
        worker,
        async function (msg) {
          if (msg) {
            const notificationJson = JSON.parse(msg.content)
            if (!notificationJson) {
              console.log('Invalid Notification Data')
              return
            }
            const objectData = await processService.getNotificationById(
              Number(notificationJson?.notification_id)
            )
            if (!objectData) {
              console.log('Notification Not Found')
              return
            }

            const getDataColumn = objectData?.dataValues?.data
            if (!getDataColumn) {
              console.log('Data Column is Empty')
              return
            }

            const parsedDataColumn = JSON.parse(getDataColumn)
            const bufferFromData = Buffer.from(parsedDataColumn?.toString())
            const isBuffer = Buffer.isBuffer(bufferFromData)
            if (!isBuffer) {
              console.log('Data Column is Not a Buffer')
              return
            }

            const cookedObject = JSON.parse(bufferFromData.toString())

            const updatedObjectData = {
              ...cookedObject,
              stop_notification: 1,
            }
            const stringifiedData = JSON.stringify(updatedObjectData)
            await processService.updateNotificationDataById(
              notificationJson?.notification_id,
              stringifiedData
            )
          }
        },
        { noAck: false }
      )
    })
  })
}

module.exports = {
  stopNotifications,
}
