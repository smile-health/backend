const amqp = require('amqplib/callback_api')
const httpService = require('./services/http.service')

const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'

const worker = 'http-worker'
const { testPayload } = require('./services/test.service')

// Consumer
const consumeHttp = () => {
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

const testingPayload = {
  url: 'https://vtsapi.easygo-gps.co.id/api/report/lastposition',
  // url: '',
  method: 'POST',
  headers: {
    Token: '2BB8C4600B244079B9DFCC2FA37CB168',
  },
  data: {
    list_nopol: ['DINKES KOTA BANDA ACEH'],
  },
  callback: {
    url: `http://localhost:8080/order/10/updateEasyGO`,
    method: 'POST',
    headers: { Authorization: 'Bearer ' },
    fromResponse: {
      fromField: 'no_do',
      toField: 'no_do',
    },
  },
}
// Publisher
const testHttpWorker = () => {
  testPayload(worker, testingPayload)
}

const testHttp = function () {
  const { url, headers, method, data, callback } = testingPayload
  console.log('testing send http')
  httpService.sendHttp(url, method, headers, data).then((res) => {
    if (callback) {
      let callbackData = {}
      if (callback.fromResponse) {
        callbackData[callback.fromResponse.toField] =
          res.data[callback.fromResponse.fromField]
      } else {
        callbackData = callback.data || {}
      }
      httpService
        .sendHttp(callback.url, callback.method, callback.headers, callbackData)
        .then(() => {
          console.log('success send http')
        })
    }
  })
}

module.exports = {
  consumeHttp,
  testHttpWorker,
  testHttp,
}
