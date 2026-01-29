const amqp = require('amqplib/callback_api')
const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'

exports.testPayload = function (queue, payload) {
  amqp.connect(amqServer, { frameMax: 1048576 }, function (error0, connection) {
    if (error0) {
      throw error0
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1
      }

      channel.assertQueue(queue, {
        durable: true,
      })

      channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)))
      console.log(' [x] Sent %s', payload)
    })

    setTimeout(function () {
      connection.close()
      // process.exit(0)
    }, 500)
  })
}
