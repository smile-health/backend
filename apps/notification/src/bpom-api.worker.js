const amqp = require('amqplib/callback_api')
const axios = require('axios')

const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'
const postSaranaWorker = 'bpom-api-sarana'
const orderBPOM = 'order-bpom-worker'
const transactionBPOM = 'transaction-bpom-worker'

const smileUrl = process.env.SMILE_URL

const { createHttpLogger } = require('./services/log.service')
const { testPayload } = require('./services/test.service')

const updateSaranaBPOM = () => {
  amqp.connect(amqServer, { frameMax: 1048576 }, function (error0, connection) {
    if (error0) {
      throw error0
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1
      }
      channel.assertQueue(postSaranaWorker, {
        durable: true,
      })
      channel.prefetch(1)
      console.log(
        ' [*] Waiting for messages in %s. To exit press CTRL+C',
        postSaranaWorker
      )

      channel.consume(
        postSaranaWorker,
        function (msg) {
          if (msg !== null) {
            console.log(' [x] Received %s', msg.content.toString())
            // get covid data & create
            console.log(' new worker detected at ' + postSaranaWorker)
            setTimeout(function () {
              processPayload(JSON.parse(msg.content.toString())).then(() => {
                // channel.ack(msg)
              })
              channel.ack(msg)
            }, 1000)
            // processPayload(JSON.parse(msg.content.toString())).then(() => {
            //   channel.ack(msg)
            // })
          }
        },
        {
          noAck: false,
        }
      )
    })
  })
}

function processPayload(payload) {
  return new Promise(function (resolve) {
    const { url, data, headers, smile_token, entity_id } = payload
    let updateLog = {
      worker_name: postSaranaWorker,
      payload: data,
      entity_id: entity_id,
      url: url,
    }
    let smileHeader = { Authorization: 'Bearer ' + smile_token }

    axios({
      headers: headers,
      method: 'POST',
      url: url,
      data: data,
    })
      .then(function (response) {
        // update flag kpcpen in order
        // token
        if (response.data.result === 'Ok') {
          let bpom_key = response.data.key_sarana
          updateLog.res_body = response.data
          updateLog.res_status = response.status
          createHttpLogger(updateLog)

          let smileUpdateUrl = smileUrl + '/entity/' + entity_id + '/submitBPOM'

          testPayload('http-worker', {
            url: smileUpdateUrl,
            method: 'PUT',
            headers: smileHeader,
            data: { bpom_key: bpom_key },
          })
        } else {
          throw Error(response)
        }
      })
      .catch((error) => {
        console.warn(error)
        updateLog.res_body = error.response.data
        updateLog.res_status = error.response.status
        createHttpLogger(updateLog)
      })
    resolve(true)
  })
  // return true
}

const orderBPOMWorker = () => {
  amqp.connect(amqServer, { frameMax: 1048576 }, function (error0, connection) {
    if (error0) {
      throw error0
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1
      }
      channel.assertQueue(orderBPOM, {
        durable: true,
      })
      channel.prefetch(1)
      console.log(
        ' [*] Waiting for messages in %s. To exit press CTRL+C',
        orderBPOM
      )

      channel.consume(
        orderBPOM,
        function (msg) {
          if (msg !== null) {
            console.log(' [x] Received %s', msg.content.toString())
            // get covid data & create
            console.log(' new worker detected at ' + orderBPOM)
            setTimeout(function () {
              processOrder(JSON.parse(msg.content.toString())).then(() => {})
              channel.ack(msg)
            }, 1000)
          }
        },
        {
          noAck: false,
        }
      )
    })
  })
}

async function processOrder(payload) {
  try {
    const { type, vendor, customer, orders } = payload
    // { url, data, headers, method }
    // check vendor & customer is exist ?
    const vendorKode = await checkSaranaBPOM(vendor)
    const customerKode = await checkSaranaBPOM(customer)

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
      testPayload('http-worker', {
        url: order.url,
        method: order.method,
        headers: order.headers,
        data: data,
      })
    }
    return true
  } catch (err) {
    const orderError = {
      url: 'order_error',
      worker_name: 'order_bpom',
      payload: payload,
      res_body: err,
      res_status: 500,
    }
    createHttpLogger(orderError)

    console.log(err)
    return err
  }
}

