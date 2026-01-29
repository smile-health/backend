const amqp = require('amqplib/callback_api')
const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'
const queueWorker = require('./constant')
const processService = require('./services/process.service')
const worker = queueWorker.FIREBASE

const consumeFirebase = () => {
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
          if (msg) {
            console.log(' [x] Received %s', msg.content.toString())
            const data = JSON.parse(msg.content.toString())
            await processService.process(data)
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

module.exports = {
  consumeFirebase,
}
