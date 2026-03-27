smile-health\backend\apps\notification\src\lib\mail\types.js

/**
 * Mail Provider Interface Types
 *
 * Abstracts email sending functionality behind a provider-agnostic interface.
 * Allows switching between AWS SES, SMTP, or other email providers
 * without changing consuming code.
 */

/**
 * @typedef {Object} EmailAttachment
 * @property {string} filename - Name of the attachment
 * @property {Buffer|string} content - Attachment content
 * @property {string} [contentType] - MIME type of the attachment
 */

/**
 * @typedef {Object} SendEmailOptions
 * @property {string|string[]} to - Recipient email address(es)
 * @property {string} subject - Email subject
 * @property {string} [html] - HTML body content
 * @property {string} [text] - Plain text body content
 * @property {string} [from] - Sender email address
 * @property {string|string[]} [cc] - CC recipient(s)
 * @property {string|string[]} [bcc] - BCC recipient(s)
 * @property {EmailAttachment[]} [attachments] - File attachments
 */

/**
 * MailProvider interface
 * @interface
 */
class MailProvider {
  /**
   * Initialize the mail provider
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Method not implemented')
  }

  /**
   * Send an email
   * @param {SendEmailOptions} options - Email options
   * @returns {Promise<Object>} - Provider-specific response
   */
  async sendEmail(options) {
    throw new Error('Method not implemented')
  }

  /**
   * Verify provider connection/configuration
   * @returns {Promise<boolean>}
   */
  async verify() {
    throw new Error('Method not implemented')
  }
}

module.exports = {
  MailProvider,
}

// JSDoc type exports for IDE support
/**
 * @typedef {MailProvider} MailProvider
 * @typedef {SendEmailOptions} SendEmailOptions
 * @typedef {EmailAttachment} EmailAttachment
 */
