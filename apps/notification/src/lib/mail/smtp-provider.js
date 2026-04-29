
/**
 * SMTP Mail Provider Implementation
 *
 * Implements the MailProvider interface using Nodemailer.
 * Provides email sending functionality via SMTP.
 */

const nodemailer = require('nodemailer')

class SMTPMailProvider {
  /**
   * @param {Object} config - SMTP configuration
   * @param {string} config.host - SMTP server host
   * @param {number} config.port - SMTP server port
   * @param {string} config.user - SMTP username
   * @param {string} config.password - SMTP password
   * @param {boolean} [config.secure] - Use TLS
   * @param {string} [config.defaultFrom] - Default sender email address
   */
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.SMTP_HOST,
      port: config.port || parseInt(process.env.SMTP_PORT || '587'),
      user: config.user || process.env.SMTP_USER,
      password: config.password || process.env.SMTP_PASSWORD,
      secure: config.secure || process.env.SMTP_SECURE === 'true',
      defaultFrom: config.defaultFrom || process.env.MAIL_SENDER || '"SMILE Health" <no-reply@smile-indonesia.id>',
    }
    this.transporter = null
  }

  /**
   * Initialize the SMTP transporter
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.transporter) return

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
    })
  }

  /**
   * Send an email via SMTP
   * @param {Object} options - Email options
   * @param {string|string[]} options.to - Recipient email address(es)
   * @param {string} options.subject - Email subject
   * @param {string} [options.html] - HTML body content
   * @param {string} [options.text] - Plain text body content
   * @param {string} [options.from] - Sender email address
   * @param {string|string[]} [options.cc] - CC recipient(s)
   * @param {string|string[]} [options.bcc] - BCC recipient(s)
   * @param {Array} [options.attachments] - File attachments
   * @returns {Promise<Object>} - Nodemailer send response
   */
  async sendEmail(options) {
    if (!this.transporter) {
      await this.initialize()
    }

    const { to, subject, html, text, from, cc, bcc, attachments } = options

    const mailOptions = {
      from: from || this.config.defaultFrom,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
    }

    if (html) {
      mailOptions.html = html
    }

    if (text) {
      mailOptions.text = text
    }

    if (cc) {
      mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc
    }

    if (bcc) {
      mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc
    }

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments
    }

    const result = await this.transporter.sendMail(mailOptions)

    return {
      messageId: result.messageId,
      response: result,
      provider: 'smtp',
    }
  }

  /**
   * Verify SMTP connection
   * @returns {Promise<boolean>}
   */
  async verify() {
    try {
      if (!this.transporter) {
        await this.initialize()
      }

      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('SMTP provider verification failed:', error)
      return false
    }
  }

  /**
   * Get the underlying Nodemailer transporter
   * @returns {Object}
   */
  getClient() {
    return this.transporter
  }

  /**
   * Close the SMTP connection pool
   * @returns {Promise<void>}
   */
  async close() {
    if (this.transporter) {
      this.transporter.close()
      this.transporter = null
    }
  }
}

/**
 * Create an SMTP mail provider instance
 * @param {Object} config - Configuration options
 * @returns {SMTPMailProvider}
 */
function createSMTPProvider(config) {
  return new SMTPMailProvider(config)
}

module.exports = {
  SMTPMailProvider,
  createSMTPProvider,
}
