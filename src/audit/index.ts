/**
 * Audit Trail Module Exports
 * 
 * Central export point for all audit trail functionality
 */

export { AuditService } from './audit-service';
export { AuditReporter } from './audit-reporter';
export { AuditRetentionManager } from './audit-retention';
export { createAuditMiddleware, skipHealthChecks, defaultAuditConfig } from './audit-middleware';

export type {
    AuditEventData,
    AuditLog,
    AuditQueryFilter,
    AuditQueryOptions,
    AuditQueryResult,
    AuditServiceConfig,
    AuditContext,
    AuditReportConfig,
    AuditReport,
    RetentionPolicy,
    RetentionCleanupResult,
} from './audit-types';

export {
    AuditEventType,
    AuditCategory,
    AuditStatus,
    AuditSeverity,
} from './audit-types';
