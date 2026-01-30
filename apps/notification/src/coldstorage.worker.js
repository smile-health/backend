const amqp = require('amqplib/callback_api')
const httpService = require('./services/http.service')

const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'

const worker = 'coldstorage-worker'

// Consumer
const consumeColdStorage = () => {
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
            // get covid data & create
            const { url, headers, method, data, callback } = JSON.parse(
              msg.content.toString()
            )
            console.log(' [x] Received %s', url)
            // handle the HTTP request
            httpService.handleHttpRequest(
              channel,
              msg,
              url,
              method,
              headers,
              data,
              callback
            )
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
  consumeColdStorage,
}
