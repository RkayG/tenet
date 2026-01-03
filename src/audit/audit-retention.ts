/**
 * Audit Retention Manager
 * 
 * Manage audit log retention policies and automatic cleanup
 */

import { AuditService } from './audit-service';
import { RetentionPolicy, RetentionCleanupResult } from './audit-types';
import { Logger } from '../utils/logger';

export class AuditRetentionManager {
    private static instance: AuditRetentionManager;
    private auditService: AuditService;
    private logger: Logger;
    private cleanupInterval?: NodeJS.Timeout;

    private constructor() {
        this.auditService = AuditService.getInstance();
        this.logger = Logger.getInstance();
    }

    public static getInstance(): AuditRetentionManager {
        if (!AuditRetentionManager.instance) {
            AuditRetentionManager.instance = new AuditRetentionManager();
        }
        return AuditRetentionManager.instance;
    }

    /**
     * Start automatic cleanup scheduler
     */
    public startAutomaticCleanup(intervalHours: number = 24): void {
        if (this.cleanupInterval) {
            this.logger.warn('Automatic cleanup already running');
            return;
        }

        this.logger.info(`Starting automatic audit log cleanup (every ${intervalHours} hours)`);

        // Run immediately
        this.runCleanup();

        // Schedule periodic cleanup
        this.cleanupInterval = setInterval(
            () => this.runCleanup(),
            intervalHours * 60 * 60 * 1000
        );
    }

    /**
     * Stop automatic cleanup scheduler
     */
    public stopAutomaticCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
            this.logger.info('Stopped automatic audit log cleanup');
        }
    }

    /**
     * Run cleanup job
     */
    public async runCleanup(): Promise<RetentionCleanupResult> {
        this.logger.info('Running audit log cleanup');

        try {
            const result = await this.auditService.cleanupExpiredLogs();

            this.logger.info('Audit log cleanup completed', {
                deletedCount: result.deletedCount,
                executionTimeMs: result.executionTimeMs,
            });

            return result;
        } catch (error) {
            this.logger.error('Audit log cleanup failed', error);
            throw error;
        }
    }

    /**
     * Get default retention policies
     */
    public getDefaultPolicies(): RetentionPolicy[] {
        return [
            {
                category: 'general',
                retentionDays: 90,
                description: 'General audit logs retained for 90 days',
            },
            {
                category: 'auth',
                retentionDays: 365,
                description: 'Authentication logs retained for 1 year',
            },
            {
                category: 'security',
                retentionDays: 2555,
                description: 'Security logs retained for 7 years (compliance)',
            },
            {
                category: 'compliance',
                retentionDays: 2555,
                description: 'Compliance logs retained for 7 years',
            },
            {
                category: 'admin',
                retentionDays: 730,
                description: 'Administrative action logs retained for 2 years',
            },
        ];
    }
}
