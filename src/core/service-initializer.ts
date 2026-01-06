/**
 * Service Initialization Helper
 * 
 * Safely initializes services with error handling and fallbacks
 */

import { MonitoringService } from '../monitoring/service';
import { ConfigManager } from '../config/manager';
import { TenantManager } from '../multitenancy/manager';
import { VersionManager } from '../versioning/manager';
import { AuditService } from '../audit/audit-service';
import { AuthManager } from '../auth/manager';
import { RedisRateLimiter } from '../security/rate-limiting';
import { CacheManager } from '../caching/manager';
import { ServiceRegistry, ServiceInitResult } from '../monitoring/types';

export class ServiceInitializer {
    private static registry: Partial<ServiceRegistry> = {};
    private static initialized = false;

    /**
     * Initialize all services at application startup
     */
    public static async initialize(): Promise<ServiceInitResult> {
        if (this.initialized) {
            return { success: true, services: this.registry, errors: [] };
        }

        const errors: Array<{ service: string; error: Error }> = [];

        // Initialize MonitoringService
        try {
            this.registry.monitoring = MonitoringService.getInstance();
        } catch (error) {
            console.error('[ServiceInit] Failed to initialize MonitoringService:', error);
            errors.push({ service: 'MonitoringService', error: error as Error });
            // Fallback to no-op monitoring
            this.registry.monitoring = this.createNoOpMonitoring();
        }

        // Initialize ConfigManager
        try {
            this.registry.configManager = ConfigManager.getInstance();
        } catch (error) {
            console.error('[ServiceInit] Failed to initialize ConfigManager:', error);
            errors.push({ service: 'ConfigManager', error: error as Error });
            // Fallback to default config
            this.registry.configManager = this.createDefaultConfig();
        }

        // Initialize TenantManager
        try {
            this.registry.tenantManager = TenantManager.getInstance();
        } catch (error) {
            console.error('[ServiceInit] Failed to initialize TenantManager:', error);
            errors.push({ service: 'TenantManager', error: error as Error });
            // Fallback to disabled multi-tenancy
            this.registry.tenantManager = this.createNoOpTenantManager();
        }

        // Initialize VersionManager
        try {
            this.registry.versionManager = VersionManager.getInstance();
        } catch (error) {
            console.error('[ServiceInit] Failed to initialize VersionManager:', error);
            errors.push({ service: 'VersionManager', error: error as Error });
            // Fallback to default version
            this.registry.versionManager = this.createDefaultVersionManager();
        }

        // Initialize AuditService
        try {
            this.registry.auditService = AuditService.getInstance();
        } catch (error) {
            console.error('[ServiceInit] Failed to initialize AuditService:', error);
            errors.push({ service: 'AuditService', error: error as Error });
            // Fallback to no-op audit
            this.registry.auditService = this.createNoOpAudit();
        }

        // Initialize AuthManager
        try {
            this.registry.authManager = AuthManager.getInstance();
        } catch (error) {
            console.error('[ServiceInit] CRITICAL: Failed to initialize AuthManager:', error);
            errors.push({ service: 'AuthManager', error: error as Error });
            // Auth is critical - no fallback
            throw new Error('Failed to initialize AuthManager - cannot start application');
        }

        // Initialize RateLimiter (optional)
        try {
            this.registry.rateLimiter = RedisRateLimiter.getInstance();
        } catch (error) {
            console.warn('[ServiceInit] Failed to initialize RateLimiter:', error);
            errors.push({ service: 'RateLimiter', error: error as Error });
            // Fallback to in-memory rate limiting
            this.registry.rateLimiter = this.createInMemoryRateLimiter();
        }

        // Initialize CacheManager (optional)
        try {
            this.registry.cacheManager = CacheManager.getInstance();
        } catch (error) {
            console.warn('[ServiceInit] Failed to initialize CacheManager:', error);
            errors.push({ service: 'CacheManager', error: error as Error });
            // Fallback to no caching
            this.registry.cacheManager = this.createNoOpCache();
        }

        this.initialized = true;

        return {
            success: errors.length === 0,
            services: this.registry,
            errors,
        };
    }

