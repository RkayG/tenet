/**
 * Advanced Audit Trail Usage Example
 * 
 * Demonstrates advanced features: custom middleware, retention policies, and multi-tenant isolation
 */

import express from 'express';
import { createAuditMiddleware, skipHealthChecks } from '../../src/audit/audit-middleware';
import { AuditService } from '../../src/audit/audit-service';
import { AuditRetentionManager } from '../../src/audit/audit-retention';
import { AuditReporter } from '../../src/audit/audit-reporter';

const app = express();
app.use(express.json());

// ============================================
// Example 1: Global Audit Middleware
// ============================================

// Apply audit middleware to all routes
app.use(createAuditMiddleware({
    enabled: true,
    skipPathPatterns: skipHealthChecks,
    captureQueryParams: true,
    captureRequestBody: false, // Don't capture sensitive data
    captureResponseBody: false,
}));

// ============================================
// Example 2: Custom Audit Service Configuration
// ============================================

const auditService = AuditService.getInstance({
    enabled: true,
    autoLogAuth: true,
    autoLogCRUD: true,
    autoLogSecurity: true,
    maskSensitiveData: true,
    sensitiveFields: [
        'password',
        'token',
        'secret',
        'apiKey',
        'creditCard',
        'ssn',
        'authorization',
        'bankAccount',
    ],
    asyncLogging: true,
    batchSize: 100,
    retentionPolicies: {
        general: 90, // 90 days
        auth: 365, // 1 year
        security: 2555, // 7 years
        compliance: 2555, // 7 years
        admin: 730, // 2 years
    },
});

// ============================================
// Example 3: Automatic Retention Cleanup
// ============================================

const retentionManager = AuditRetentionManager.getInstance();

// Start automatic cleanup (runs every 24 hours)
retentionManager.startAutomaticCleanup(24);

// Manual cleanup
app.post('/api/admin/audit/cleanup', async (req, res) => {
    try {
        const result = await retentionManager.runCleanup();
        res.json({
            success: true,
            deletedCount: result.deletedCount,
            executionTimeMs: result.executionTimeMs,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// Example 4: Multi-Tenant Audit Isolation
// ============================================

app.get('/api/tenant/:tenantId/audit-logs', async (req, res) => {
    const { tenantId } = req.params;
    const { startDate, endDate } = req.query;

    const result = await auditService.queryLogs(
        {
            tenantId,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
        },
        {
            limit: 100,
            sortOrder: 'desc',
        }
    );

    res.json(result);
});

// ============================================
// Example 5: Compliance Reports
// ============================================

app.get('/api/admin/compliance-report', async (req, res) => {
    const reporter = AuditReporter.getInstance();

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // Last month

    const report = await reporter.generateComplianceReport(
        startDate,
        new Date(),
        req.query.tenantId as string | undefined
    );

    res.json(report);
});

// ============================================
// Example 6: Security Monitoring
// ============================================

app.get('/api/admin/security-report', async (req, res) => {
    const reporter = AuditReporter.getInstance();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    const report = await reporter.generateSecurityReport(startDate, new Date());

    res.json(report);
});

// ============================================
// Example 7: Resource History Tracking
// ============================================

app.get('/api/projects/:id/history', async (req, res) => {
    const { id } = req.params;

    const history = await auditService.getResourceHistory('Project', id, {
        sortOrder: 'asc',
        includeData: true,
    });

    res.json({
        resourceId: id,
        resourceType: 'Project',
        history,
    });
});

// ============================================
// Example 8: User Activity Timeline
// ============================================

app.get('/api/users/:userId/activity', async (req, res) => {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const activity = await auditService.getUserActivity(userId, {
        limit: Number(limit),
        sortOrder: 'desc',
    });

    res.json({
        userId,
        activity,
    });
});

// ============================================
// Example 9: Export Audit Logs
// ============================================

app.get('/api/admin/audit-logs/export', async (req, res) => {
    const reporter = AuditReporter.getInstance();
    const { format = 'json', ...filters } = req.query;

    let content: string;
    let contentType: string;
    let filename: string;

    if (format === 'csv') {
        content = await reporter.exportToCSV(filters as any);
        contentType = 'text/csv';
        filename = 'audit-logs.csv';
    } else {
        content = await reporter.exportToJSON(filters as any);
        contentType = 'application/json';
        filename = 'audit-logs.json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(content);
});

// ============================================
// Example 10: Graceful Shutdown
// ============================================

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');

    // Stop retention cleanup
    retentionManager.stopAutomaticCleanup();

    // Flush pending audit logs
    await auditService.shutdown();

    process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Advanced audit trail features enabled');
});
