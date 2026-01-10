/**
 * Audit Service
 * 
 * Core service for managing audit trails with automatic logging,
 * querying, and retention management.
 */

import { PrismaClient } from '@prisma/client';
import {
    AuditEventData,
    AuditLog,
    AuditQueryFilter,
    AuditQueryOptions,
    AuditQueryResult,
    AuditServiceConfig,
    AuditContext,
    AuditEventType,
    AuditCategory,
    AuditStatus,
    AuditSeverity,
    RetentionCleanupResult,
} from './audit-types';
import { Logger } from '../utils/logger';

export class AuditService {
    private static instance: AuditService;
    private config: AuditServiceConfig;
    private prisma: PrismaClient;
    private logger: Logger;
    private pendingLogs: AuditEventData[] = [];
    private flushInterval?: NodeJS.Timeout;

    private constructor(config: AuditServiceConfig = {}, prisma?: PrismaClient) {
        this.config = {
            enabled: config.enabled !== false,
            autoLogAuth: config.autoLogAuth !== false,
            autoLogCRUD: config.autoLogCRUD !== false,
            autoLogSecurity: config.autoLogSecurity !== false,
            captureRequestBody: config.captureRequestBody !== false,
            captureResponseBody: config.captureResponseBody ?? false,
            captureHeaders: config.captureHeaders ?? false,
            sensitiveFields: config.sensitiveFields || [
                'password',
                'token',
                'secret',
                'apiKey',
                'creditCard',
                'ssn',
                'authorization',
            ],
            maskSensitiveData: config.maskSensitiveData !== false,
            asyncLogging: config.asyncLogging ?? true,
            batchSize: config.batchSize || 100,
            retentionPolicies: {
                general: 90,
                auth: 365,
                security: 2555, // 7 years
                compliance: 2555,
                admin: 730, // 2 years
                ...config.retentionPolicies,
            },
            storageBackend: config.storageBackend || 'database',
            ...config,
        };

        this.prisma = prisma || (global as any).prisma || new PrismaClient();
        this.logger = Logger.getInstance();

        // Set up batch flushing for async logging
        if (this.config.asyncLogging) {
            this.flushInterval = setInterval(() => {
                this.flushPendingLogs();
            }, 5000); // Flush every 5 seconds
        }
    }

    /**
     * Get singleton instance
     */
    public static getInstance(config?: AuditServiceConfig, prisma?: PrismaClient): AuditService {
        if (!AuditService.instance) {
            AuditService.instance = new AuditService(config, prisma);
        }
        return AuditService.instance;
    }

    /**
     * Log an audit event
     */
    public async logEvent(data: AuditEventData, context?: AuditContext): Promise<AuditLog | null> {
        if (!this.config.enabled) {
            return null;
        }

        try {
            // Enrich event data with context
            const enrichedData = this.enrichEventData(data, context);

            // Mask sensitive data
            if (this.config.maskSensitiveData) {
                enrichedData.oldData = this.maskSensitiveFields(enrichedData.oldData);
                enrichedData.newData = this.maskSensitiveFields(enrichedData.newData);
                enrichedData.metadata = this.maskSensitiveFields(enrichedData.metadata);
            }

            // Calculate expiration date based on retention policy
            if (!enrichedData.expiresAt) {
                enrichedData.expiresAt = this.calculateExpirationDate(
                    enrichedData.retentionCategory || 'general'
                );
            }

            // Async logging: add to queue
            if (this.config.asyncLogging) {
                this.pendingLogs.push(enrichedData);

                // Flush if batch size reached
                if (this.pendingLogs.length >= (this.config.batchSize || 100)) {
                    await this.flushPendingLogs();
                }

                return null; // Return null for async logging
            }

            // Sync logging: write immediately
            return await this.writeAuditLog(enrichedData);
        } catch (error) {
            this.logger.error('Failed to log audit event', error, { data });
            return null;
        }
    }

    /**
     * Log a data change event (CREATE, UPDATE, DELETE)
     */
    public async logDataChange(
        eventType: AuditEventType.CREATE | AuditEventType.UPDATE | AuditEventType.DELETE,
        resourceType: string,
        resourceId: string,
        oldData: any,
        newData: any,
        context?: AuditContext
    ): Promise<AuditLog | null> {
        const changes = eventType === AuditEventType.UPDATE ? this.computeDiff(oldData, newData) : undefined;

        return this.logEvent(
            {
                eventType,
                category: AuditCategory.DATA,
                action: `${resourceType.toLowerCase()}.${eventType.toLowerCase()}`,
                description: `${eventType} operation on ${resourceType}`,
                resourceType,
                resourceId,
                oldData,
                newData,
                changes,
                status: AuditStatus.SUCCESS,
                severity: AuditSeverity.INFO,
            },
            context
        );
    }