    /**
     * Get initialized services
     */
    public static getServices(): Partial<ServiceRegistry> {
        if (!this.initialized) {
            throw new Error('Services not initialized. Call ServiceInitializer.initialize() first.');
        }
        return this.registry;
    }

    /**
     * Graceful shutdown - flush pending operations
     */
    public static async shutdown(): Promise<void> {
        console.log('[ServiceInit] Starting graceful shutdown...');

        // Flush pending audit logs
        if (this.registry.auditService) {
            try {
                await this.registry.auditService.flushPendingLogs();
                console.log('[ServiceInit] Audit logs flushed');
            } catch (error) {
                console.error('[ServiceInit] Failed to flush audit logs:', error);
            }
        }

        // Close Redis connections
        if (this.registry.rateLimiter) {
            try {
                await this.registry.rateLimiter.disconnect();
                console.log('[ServiceInit] Rate limiter disconnected');
            } catch (error) {
                console.error('[ServiceInit] Failed to disconnect rate limiter:', error);
            }
        }

        // Close cache connections
        if (this.registry.cacheManager) {
            try {
                await this.registry.cacheManager.disconnect();
                console.log('[ServiceInit] Cache manager disconnected');
            } catch (error) {
                console.error('[ServiceInit] Failed to disconnect cache:', error);
            }
        }

        console.log('[ServiceInit] Graceful shutdown complete');
    }

    // Fallback implementations

    private static createNoOpMonitoring() {
        return {
            startSpan: () => null,
            endSpan: () => { },
            recordMetric: () => { },
            getInstance: () => this.registry.monitoring,
        };
    }

    private static createDefaultConfig() {
        return {
            getConfig: () => ({ multitenancy: { enabled: false } }),
            getFeatureFlags: () => ({}),
            getInstance: () => this.registry.configManager,
        };
    }

    private static createNoOpTenantManager() {
        return {
            isEnabled: () => false,
            resolveTenantId: () => null,
            getTenantContext: () => null,
            getInstance: () => this.registry.tenantManager,
        };
    }

    private static createDefaultVersionManager() {
        return {
            getClientVersion: () => 'v1',
            isVersionSupported: () => true,
            getInstance: () => this.registry.versionManager,
        };
    }

    private static createNoOpAudit() {
        return {
            logEvent: async () => null,
            logAuthEvent: async () => null,
            logSecurityEvent: async () => null,
            flushPendingLogs: async () => { },
            getInstance: () => this.registry.auditService,
        };
    }

    private static createInMemoryRateLimiter() {
        const store = new Map<string, { count: number; resetTime: number }>();

        return {
            checkLimit: async (key: string, config: any) => {
                const now = Date.now();
                const entry = store.get(key);

                if (!entry || entry.resetTime < now) {
                    store.set(key, { count: 1, resetTime: now + (config.window || 60000) });
                    return true;
                }

                if (entry.count >= (config.max || 100)) {
                    return false;
                }

                entry.count++;
                return true;
            },
            disconnect: async () => { },
            getInstance: () => this.registry.rateLimiter,
        };
    }

    private static createNoOpCache() {
        return {
            get: async () => null,
            set: async () => { },
            delete: async () => { },
            disconnect: async () => { },
            getInstance: () => this.registry.cacheManager,
        };
    }
}

// Setup graceful shutdown hooks
if (typeof process !== 'undefined') {
    process.on('SIGTERM', async () => {
        console.log('[ServiceInit] Received SIGTERM signal');
        await ServiceInitializer.shutdown();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('[ServiceInit] Received SIGINT signal');
        await ServiceInitializer.shutdown();
        process.exit(0);
    });
}
