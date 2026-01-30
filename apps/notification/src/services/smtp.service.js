var nodemailer = require('nodemailer')

const options = require('../config/smtp')
const sender = process.env.MAIL_SENDER || 'no-reply@smile-undp.co.id'

exports.sendMail = function (to, subject, message) {
  console.log('Preparing.....')
  var transport = nodemailer.createTransport(options)

  var mailOptions = {
    from: sender, // sender address
    to: to, // list of receivers
    subject: subject, // Subject line
    html: message, // email body
  }
  return new Promise((resolve, reject) => {
    // send mail with defined transport object
    transport.sendMail(mailOptions, function (error, response) {
      if (error) {
        console.error(error)
        reject(error, error.stack)
      } else {
        console.log('Message sent: ' + JSON.stringify(response))
        resolve(response)
      }
      transport.close() // shut down the connection pool, no more messages
    })
  })
}
