/**
 * Task Module - Routes
 * 
 * This file demonstrates how to create Express routes using the framework's
 * specific handler wrappers (Tenant, Admin, Public) rather than createHandler directly.
 */

import { Router } from 'express';
import {
    createTenantHandler,
    createPublicHandler
} from '../../../core/handler';
import { TaskService } from '../services/example-service';
import {
    createTaskSchema,
    updateTaskSchema,
    queryTasksSchema,
    bulkUpdateStatusSchema,
    bulkAssignSchema,
} from '../validators/example-validators';
import { AuditCategory } from '../../../audit/audit-types';

const router: Router = Router();

// Initialize service
const taskService = TaskService.getInstance();

// ============================================
// Task CRUD Routes
// ============================================

/**
 * GET /api/tasks
 * Query tasks with filters and pagination
 * Automatically requires authentication and enforces multitenancy
 */
router.get(
    '/tasks',
    createTenantHandler({
        schema: queryTasksSchema,
        handler: async ({ input, user }) => {
            // tenant_id is guaranteed by createTenantHandler
            // user! is used because TypeScript doesn't know createTenantHandler guarantees existence
            const result = await taskService.queryTasks(input, user!.tenant_id);
            return result;
        },
        auditConfig: {
            enabled: true,
            category: AuditCategory.DATA,
            action: 'task.list',
        },
    })
);

/**
 * GET /api/tasks/:id
 * Get a single task by ID
 * Automatically requires authentication, multitenancy, and ownership verification
 */
router.get(
    '/tasks/:id',
    createTenantHandler({
        requireOwnership: {
            model: 'Task',
            resourceIdParam: 'id',
            ownerIdField: 'tenantId',
        },
        handler: async ({ resource }) => {
            // Resource is already verified and loaded by requireOwnership
            return resource;
        },
        auditConfig: {
            enabled: true,
            category: AuditCategory.DATA,
            action: 'task.view',
            resourceType: 'Task',
        },
    })
);

/**
 * POST /api/tasks
 * Create a new task
 */
router.post(
    '/tasks',
    createTenantHandler({
        schema: createTaskSchema,
        handler: async ({ input, user }) => {
            const task = await taskService.createTask(input, user!.id, user!.tenant_id);
            return task;
        },
        successStatus: 201,
        auditConfig: {
            enabled: true,
            category: AuditCategory.DATA,
            action: 'task.create',
            resourceType: 'Task',
            captureResponseBody: true,
        },
    })
);

/**
 * PATCH /api/tasks/:id
 * Update an existing task
 */
router.patch(
    '/tasks/:id',
    createTenantHandler({
        schema: updateTaskSchema,
        requireOwnership: {
            model: 'Task',
            resourceIdParam: 'id',
            ownerIdField: 'tenantId',
        },
        handler: async ({ input, params, user }) => {
            const task = await taskService.updateTask(params.id, input, user!.tenant_id);
            return task;
        },
        auditConfig: {
            enabled: true,
            category: AuditCategory.DATA,
            action: 'task.update',
            resourceType: 'Task',
            trackDataChanges: true,
            captureResponseBody: true,
        },
    })
);

/**
 * DELETE /api/tasks/:id
 * Delete a task (soft delete)
 */
router.delete(
    '/tasks/:id',
    createTenantHandler({
        requireOwnership: {
            model: 'Task',
            resourceIdParam: 'id',
            ownerIdField: 'tenantId',
        },
        handler: async ({ params, user }) => {
            const task = await taskService.deleteTask(params.id, user!.tenant_id);
            return { message: 'Task deleted successfully', task };
        },
        auditConfig: {
            enabled: true,
            category: AuditCategory.DATA,
            action: 'task.delete',
            resourceType: 'Task',
            trackDataChanges: true,
        },
    })
);

// ============================================
// Bulk Operations Routes
// ============================================

/**
 * PATCH /api/tasks/bulk/status
 * Bulk update task status
 */
router.patch(
    '/tasks/bulk/status',
    createTenantHandler({
        schema: bulkUpdateStatusSchema,
        handler: async ({ input, user }) => {
            const result = await taskService.bulkUpdateStatus(input, user!.tenant_id);
            return result;
        },
        auditConfig: {
            enabled: true,
            category: AuditCategory.DATA,
            action: 'task.bulk_update_status',
            metadata: { operation: 'bulk_status_update' },
        },
    })
);


// ============================================
// Statistics Routes
// ============================================

/**
 * GET /api/tasks/stats
 * Get task statistics for the current tenant
 */
router.get(
    '/tasks/stats',
    createTenantHandler({
        cache: {
            ttl: 300, // Cache for 5 minutes
        },
        handler: async ({ user }) => {
            const stats = await taskService.getTaskStats(user!.tenant_id);
            return stats;
        },
        auditConfig: {
            enabled: false,
        },
    })
);

// ============================================
// Public Routes (Demo)
// ============================================

/**
 * GET /api/tasks/public/stats
 * Get public task statistics (demo endpoint)
 * Uses createPublicHandler to signify no auth required
 */
router.get(
    '/tasks/public/stats',
    createPublicHandler({
        handler: async () => {
            return {
                message: 'This is a public endpoint example using createPublicHandler',
                note: 'No authentication required',
                features: {
                    rateLimiting: 'Recommended for public endpoints',
                },
            };
        },
        cache: {
            ttl: 3600,
        },
        rateLimit: {
            windowMs: 60000,
            maxRequests: 50,
        },
    })
);

export default router;
