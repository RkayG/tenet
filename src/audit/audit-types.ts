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
    description?: string;

    // Context Information
    userId?: string;
    userName?: string;
    userEmail?: string;
    tenantId?: string;
    tenantName?: string;

    // Request Context
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    method?: string;
    endpoint?: string;

    // Resource Information
    resourceType?: string;
    resourceId?: string;

    // Data Change Tracking
    oldData?: any;
    newData?: any;
    changes?: any;

    // Status and Result
    status?: AuditStatus;
    statusCode?: number;
    errorMessage?: string;

    // Metadata
    metadata?: Record<string, any>;
    tags?: string[];

    // Compliance and Retention
    severity?: AuditSeverity;
    retentionCategory?: string;
    expiresAt?: Date;

    // Performance Tracking
    executionTimeMs?: number;
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
    userId?: string;
    userIds?: string[];
    tenantId?: string;
    tenantIds?: string[];

    // Event filters
    eventType?: AuditEventType;
    eventTypes?: AuditEventType[];
    category?: AuditCategory;
    categories?: AuditCategory[];
    action?: string;
    actions?: string[];

    // Resource filters
    resourceType?: string;
    resourceId?: string;

    // Status filters
    status?: AuditStatus;
    statuses?: AuditStatus[];
    severity?: AuditSeverity;
    severities?: AuditSeverity[];

    // Time range filters
    startDate?: Date;
    endDate?: Date;

    // Search
    searchTerm?: string; // Search in action, description, metadata

    // Tags
    tags?: string[];
    hasAllTags?: boolean; // If true, require all tags; if false, require any tag

    // Request context
    ipAddress?: string;
    requestId?: string;
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
