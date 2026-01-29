const amqp = require('amqplib/callback_api')
// const EmailService = require('./aws.service')
const EmailService = require('./services/smtp.service')

const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'

const worker = 'email-notification'
const { testPayload } = require('./services/test.service')

// Consumer
const consumeEmail = () => {
  amqp.connect(amqServer, { frameMax: 4194304 }, function (error0, connection) {
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
        function (msg) {
          console.log(' [x] Received %s', msg.content.toString())
          if (msg != null) {
            // get covid data & create
            const { mail, subject, content } = JSON.parse(
              msg.content.toString()
            )
            console.log(' [x] Received %s', mail)
            // send email via aws ses
            EmailService.sendMail(mail, subject, content)
              .then(() => {
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
  mail: 'uwais@badr-interactive.com',
  subject: 'Forgot Password',
  content: 'Testing Email',
}
// Publisher
const testEmailWorker = () => {
  testPayload(worker, testingPayload)
}

const testEmail = function () {
  const { mail, subject, content } = testingPayload
  console.log('testing send email')
  EmailService.sendMail(mail, subject, content).then(() => {
    console.log('success send email')
  })
}

module.exports = {
  consumeEmail,
  testEmailWorker,
  testEmail,
}