    /**
     * Log an authentication event
     */
    public async logAuthEvent(
        action: 'login' | 'logout' | 'login_failed' | 'token_refresh' | 'password_reset',
        userId?: string,
        success: boolean = true,
        errorMessage?: string,
        context?: AuditContext
    ): Promise<AuditLog | null> {
        return this.logEvent(
            {
                eventType: AuditEventType.AUTH,
                category: AuditCategory.AUTH,
                action: `auth.${action}`,
                description: `User ${action}`,
                ...(userId ? { userId } : {}),
                status: success ? AuditStatus.SUCCESS : AuditStatus.FAILURE,
                ...(errorMessage ? { errorMessage } : {}),
                severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
                retentionCategory: 'auth',
            },
            context
        );
    }

    /**
     * Log a security event
     */
    public async logSecurityEvent(
        action: string,
        severity: AuditSeverity,
        description: string,
        metadata?: Record<string, any>,
        context?: AuditContext
    ): Promise<AuditLog | null> {
        return this.logEvent(
            {
                eventType: AuditEventType.SECURITY,
                category: AuditCategory.SECURITY,
                action,
                description,
                severity,
                ...(metadata ? { metadata } : {}),
                status: AuditStatus.SUCCESS,
                retentionCategory: 'security',
            },
            context
        );
    }

