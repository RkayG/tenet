/**
 * Environment Configuration Provider
 *
 * Loads configuration from environment variables
 */

import { AppConfig, ConfigProvider } from '../../core/types';

export class EnvironmentConfig implements ConfigProvider {
  public name = 'environment';
  public priority = 10; // High priority

  public async load(): Promise<Partial<AppConfig>> {
    return {
      environment: (process.env.NODE_ENV as any) || 'development',
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      host: process.env.HOST || 'localhost',

      database: {
        url: process.env.DATABASE_URL || '',
        poolSize: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE, 10) : 10,
        ssl: process.env.DB_SSL === 'true',
        timeout: process.env.DB_TIMEOUT ? parseInt(process.env.DB_TIMEOUT, 10) : 30000,
      },

      auth: {
        jwt: {
          secret: process.env.JWT_SECRET || '',
          expiresIn: process.env.JWT_EXPIRES_IN || '1h',
          refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
          issuer: process.env.JWT_ISSUER || 'secure-api-handler',
        },
        strategies: (process.env.AUTH_STRATEGIES || 'jwt').split(',').map(s => s.trim()),
      },

      security: {
        encryption: {
          algorithm: (process.env.ENCRYPTION_ALGORITHM as any) || 'AES-256-GCM',
          key: process.env.ENCRYPTION_KEY || '',
        },
        rateLimiting: {
          enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
        },
        sanitization: {
          xss: {
            enabled: process.env.XSS_PROTECTION_ENABLED !== 'false',
          },
          sensitive: {
            fields: (process.env.SENSITIVE_FIELDS || 'password,token,secret').split(',').map(f => f.trim()),
          },
        },
      },

      cache: {
        provider: (process.env.CACHE_PROVIDER as any) || 'memory',
        redis: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          password: process.env.REDIS_PASSWORD,
          database: process.env.REDIS_DATABASE ? parseInt(process.env.REDIS_DATABASE, 10) : undefined,
        },
        defaultTtl: process.env.CACHE_DEFAULT_TTL ? parseInt(process.env.CACHE_DEFAULT_TTL, 10) : 300,
      },

      monitoring: {
        provider: (process.env.MONITORING_PROVIDER as any) || 'console',
        apiKey: process.env.MONITORING_API_KEY,
        serviceName: process.env.SERVICE_NAME || 'secure-api-handler',
        environment: (process.env.NODE_ENV as any) || 'development',
      },

      multitenancy: {
        enabled: process.env.MULTITENANCY_ENABLED === 'true',
        strategy: (process.env.MULTITENANCY_STRATEGY as any) || 'shared_schema',
        tenantHeader: process.env.TENANT_HEADER || 'X-Tenant-ID',
        defaultTenant: process.env.DEFAULT_TENANT,
      },
    };
  }

  /**
   * Watch for environment variable changes (limited support)
   */
  public watch?(callback: (config: Partial<AppConfig>) => void): void {
    // In Node.js, environment variables don't change at runtime
    // This could be extended to watch for file changes if config is loaded from files
    console.log('Environment config provider does not support watching');
  }
}
