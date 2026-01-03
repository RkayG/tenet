/**
 * Basic Audit Trail Usage Example
 * 
 * Demonstrates basic audit logging in API handlers
 */

import express from 'express';
import { z } from 'zod';
import { createHandler, createAuthenticatedHandler } from '../../src/core/handler';
import { AuditService, AuditReporter } from '../../src/audit';

const app = express();
app.use(express.json());

// ============================================
// Example 1: Basic Handler with Audit
// ============================================

app.post('/api/projects', createAuthenticatedHandler({
    schema: z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
    }),
    // Enable audit logging
    auditConfig: {
        enabled: true,
        resourceType: 'Project',
        action: 'project.create',
        captureResponseBody: true,
        tags: ['project', 'create'],
        retentionCategory: 'general',
    },
    handler: async ({ input, user, prisma }) => {
        const project = await prisma.project.create({
            data: {
                ...input,
                ownerId: user!.id,
            },
        });

        return project;
    },
}));

// ============================================
// Example 2: Update Handler with Data Change Tracking
// ============================================

app.put('/api/projects/:id', createAuthenticatedHandler({
    schema: z.object({
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
    }),
    requireOwnership: {
        model: 'Project',
        resourceIdParam: 'id',
        ownerIdField: 'ownerId',
    },
    // Track data changes for compliance
    auditConfig: {
        enabled: true,
        resourceType: 'Project',
        action: 'project.update',
        trackDataChanges: true, // Capture before/after state
        captureResponseBody: true,
        tags: ['project', 'update'],
        retentionCategory: 'general',
    },
    handler: async ({ input, params, prisma }) => {
        const project = await prisma.project.update({
            where: { id: params.id },
            data: input,
        });

        return project;
    },
}));

// ============================================
// Example 3: Delete Handler with Audit
// ============================================

app.delete('/api/projects/:id', createAuthenticatedHandler({
    requireOwnership: {
        model: 'Project',
        resourceIdParam: 'id',
        ownerIdField: 'ownerId',
    },
    auditConfig: {
        enabled: true,
        resourceType: 'Project',
        action: 'project.delete',
        trackDataChanges: true, // Capture what was deleted
        tags: ['project', 'delete'],
        retentionCategory: 'compliance', // Keep for 7 years
    },
    handler: async ({ params, prisma }) => {
        await prisma.project.delete({
            where: { id: params.id },
        });

        return { success: true };
    },
}));

// ============================================
// Example 4: Query Audit Logs
// ============================================

app.get('/api/admin/audit-logs', createAuthenticatedHandler({
    allowedRoles: ['admin'],
    schema: z.object({
        userId: z.string().optional(),
        eventType: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
    }),
    handler: async ({ input }) => {
        const auditService = AuditService.getInstance();

        const result = await auditService.queryLogs(
            {
                userId: input.userId,
                eventType: input.eventType as any,
                startDate: input.startDate ? new Date(input.startDate) : undefined,
                endDate: input.endDate ? new Date(input.endDate) : undefined,
            },
            {
                page: input.page,
                pageSize: input.pageSize,
            }
        );

        return result;
    },
}));

// ============================================
// Example 5: Generate Audit Report
// ============================================

app.get('/api/admin/audit-reports/user-activity/:userId', createAuthenticatedHandler({
    allowedRoles: ['admin'],
    schema: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
    }),
    handler: async ({ params, input }) => {
        const reporter = AuditReporter.getInstance();

        const report = await reporter.generateUserActivityReport(
            params.userId,
            input.startDate ? new Date(input.startDate) : undefined,
            input.endDate ? new Date(input.endDate) : undefined
        );

        return report;
    },
}));

// ============================================
// Example 6: Export Audit Logs to CSV
// ============================================

app.get('/api/admin/audit-logs/export/csv', createAuthenticatedHandler({
    allowedRoles: ['admin'],
    schema: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
    }),
    handler: async ({ input, request }) => {
        const reporter = AuditReporter.getInstance();

        const csv = await reporter.exportToCSV({
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
        });

        // Set response headers for CSV download
        (request as any).res.setHeader('Content-Type', 'text/csv');
        (request as any).res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');

        return csv;
    },
}));

// ============================================
// Example 7: Manual Audit Logging
// ============================================

app.post('/api/sensitive-action', createAuthenticatedHandler({
    handler: async ({ user }) => {
        const auditService = AuditService.getInstance();

        // Manually log a custom audit event
        await auditService.logSecurityEvent(
            'sensitive_action.executed',
            'CRITICAL' as any,
            'User performed sensitive administrative action',
            {
                actionType: 'data_export',
                recordCount: 1000,
            },
            {
                user,
            }
        );

        // Perform the sensitive action
        // ...

        return { success: true };
    },
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Audit trail enabled for all handlers');
});
