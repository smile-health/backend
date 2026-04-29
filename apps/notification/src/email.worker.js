
/**
 * Email Worker
 *
 * Processes email notifications from the message queue.
 * Uses the MailProvider abstraction for sending emails,
 * allowing switching between SES, SMTP, or other providers
 * via the MAIL_PROVIDER environment variable.
 */

const amqp = require('amqplib/callback_api')
const { initializeMailProvider, getMailProvider } = require('./lib/mail')

const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'

const worker = 'email-notification'
const { testPayload } = require('./services/test.service')

// Initialize mail provider on module load
initializeMailProvider()

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
            const { mail, subject, content } = JSON.parse(
              msg.content.toString()
            )
            console.log(' [x] Received %s', mail)

            // Send email using MailProvider abstraction
            const provider = getMailProvider()
            provider.sendEmail({
              to: mail,
              subject: subject,
              html: content,
            })
              .then(() => {
                console.log(' [x] Email sent successfully to %s', mail)
                channel.ack(msg)
              })
              .catch((err) => {
                console.error(' [x] Failed to send email:', err)
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

  const provider = getMailProvider()
  provider.sendEmail({
    to: mail,
    subject: subject,
    html: content,
  }).then(() => {
    console.log('success send email')
  }).catch((err) => {
    console.error('Error sending test email:', err)
  })
}

module.exports = {
  consumeEmail,
  testEmailWorker,
  testEmail,
}
