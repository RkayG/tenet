/**
 * Audit Reporter
 * 
 * Generate compliance reports and export audit logs in various formats
 */

import { AuditService } from './audit-service';
import {
    AuditLog,
    AuditQueryFilter,
    AuditReport,
    AuditReportConfig,
    AuditEventType,
    AuditCategory,
} from './audit-types';

export class AuditReporter {
    private static instance: AuditReporter;
    private auditService: AuditService;

    private constructor() {
        this.auditService = AuditService.getInstance();
    }

    public static getInstance(): AuditReporter {
        if (!AuditReporter.instance) {
            AuditReporter.instance = new AuditReporter();
        }
        return AuditReporter.instance;
    }

    /**
     * Generate an audit report
     */
    public async generateReport(config: AuditReportConfig): Promise<AuditReport> {
        const logs = await this.fetchLogsForReport(config.filter);

        const report: AuditReport = {
            config,
            generatedAt: new Date(),
            logs,
        };

        if (config.includeStats) {
            report.stats = this.calculateStats(logs);
        }

        if (config.includeSummary) {
            report.summary = this.generateSummary(config.type, logs);
        }

        return report;
    }

    /**
     * Export audit logs to CSV format
     */
    public async exportToCSV(filter: AuditQueryFilter = {}): Promise<string> {
        const result = await this.auditService.queryLogs(filter, { limit: 10000 });
        const logs = result.logs;

        if (logs.length === 0) {
            return 'No audit logs found';
        }

        // CSV headers
        const headers = [
            'ID',
            'Timestamp',
            'Event Type',
            'Category',
            'Action',
            'User ID',
            'User Email',
            'Tenant ID',
            'Resource Type',
            'Resource ID',
            'Status',
            'IP Address',
            'Description',
        ];

        const rows = logs.map(log => [
            log.id,
            log.createdAt.toISOString(),
            log.eventType,
            log.category,
            log.action,
            log.userId || '',
            log.userEmail || '',
            log.tenantId || '',
            log.resourceType || '',
            log.resourceId || '',
            log.status,
            log.ipAddress || '',
            log.description || '',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        return csvContent;
    }

    /**
     * Export audit logs to JSON format
     */
    public async exportToJSON(filter: AuditQueryFilter = {}): Promise<string> {
        const result = await this.auditService.queryLogs(filter, { limit: 10000 });
        return JSON.stringify(result.logs, null, 2);
    }

    /**
     * Generate user activity report
     */
    public async generateUserActivityReport(
        userId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<AuditReport> {
        return this.generateReport({
            type: 'user_activity',
            filter: {
                userId,
                startDate,
                endDate,
            },
            includeStats: true,
            includeSummary: true,
        });
    }

    /**
     * Generate security report (failed auth, suspicious activity)
     */
    public async generateSecurityReport(
        startDate?: Date,
        endDate?: Date
    ): Promise<AuditReport> {
        return this.generateReport({
            type: 'security',
            filter: {
                categories: [AuditCategory.SECURITY, AuditCategory.AUTH],
                startDate,
                endDate,
            },
            includeStats: true,
            includeSummary: true,
        });
    }

    /**
     * Generate compliance report (all events for a time period)
     */
    public async generateComplianceReport(
        startDate: Date,
        endDate: Date,
        tenantId?: string
    ): Promise<AuditReport> {
        return this.generateReport({
            type: 'compliance',
            filter: {
                startDate,
                endDate,
                tenantId,
            },
            includeStats: true,
            includeSummary: true,
        });
    }

    /**
     * Generate data changes report (CREATE, UPDATE, DELETE events)
     */
    public async generateDataChangesReport(
        resourceType?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<AuditReport> {
        return this.generateReport({
            type: 'data_changes',
            filter: {
                eventTypes: [AuditEventType.CREATE, AuditEventType.UPDATE, AuditEventType.DELETE],
                resourceType,
                startDate,
                endDate,
            },
            includeStats: true,
            includeSummary: true,
        });
    }

    /**
     * Fetch logs for report
     */
    private async fetchLogsForReport(filter: AuditQueryFilter): Promise<AuditLog[]> {
        const result = await this.auditService.queryLogs(filter, {
            limit: 10000,
            includeData: true,
            includeMetadata: true,
        });
        return result.logs;
    }

    /**
     * Calculate statistics for logs
     */
    private calculateStats(logs: AuditLog[]) {
        const eventsByType: Record<string, number> = {};
        const eventsByCategory: Record<string, number> = {};
        const eventsByStatus: Record<string, number> = {};
        const uniqueUsers = new Set<string>();
        const uniqueTenants = new Set<string>();

        let minDate = new Date();
        let maxDate = new Date(0);

        for (const log of logs) {
            // Event types
            eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;

            // Categories
            eventsByCategory[log.category] = (eventsByCategory[log.category] || 0) + 1;

            // Status
            eventsByStatus[log.status] = (eventsByStatus[log.status] || 0) + 1;

            // Users
            if (log.userId) uniqueUsers.add(log.userId);

            // Tenants
            if (log.tenantId) uniqueTenants.add(log.tenantId);

            // Date range
            if (log.createdAt < minDate) minDate = log.createdAt;
            if (log.createdAt > maxDate) maxDate = log.createdAt;
        }

        return {
            totalEvents: logs.length,
            eventsByType,
            eventsByCategory,
            eventsByStatus,
            uniqueUsers: uniqueUsers.size,
            uniqueTenants: uniqueTenants.size,
            dateRange: {
                start: minDate,
                end: maxDate,
            },
        };
    }

    /**
     * Generate summary text for report
     */
    private generateSummary(type: string, logs: AuditLog[]): string {
        const stats = this.calculateStats(logs);

        switch (type) {
            case 'user_activity':
                return `User activity report containing ${stats.totalEvents} events. ` +
                    `Event breakdown: ${Object.entries(stats.eventsByType).map(([k, v]) => `${k}: ${v}`).join(', ')}`;

            case 'security':
                return `Security report containing ${stats.totalEvents} security-related events. ` +
                    `${stats.eventsByStatus.FAILURE || 0} failed events detected.`;

            case 'compliance':
                return `Compliance report for ${stats.uniqueTenants} tenant(s) with ${stats.totalEvents} total events ` +
                    `from ${stats.dateRange.start.toISOString()} to ${stats.dateRange.end.toISOString()}`;

            case 'data_changes':
                return `Data changes report showing ${stats.totalEvents} modifications. ` +
                    `Breakdown: ${Object.entries(stats.eventsByType).map(([k, v]) => `${k}: ${v}`).join(', ')}`;

            default:
                return `Audit report containing ${stats.totalEvents} events`;
        }
    }
}
