/**
 * Configuration Manager
 *
 * Manages application configuration with environment variables,
 * feature flags, and dynamic configuration updates
 */

import { AppConfig } from '../core/types';

export interface ConfigProvider {
  name: string;
  priority: number;
  load(): Promise<Partial<AppConfig>>;
  watch?(callback: (config: Partial<AppConfig>) => void): void;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private providers: ConfigProvider[] = [];
  private watchers: Array<(config: AppConfig) => void> = [];
  private featureFlags: Record<string, boolean> = {};

  private constructor() {
    // Default configuration
    this.config = {
      environment: (process.env.NODE_ENV as any) || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
      host: process.env.HOST || 'localhost',
      database: {
        url: process.env.DATABASE_URL || '',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
        ssl: process.env.DB_SSL === 'true',
        timeout: parseInt(process.env.DB_TIMEOUT || '30000', 10),
      },
      auth: {
        jwt: {
          secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
          expiresIn: process.env.JWT_EXPIRES_IN || '1h',
          refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
          issuer: process.env.JWT_ISSUER || 'secure-api-handler',
        },
        strategies: (process.env.AUTH_STRATEGIES || 'jwt').split(','),
      },
      security: {
        encryption: {
          algorithm: 'AES-256-GCM',
          key: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production',
        },
        rateLimiting: {
          enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
        },
        sanitization: {
          xss: { enabled: true },
          sensitive: { fields: ['password', 'token', 'secret'] },
        },
      },
      cache: {
        provider: (process.env.CACHE_PROVIDER as any) || 'memory',
        redis: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          password: process.env.REDIS_PASSWORD,
        },
        defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10),
      },
      monitoring: {
        provider: (process.env.MONITORING_PROVIDER as any) || 'console',
        serviceName: process.env.SERVICE_NAME || 'secure-api-handler',
        environment: (process.env.NODE_ENV as any) || 'development',
      },
      multitenancy: {
        tenantHeader: process.env.TENANT_HEADER || 'X-Tenant-ID',
      },
      features: {},
    };

    // Load feature flags
    this.loadFeatureFlags();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Add a configuration provider
   */
  public addProvider(provider: ConfigProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Load configuration from all providers
   */
  public async load(): Promise<void> {
    for (const provider of this.providers) {
      try {
        const partialConfig = await provider.load();
        this.mergeConfig(partialConfig);
      } catch (error) {
        console.error(`Failed to load config from provider ${provider.name}:`, error);
      }
    }

    // Notify watchers
    this.notifyWatchers();
  }

  /**
   * Get current configuration
   */
  public getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get configuration value by path
   */
  public get<T = any>(path: string, defaultValue?: T): T {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue as T;
      }
    }

    return value as T;
  }

  /**
   * Set configuration value
   */
  public set(path: string, value: any): void {
    const keys = path.split('.');
    let obj: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in obj) || typeof obj[key] !== 'object') {
        obj[key] = {};
      }
      obj = obj[key];
    }

    obj[keys[keys.length - 1]] = value;
    this.notifyWatchers();
  }

  /**
   * Update configuration
   */
  public update(updates: Partial<AppConfig>): void {
    this.mergeConfig(updates);
    this.notifyWatchers();
  }

  /**
   * Check if feature is enabled
   */
  public isFeatureEnabled(feature: string): boolean {
    return this.featureFlags[feature] === true;
  }

  /**
   * Enable feature
   */
  public enableFeature(feature: string): void {
    this.featureFlags[feature] = true;
  }

  /**
   * Disable feature
   */
  public disableFeature(feature: string): void {
    this.featureFlags[feature] = false;
  }

  /**
   * Get all feature flags
   */
  public getFeatureFlags(): Record<string, boolean> {
    return { ...this.featureFlags };
  }

  /**
   * Set feature flags
   */
  public setFeatureFlags(flags: Record<string, boolean>): void {
    this.featureFlags = { ...this.featureFlags, ...flags };
  }

  /**
   * Watch for configuration changes
   */
  public watch(callback: (config: AppConfig) => void): () => void {
    this.watchers.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.watchers.indexOf(callback);
      if (index > -1) {
        this.watchers.splice(index, 1);
      }
    };
  }

  /**
   * Validate configuration
   */
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!this.config.database.url) {
      errors.push('Database URL is required');
    }

    if (!this.config.auth.jwt.secret || this.config.auth.jwt.secret === 'default-secret-change-in-production') {
      errors.push('JWT secret must be configured');
    }

    if (!this.config.security.encryption.key || this.config.security.encryption.key === 'default-encryption-key-change-in-production') {
      errors.push('Encryption key must be configured');
    }

    // Validate port range
    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    // Validate environment
    const validEnvs = ['development', 'staging', 'production'];
    if (!validEnvs.includes(this.config.environment)) {
      errors.push(`Environment must be one of: ${validEnvs.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration as environment variables
   */
  public toEnv(): Record<string, string> {
    const env: Record<string, string> = {};

    // Flatten config object to env vars
    const flatten = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const envKey = prefix ? `${prefix}_${key.toUpperCase()}` : key.toUpperCase();

        if (typeof value === 'object' && value !== null) {
          flatten(value, envKey);
        } else {
          env[envKey] = String(value);
        }
      }
    };

    flatten(this.config);
    return env;
  }

  /**
   * Load from environment variables
   */
  public fromEnv(): void {
    // Update config from environment variables
    const envConfig: Partial<AppConfig> = {
      environment: (process.env.NODE_ENV as any) || this.config.environment,
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : this.config.port,
      host: process.env.HOST || this.config.host,
      database: {
        ...this.config.database,
        url: process.env.DATABASE_URL || this.config.database.url,
        poolSize: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE, 10) : this.config.database.poolSize,
        ssl: process.env.DB_SSL ? process.env.DB_SSL === 'true' : this.config.database.ssl,
        timeout: process.env.DB_TIMEOUT ? parseInt(process.env.DB_TIMEOUT, 10) : this.config.database.timeout,
      },
      // Add more environment mappings as needed
    };

    this.mergeConfig(envConfig);
  }

  // Private methods

  private mergeConfig(partial: Partial<AppConfig>): void {
    // Deep merge configuration
    const merge = (target: any, source: any): any => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = merge(target[key] || {}, source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    };

    merge(this.config, partial);
  }

  private loadFeatureFlags(): void {
    // Load from environment variables
    const envFeatures = process.env.FEATURE_FLAGS;
    if (envFeatures) {
      try {
        const flags = JSON.parse(envFeatures);
        this.featureFlags = { ...this.featureFlags, ...flags };
      } catch (error) {
        console.warn('Failed to parse FEATURE_FLAGS:', error);
      }
    }

    // Load individual feature flags
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('FEATURE_')) {
        const featureName = key.substring(8).toLowerCase().replace(/_/g, '-');
        this.featureFlags[featureName] = process.env[key] === 'true';
      }
    });
  }

  private notifyWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher(this.getConfig());
      } catch (error) {
        console.error('Configuration watcher error:', error);
      }
    }
  }
}
