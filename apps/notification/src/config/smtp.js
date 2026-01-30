const dotenv = require('dotenv')

dotenv.config()

module.exports = {
  host: process.env.SMTP_HOST || 'email-smtp.ap-southeast-1.amazonaws.com',
  secureConnection: process.env.SMTP_SSL || true,
  port: process.env.SMTP_PORT || 465,
  auth: {
    user: process.env.SMTP_USER || 'Your Amazon SMTP User', // Use from Amazon Credentials
    pass: process.env.SMTP_PASSWORD || 'Your Amazon SMTP Pass', // Use from Amazon Credentials
  },
}