const transactionBPOMWorker = () => {
  amqp.connect(amqServer, { frameMax: 1048576 }, function (error0, connection) {
    if (error0) {
      throw error0
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1
      }
      channel.assertQueue(transactionBPOM, {
        durable: true,
      })
      channel.prefetch(1)
      console.log(
        ' [*] Waiting for messages in %s. To exit press CTRL+C',
        transactionBPOM
      )

      channel.consume(
        transactionBPOM,
        function (msg) {
          if (msg !== null) {
            console.log(' [x] Received %s', msg.content.toString())
            // get covid data & create
            console.log(' new worker detected at ' + transactionBPOM)
            setTimeout(function () {
              processTransaction(JSON.parse(msg.content.toString())).then(
                () => {}
              )
              channel.ack(msg)
            }, 1000)
          }
        },
        {
          noAck: false,
        }
      )
    })
  })
}

async function processTransaction(payload) {
  try {
    const { entity, transactions } = payload
    // { url, data, headers, method }
    // check vendor & customer is exist ?
    const entityKode = await checkSaranaBPOM(entity)

    for (let i = 0; i < transactions.length; i++) {
      let transaction = transactions[i]
      let data = transaction.data
      data.pelapor = entityKode
      testPayload('http-worker', {
        url: transaction.url,
        method: transaction.method,
        headers: transaction.headers,
        data: data,
      })
    }
    return true
  } catch (err) {
    const transError = {
      url: 'trans_error',
      worker_name: 'trans_bpom',
      payload: payload,
      res_body: err,
      res_status: 500,
    }
    createHttpLogger(transError)
    console.error(err)
    return err
  }
}

async function checkSaranaBPOM(sarana, logging = true) {
  let bpomKode = ''

  const logCreateSarana = {
    method: sarana.method,
    payload: sarana.data,
    url: sarana.url,
    worker_name: 'bpom_sarana',
  }

  try {
    // create new sarana
    const createSarana = await axios({
      headers: sarana.headers,
      method: sarana.method,
      data: sarana.data,
      url: sarana.url,
    })
    logCreateSarana.res_body = createSarana.data
    logCreateSarana.res_status = createSarana.status
    if (logging) createHttpLogger(logCreateSarana)

    bpomKode = sarana.data.kode_sarana
    return bpomKode
  } catch (error) {
    let errorData = error.response.data
    logCreateSarana.res_body = errorData
    logCreateSarana.res_status = error.response.status
    if (logging) createHttpLogger(logCreateSarana)

    if (errorData.kode === 3) {
      bpomKode = sarana.data.kode_sarana
      return bpomKode
    }
    throw Error(error)
  }
}

const testingPayload = {
  url: 'http://103.5.148.215/vaksin-dev/api/integration/sendSarana',
  data: {
    key_sarana: null,
    kode: '3271',
    kelompok_sarana: '4',
    name: 'DINKES KOTA BOGOR',
    alamat: '-',
    city: '3271',
    province: '32',
    kode_pos: null,
    pic: 'dr. DjohanMusali M.Kes',
    email: 'salinov@badr-interactive.com',
    no_tlp: '6285717874485',
    no_izin: null,
    tgl_izin: null,
    nib: null,
    npwp: null,
    lat: '-6.57585948372033',
    long: '106.799562202061',
    no_sertifikat: null,
    tgl_sertifikat: null,
  },
  smile_token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJhcnJ5Iiwicm9sZSI6MiwiaWF0IjoxNjEzMDQ3Mjg3LCJleHAiOjE2MTM2NTIwODd9.FT0H9lUOu_Dau2EPjeeSkCjtFN4aDt-ggFUNTR1F6LI',
  headers: {
    Unit: '02',
    Token: '42904f960c3fd4a3334dd3b91e03f5b25f32f0e7',
  },
  entity_id: 5,
}

const testSaranaBPOMWorker = () => {
  console.log('Prepare connection to rabbitmq')
  testPayload(postSaranaWorker, testingPayload)
}

const testSarana = function () {
  processPayload(testingPayload).then(() => {
    console.log('Testing done')
  })
}

module.exports = {
  updateSaranaBPOM,
  testSaranaBPOMWorker,
  testSarana,
  processOrder,
  orderBPOMWorker,
  transactionBPOMWorker,
  checkSaranaBPOM,
}