    /**
     * Query audit logs with filters and pagination
     */
    public async queryLogs(
        filter: AuditQueryFilter = {},
        options: AuditQueryOptions = {}
    ): Promise<AuditQueryResult> {
        const {
            limit = 100,
            offset = 0,
            page,
            pageSize = 100,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            includeData = true,
            includeMetadata = true,
        } = options;

        // Calculate pagination
        const actualOffset = page !== undefined ? (page - 1) * pageSize : offset;
        const actualLimit = page !== undefined ? pageSize : limit;

        // Build where clause
        const where: any = {};

        // User filters
        if (filter.userId) where.userId = filter.userId;
        if (filter.userIds) where.userId = { in: filter.userIds };

        // Tenant filters
        if (filter.tenantId) where.tenantId = filter.tenantId;
        if (filter.tenantIds) where.tenantId = { in: filter.tenantIds };

        // Event filters
        if (filter.eventType) where.eventType = filter.eventType;
        if (filter.eventTypes) where.eventType = { in: filter.eventTypes };
        if (filter.category) where.category = filter.category;
        if (filter.categories) where.category = { in: filter.categories };
        if (filter.action) where.action = filter.action;
        if (filter.actions) where.action = { in: filter.actions };

        // Resource filters
        if (filter.resourceType) where.resourceType = filter.resourceType;
        if (filter.resourceId) where.resourceId = filter.resourceId;

        // Status filters
        if (filter.status) where.status = filter.status;
        if (filter.statuses) where.status = { in: filter.statuses };
        if (filter.severity) where.severity = filter.severity;
        if (filter.severities) where.severity = { in: filter.severities };

        // Time range filters
        if (filter.startDate || filter.endDate) {
            where.createdAt = {};
            if (filter.startDate) where.createdAt.gte = filter.startDate;
            if (filter.endDate) where.createdAt.lte = filter.endDate;
        }

        // Tags filter
        if (filter.tags && filter.tags.length > 0) {
            if (filter.hasAllTags) {
                where.tags = { hasEvery: filter.tags };
            } else {
                where.tags = { hasSome: filter.tags };
            }
        }

        // Request context
        if (filter.ipAddress) where.ipAddress = filter.ipAddress;
        if (filter.requestId) where.requestId = filter.requestId;

        // Search term (search in action and description)
        if (filter.searchTerm) {
            where.OR = [
                { action: { contains: filter.searchTerm, mode: 'insensitive' } },
                { description: { contains: filter.searchTerm, mode: 'insensitive' } },
            ];
        }

        // Build select clause
        const select: any = {
            id: true,
            eventType: true,
            category: true,
            action: true,
            description: true,
            userId: true,
            userName: true,
            userEmail: true,
            tenantId: true,
            tenantName: true,
            ipAddress: true,
            userAgent: true,
            requestId: true,
            method: true,
            endpoint: true,
            resourceType: true,
            resourceId: true,
            status: true,
            statusCode: true,
            errorMessage: true,
            tags: true,
            severity: true,
            retentionCategory: true,
            expiresAt: true,
            executionTimeMs: true,
            createdAt: true,
        };

        if (includeData) {
            select.oldData = true;
            select.newData = true;
            select.changes = true;
        }

        if (includeMetadata) {
            select.metadata = true;
        }

        // Execute query
        const [logs, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                select,
                orderBy: { [sortBy]: sortOrder },
                skip: actualOffset,
                take: actualLimit,
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return {
            logs: logs as unknown as AuditLog[],
            total,
            ...(page !== undefined ? { page } : {}),
            ...(pageSize !== undefined ? { pageSize } : {}),
            hasMore: actualOffset + logs.length < total,
        };
    }

    /**
     * Get audit logs for a specific resource
     */
    public async getResourceHistory(
        resourceType: string,
        resourceId: string,
        options: AuditQueryOptions = {}
    ): Promise<AuditLog[]> {
        const result = await this.queryLogs(
            { resourceType, resourceId },
            { ...options, sortOrder: 'asc' }
        );
        return result.logs;
    }

    /**
     * Get audit logs for a specific user
     */
    public async getUserActivity(
        userId: string,
        options: AuditQueryOptions = {}
    ): Promise<AuditLog[]> {
        const result = await this.queryLogs({ userId }, options);
        return result.logs;
    }

    /**
     * Clean up expired audit logs based on retention policies
     */
    public async cleanupExpiredLogs(): Promise<RetentionCleanupResult> {
        const startTime = Date.now();
        const now = new Date();

        const result = await this.prisma.auditLog.deleteMany({
            where: {
                expiresAt: {
                    lte: now,
                },
            },
        });

        return {
            deletedCount: result.count,
            categories: {}, // Could be enhanced to track by category
            executionTimeMs: Date.now() - startTime,
        };
    }

    /**
     * Flush pending logs (for async logging)
     * Public method to support graceful shutdown
     */
    public async flushPendingLogs(): Promise<void> {
        if (this.pendingLogs.length === 0) {
            return;
        }

        const logsToFlush = [...this.pendingLogs];
        this.pendingLogs = [];

        try {
            await this.prisma.auditLog.createMany({
                data: logsToFlush.map(log => ({
                    ...log,
                    status: log.status || AuditStatus.SUCCESS,
                    severity: log.severity || AuditSeverity.INFO,
                })),
                skipDuplicates: true,
            });
        } catch (error) {
            this.logger.error('Failed to flush audit logs', error);
            // Re-add failed logs to queue
            this.pendingLogs.unshift(...logsToFlush);
        }
    }

    /**
     * Write a single audit log to database
     */
    private async writeAuditLog(data: AuditEventData): Promise<AuditLog> {
        return await this.prisma.auditLog.create({
            data: {
                ...data,
                status: data.status || AuditStatus.SUCCESS,
                severity: data.severity || AuditSeverity.INFO,
            },
        }) as AuditLog;
    }

    /**
     * Enrich event data with context information
     */
    private enrichEventData(data: AuditEventData, context?: AuditContext): AuditEventData {
        const enriched = { ...data };

        if (context) {
            // User context
            if (context.user && !enriched.userId) {
                enriched.userId = context.user.id;
                // Note: User type doesn't have 'name' property
                enriched.userEmail = context.user.email;
            }

            // Tenant context
            if (context.tenant && !enriched.tenantId) {
                enriched.tenantId = context.tenant.id;
                enriched.tenantName = context.tenant.name;
            }

            // Request context
            if (context.request) {
                const ipAddress = context.request.ip || context.request.socket?.remoteAddress;
                const userAgent = context.request.headers['user-agent'];

                if (ipAddress && !enriched.ipAddress) enriched.ipAddress = ipAddress;
                if (userAgent && !enriched.userAgent) enriched.userAgent = userAgent;
                if (context.request.method && !enriched.method) enriched.method = context.request.method;
                if (context.request.path && !enriched.endpoint) enriched.endpoint = context.request.path;

                const requestId = (context.request as any).id || context.traceId;
                if (requestId && !enriched.requestId) enriched.requestId = requestId;
            }

            // Merge metadata
            if (context.metadata) {
                enriched.metadata = { ...context.metadata, ...enriched.metadata };
            }
        }

        return enriched;
    }

    /**
     * Mask sensitive fields in data
     */
    private maskSensitiveFields(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const masked = Array.isArray(data) ? [...data] : { ...data };
        const sensitiveFields = this.config.sensitiveFields || [];

        for (const key in masked) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                masked[key] = '***MASKED***';
            } else if (typeof masked[key] === 'object' && masked[key] !== null) {
                masked[key] = this.maskSensitiveFields(masked[key]);
            }
        }

        return masked;
    }

    /**
     * Compute diff between old and new data
     */
    private computeDiff(oldData: any, newData: any): any {
        if (!oldData || !newData) {
            return null;
        }

        const changes: any = {};

        // Simple diff for objects
        if (typeof oldData === 'object' && typeof newData === 'object') {
            const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

            for (const key of allKeys) {
                if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                    changes[key] = {
                        old: oldData[key],
                        new: newData[key],
                    };
                }
            }
        }

        return Object.keys(changes).length > 0 ? changes : null;
    }

    /**
     * Calculate expiration date based on retention category
     */
    private calculateExpirationDate(category: string): Date {
        const retentionDays = (this.config.retentionPolicies as any)[category] ||
            this.config.retentionPolicies?.general ||
            90;

        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + retentionDays);
        return expirationDate;
    }

    /**
     * Cleanup on shutdown
     */
    public async shutdown(): Promise<void> {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        await this.flushPendingLogs();
    }
}
