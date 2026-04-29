
/**
 * Mail Provider Factory
 *
 * Provides a unified interface for creating and accessing mail providers.
 * Supports AWS SES, SMTP, and other email backends via configuration.
 */

const { MailProvider } = require('./types')
const { SESMailProvider, createSESProvider } = require('./ses-provider')
const { SMTPMailProvider, createSMTPProvider } = require('./smtp-provider')

// Singleton instance
let mailProviderInstance = null

/**
 * Create a mail provider based on configuration
 * @param {string} providerType - Type of provider ('ses', 'smtp', etc.)
 * @param {Object} config - Provider-specific configuration
 * @returns {MailProvider} Configured mail provider instance
 */
function createMailProvider(providerType, config = {}) {
  switch (providerType) {
    case 'ses':
      return createSESProvider(config)
    case 'smtp':
      return createSMTPProvider(config)
    default:
      console.warn(`Unknown mail provider type: ${providerType}, defaulting to SES`)
      return createSESProvider(config)
  }
}

/**
 * Initialize and return the global mail provider singleton
 * @param {string} [providerType] - Override the provider type
 * @param {Object} [config] - Provider configuration
 * @returns {MailProvider} Mail provider instance
 */
function initializeMailProvider(providerType, config = {}) {
  if (mailProviderInstance) {
    return mailProviderInstance
  }

  // Determine provider from environment or parameter
  const type = providerType || process.env.MAIL_PROVIDER || 'ses'

  console.log(`[MailProvider] Initializing mail provider: ${type}`)

  mailProviderInstance = createMailProvider(type, config)
  return mailProviderInstance
}

/**
 * Get the current mail provider instance
 * Throws if initializeMailProvider hasn't been called
 * @returns {MailProvider} Mail provider instance
 */
function getMailProvider() {
  if (!mailProviderInstance) {
    // Auto-initialize with default config
    return initializeMailProvider()
  }
  return mailProviderInstance
}

/**
 * Reset the provider instance (useful for testing)
 */
function resetMailProvider() {
  mailProviderInstance = null
}

module.exports = {
  // Factory functions
  createMailProvider,
  initializeMailProvider,
  getMailProvider,
  resetMailProvider,

  // Provider classes
  MailProvider,
  SESMailProvider,
  SMTPMailProvider,

  // Provider creators
  createSESProvider,
  createSMTPProvider,
}
