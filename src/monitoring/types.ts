/**
 * Monitoring Types
 */

export interface Span {
    traceId: string;
    spanId: string;
    name: string;
    startTime: number;
    endTime?: number;
    tags?: Record<string, string>;
    logs?: Array<{ timestamp: number; message: string }>;
}

export interface ServiceHealth {
    healthy: boolean;
    service: string;
    error?: string;
    lastCheck: Date;
}

export interface ServiceRegistry {
    monitoring: any; // MonitoringService
    configManager: any; // ConfigManager
    tenantManager: any; // TenantManager
    versionManager: any; // VersionManager
    auditService: any; // AuditService
    authManager: any; // AuthManager
    rateLimiter: any; // RedisRateLimiter
    cacheManager: any; // CacheManager
}

export interface ServiceInitResult {
    success: boolean;
    services: Partial<ServiceRegistry>;
    errors: Array<{ service: string; error: Error }>;
}
