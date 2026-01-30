const amqp = require('amqplib/callback_api')

const SmsService = require('./services/sms.service')
const { testPayload } = require('./services/test.service')
const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'

const worker = 'sms-notification'

const consumeSms = () => {
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

      console.log(
        ' [*] Waiting for messages in %s. To exit press CTRL+C',
        worker
      )
      channel.prefetch(1)
      channel.consume(
        worker,
        function (msg) {
          console.log(' [x] Received %s', msg.content.toString())
          if (msg != null) {
            const { mobile, message } = JSON.parse(msg.content.toString())
            // get covid data & create
            SmsService.sendSms(mobile, message)
              .then(() => {
                console.log('success')
                channel.ack(msg)
              })
              .catch(() => {
                channel.ack(msg)
              })
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
  mobile: '081288027804',
  message: 'Test message sms',
}
const testSms = () => {
  const { mobile, message } = testingPayload
  SmsService.sendSms(mobile, message).then(() => {
    console.log('success')
  })
}

const testSMSWorker = () => {
  testPayload(worker, testingPayload)
}
module.exports = {
  consumeSms,
  testSms,
  testSMSWorker,
}
