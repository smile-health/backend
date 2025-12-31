import { GrowthBook, setPolyfills } from '@growthbook/growthbook';

export interface GrowthBookConfig {
  apiHost?: string;
  clientKey?: string;
  environment?: string;
  enableDevMode?: boolean;
  trackingCallback?: (experiment: any, result: any) => void;
  webhookSecret?: string;
}

export class GrowthBookService {
  private static instance: GrowthBookService;
  private growthBook: GrowthBook;
  private initializationPromise: Promise<void> | null = null;
  private webhookSecret?: string;

  private constructor(config: GrowthBookConfig = {}) {
    this.webhookSecret = config.webhookSecret || process.env.GROWTHBOOK_WEBHOOK_SECRET;

    setPolyfills({
      EventSource: require("eventsource"),
    });

    this.growthBook = new GrowthBook({
      apiHost: config.apiHost || process.env.GROWTHBOOK_API_HOST || 'https://cdn.growthbook.io',
      clientKey: config.clientKey || process.env.GROWTHBOOK_CLIENT_KEY || '',
      enableDevMode: config.enableDevMode || process.env.NODE_ENV === 'development',
      trackingCallback: config.trackingCallback,
      // Use ENVIRONMENT as the main environment
      attributes: {
        environment: config.environment || process.env.NODE_ENV || 'development',
      },
    });
    
    // Auto-initialize on creation
    this.autoInitialize();
  }

  static getInstance(config?: GrowthBookConfig): GrowthBookService {
    if (!GrowthBookService.instance) {
      GrowthBookService.instance = new GrowthBookService(config);
    }
    return GrowthBookService.instance;
  }

  private autoInitialize(): void {
    if (this.initializationPromise) return;
    
    this.initializationPromise = this.growthBook.loadFeatures().catch(error => {
      console.error('Failed to initialize GrowthBook:', error);
      // Continue without features if initialization fails
    });
  }

  isFeatureEnabledSync(featureKey: string, defaultValue: boolean = false): boolean {
    return this.growthBook.isOn(featureKey) ?? defaultValue;
  }

  getFeatureValueSync<T>(featureKey: string, defaultValue: T): T {
    return this.growthBook.getFeatureValue(featureKey, defaultValue);
  }

  setAttributes(attributes: Record<string, any>): void {
    this.growthBook.setAttributes({
      ...this.growthBook.getAttributes(),
      ...attributes,
    });
  }

  /**
   * Manually refresh feature flags from GrowthBook API
   * Useful for webhook handlers or manual refresh endpoints
   */
  async refreshFeatures(): Promise<void> {
    try {
      await this.growthBook.loadFeatures();
      console.log('Feature flags refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh feature flags:', error);
      throw error;
    }
  }

  /**
   * Get webhook secret for signature verification
   */
  getWebhookSecret(): string | undefined {
    return this.webhookSecret;
  }

  destroy(): void {
    this.growthBook.destroy();
    this.initializationPromise = null;
  }
}