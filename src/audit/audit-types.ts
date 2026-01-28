/**
 * Audit Trail Type Definitions
 * 
 * Comprehensive type definitions for the audit trail system
 */

import { Request } from 'express';
import { User, TenantContext } from '../core/types';

// ============================================
// Audit Event Types (matching Prisma enums)
// ============================================

export enum AuditEventType {
    CREATE = 'CREATE',
    READ = 'READ',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    AUTH = 'AUTH',
    AUTHZ = 'AUTHZ',
    SECURITY = 'SECURITY',
    SYSTEM = 'SYSTEM',
    EXPORT = 'EXPORT',
    IMPORT = 'IMPORT',
    CONFIG = 'CONFIG',
    CUSTOM = 'CUSTOM',
}

export enum AuditCategory {
    DATA = 'DATA',
    AUTH = 'AUTH',
    SECURITY = 'SECURITY',
    SYSTEM = 'SYSTEM',
    COMPLIANCE = 'COMPLIANCE',
    ADMIN = 'ADMIN',
    USER = 'USER',
}

export enum AuditStatus {
    SUCCESS = 'SUCCESS',
    FAILURE = 'FAILURE',
    PARTIAL = 'PARTIAL',
    PENDING = 'PENDING',
}

export enum AuditSeverity {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    NOTICE = 'NOTICE',
    WARNING = 'WARNING',
    ERROR = 'ERROR',
    CRITICAL = 'CRITICAL',
    ALERT = 'ALERT',
    EMERGENCY = 'EMERGENCY',
}

// ============================================
// Audit Event Interfaces
// ============================================

export interface AuditEventData {
    // Event Information
    eventType: AuditEventType;
    category: AuditCategory;
    action: string;
    description?: string | undefined;
    userId?: string | undefined;
    userName?: string | undefined;
    userEmail?: string | undefined;
    tenantId?: string | undefined;
    tenantName?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    requestId?: string | undefined;
    method?: string | undefined;
    endpoint?: string | undefined;
    resourceType?: string | undefined;
    resourceId?: string | undefined;
    oldData?: any | undefined;
    newData?: any | undefined;
    changes?: any | undefined;
    status?: AuditStatus | undefined;
    statusCode?: number | undefined;
    errorMessage?: string | undefined;
    metadata?: Record<string, any> | undefined;
    tags?: string[] | undefined;
    severity?: AuditSeverity | undefined;
    retentionCategory?: string | undefined;
    expiresAt?: Date | undefined;
    executionTimeMs?: number | undefined;
}

export interface AuditLog extends AuditEventData {
    id: string;
    createdAt: Date;
}

// ============================================
// Query and Filter Interfaces
// ============================================

export interface AuditQueryFilter {
    // User and Tenant filters
    userId?: string | undefined;
    userIds?: string[] | undefined;
    tenantId?: string | undefined;
    tenantIds?: string[] | undefined;
    eventType?: AuditEventType | undefined;
    eventTypes?: AuditEventType[] | undefined;
    category?: AuditCategory | undefined;
    categories?: AuditCategory[] | undefined;
    action?: string | undefined;
    actions?: string[] | undefined;
    resourceType?: string | undefined;
    resourceId?: string | undefined;
    status?: AuditStatus | undefined;
    statuses?: AuditStatus[] | undefined;
    severity?: AuditSeverity | undefined;
    severities?: AuditSeverity[] | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    searchTerm?: string | undefined;
    tags?: string[] | undefined;
    hasAllTags?: boolean | undefined;
    ipAddress?: string | undefined;
    requestId?: string | undefined;
}

export interface AuditQueryOptions {
    // Pagination
    limit?: number;
    offset?: number;
    page?: number;
    pageSize?: number;

    // Sorting
    sortBy?: 'createdAt' | 'eventType' | 'category' | 'severity' | 'status';
    sortOrder?: 'asc' | 'desc';

    // Field selection
    includeData?: boolean; // Include oldData/newData/changes
    includeMetadata?: boolean;
}

export interface AuditQueryResult {
    logs: AuditLog[];
    total: number;
    page?: number;
    pageSize?: number;
    hasMore: boolean;
}

// ============================================
// Service Configuration
// ============================================

export interface AuditServiceConfig {
    // Enable/disable audit logging
    enabled?: boolean;

    // Automatic logging
    autoLogAuth?: boolean;
    autoLogCRUD?: boolean;
    autoLogSecurity?: boolean;

    // Data capture
    captureRequestBody?: boolean;
    captureResponseBody?: boolean;
    captureHeaders?: boolean;

    // Sensitive data masking
    sensitiveFields?: string[];
    maskSensitiveData?: boolean;

    // Performance
    asyncLogging?: boolean; // Log asynchronously to avoid blocking
    batchSize?: number; // Batch audit logs for bulk insert

    // Retention policies (in days)
    retentionPolicies?: {
        general?: number; // Default: 90 days
        auth?: number; // Default: 365 days
        security?: number; // Default: 2555 days (7 years)
        compliance?: number; // Default: 2555 days (7 years)
        admin?: number; // Default: 730 days (2 years)
    };

    // Storage
    storageBackend?: 'database' | 'file' | 'external';
    externalServiceUrl?: string;
}

// ============================================
// Context Capture Helpers
// ============================================

export interface AuditContext {
    user?: User | null;
    tenant?: TenantContext | undefined;
    request?: Request;
    traceId?: string;
    metadata?: Record<string, any>;
}

// ============================================
// Report Types
// ============================================

export interface AuditReportConfig {
    // Report type
    type: 'user_activity' | 'security' | 'compliance' | 'data_changes' | 'custom';

    // Filters
    filter: AuditQueryFilter;

    // Format
    format?: 'json' | 'csv' | 'pdf';

    // Grouping
    groupBy?: 'user' | 'tenant' | 'eventType' | 'category' | 'date';

    // Aggregations
    includeStats?: boolean;
    includeSummary?: boolean;
}

export interface AuditReport {
    config: AuditReportConfig;
    generatedAt: Date;
    logs: AuditLog[];
    stats?: {
        totalEvents: number;
        eventsByType: Record<string, number>;
        eventsByCategory: Record<string, number>;
        eventsByStatus: Record<string, number>;
        uniqueUsers: number;
        uniqueTenants: number;
        dateRange: {
            start: Date;
            end: Date;
        };
    };
    summary?: string;
}

// ============================================
// Retention Management
// ============================================

export interface RetentionPolicy {
    category: string;
    retentionDays: number;
    description?: string;
}

export interface RetentionCleanupResult {
    deletedCount: number;
    categories: Record<string, number>;
    executionTimeMs: number;
}
