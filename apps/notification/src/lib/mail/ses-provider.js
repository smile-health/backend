
/**
 * AWS SES Mail Provider Implementation
 *
 * Implements the MailProvider interface using AWS SES SDK.
 * Provides email sending functionality via Amazon Simple Email Service.
 */

const AWS = require('aws-sdk')

class SESMailProvider {
  /**
   * @param {Object} config - AWS SES configuration
   * @param {string} config.accessKeyId - AWS access key ID
   * @param {string} config.secretAccessKey - AWS secret access key
   * @param {string} config.region - AWS region (e.g., 'ap-southeast-1')
   * @param {string} config.defaultFrom - Default sender email address
   */
  constructor(config = {}) {
    this.config = {
      accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      region: config.region || process.env.AWS_SES_REGION || 'ap-southeast-1',
      defaultFrom: config.defaultFrom || process.env.MAIL_SENDER || '"SMILE Health" <no-reply@smile-indonesia.id>',
    }
    this.ses = null
  }

  /**
   * Initialize the SES client
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.ses) return

    AWS.config.update({
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: this.config.region,
    })

    this.ses = new AWS.SES({ apiVersion: '2010-12-01' })
  }

  /**
   * Send an email via AWS SES
   * @param {Object} options - Email options
   * @param {string|string[]} options.to - Recipient email address(es)
   * @param {string} options.subject - Email subject
   * @param {string} [options.html] - HTML body content
   * @param {string} [options.text] - Plain text body content
   * @param {string} [options.from] - Sender email address
   * @param {string|string[]} [options.cc] - CC recipient(s)
   * @param {string|string[]} [options.bcc] - BCC recipient(s)
   * @param {Array} [options.attachments] - File attachments (not supported in raw SES, use SESv2 for attachments)
   * @returns {Promise<Object>} - SES send response
   */
  async sendEmail(options) {
    if (!this.ses) {
      await this.initialize()
    }

    const { to, subject, html, text, from, cc, bcc, attachments } = options

    // Build destination
    const destination = {
      ToAddresses: Array.isArray(to) ? to : [to],
    }

    if (cc) {
      destination.CcAddresses = Array.isArray(cc) ? cc : [cc]
    }

    if (bcc) {
      destination.BccAddresses = Array.isArray(bcc) ? bcc : [bcc]
    }

    // Build message body
    const body = {}

    if (html) {
      body.Html = {
        Charset: 'UTF-8',
        Data: html,
      }
    }

    if (text) {
      body.Text = {
        Charset: 'UTF-8',
        Data: text,
      }
    }

    // If no body specified, throw error
    if (!html && !text) {
      throw new Error('Email must have either html or text content')
    }

    const params = {
      Destination: destination,
      Message: {
        Body: body,
        Subject: {
          Charset: 'UTF-8',
          Data: subject,
        },
      },
      Source: from || this.config.defaultFrom,
      ReturnPath: from || this.config.defaultFrom,
    }

    // Note: Attachments require raw email or SESv2. For now, log a warning.
    if (attachments && attachments.length > 0) {
      console.warn('SES Provider: Attachments not supported in basic SES provider. Use SESv2 or SMTP for attachments.')
    }

    return new Promise((resolve, reject) => {
      this.ses.sendEmail(params, (err, data) => {
        if (err) {
          console.error('SES sendEmail error:', err)
          reject(err)
        } else {
          resolve({
            messageId: data.MessageId,
            response: data,
            provider: 'ses',
          })
        }
      })
    })
  }

  /**
   * Verify SES configuration by checking identity verification status
   * @returns {Promise<boolean>}
   */
  async verify() {
    try {
      if (!this.ses) {
        await this.initialize()
      }

      // Attempt to get account sending status as a health check
      await this.ses.getSendQuota().promise()
      return true
    } catch (error) {
      console.error('SES provider verification failed:', error)
      return false
    }
  }

  /**
   * Get the underlying SES client instance
   * @returns {AWS.SES}
   */
  getClient() {
    return this.ses
  }
}

/**
 * Create an SES mail provider instance
 * @param {Object} config - Configuration options
 * @returns {SESMailProvider}
 */
function createSESProvider(config) {
  return new SESMailProvider(config)
}

module.exports = {
  SESMailProvider,
  createSESProvider,
}
