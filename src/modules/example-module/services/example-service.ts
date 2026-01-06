/**
 * Task Module - Service
 * 
 * This service handles all business logic for task management.
 * It follows the singleton pattern and uses dependency injection for Prisma.
 */

import { PrismaClient } from '@prisma/client';
import {
    CreateTaskInput,
    UpdateTaskInput,
    QueryTasksInput,
    BulkUpdateStatusInput,
    BulkAssignInput,
} from '../validators/example-validators';

// ============================================
// Service Configuration
// ============================================

export interface TaskServiceConfig {
    maxTasksPerUser?: number;
    defaultPriority?: string;
    enableNotifications?: boolean;
}

// ============================================
// Task Service
// ============================================

export class TaskService {
    private static instance: TaskService;
    private config: TaskServiceConfig;
    private prisma: PrismaClient;

    private constructor(config: TaskServiceConfig = {}, prisma?: PrismaClient) {
        this.config = {
            maxTasksPerUser: config.maxTasksPerUser ?? 1000,
            defaultPriority: config.defaultPriority ?? 'MEDIUM',
            enableNotifications: config.enableNotifications ?? true,
        };

        // Use provided Prisma instance or global instance
        this.prisma = prisma ?? (global as any).prisma ?? new PrismaClient();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(config?: TaskServiceConfig, prisma?: PrismaClient): TaskService {
        if (!TaskService.instance) {
            TaskService.instance = new TaskService(config, prisma);
        }
        return TaskService.instance;
    }

    // ============================================
    // CRUD Operations
    // ============================================

    /**
     * Create a new task
     */
    public async createTask(data: CreateTaskInput, userId: string, tenantId: string) {
        // Check user's task limit
        const userTaskCount = await this.prisma.task.count({
            where: {
                createdById: userId,
                status: { not: 'DONE' },
            },
        });

        if (userTaskCount >= (this.config.maxTasksPerUser ?? 1000)) {
            throw new Error(`Task limit reached. Maximum ${this.config.maxTasksPerUser} active tasks allowed.`);
        }

        // Create the task
        const task = await this.prisma.task.create({
            data: {
                ...data,
                createdById: userId,
                tenantId,
                status: data.status ?? 'TODO',
                priority: data.priority ?? this.config.defaultPriority,
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                assignee: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        // Send notification if enabled
        if (this.config.enableNotifications && data.assigneeId) {
            await this.sendTaskAssignedNotification(task.id, data.assigneeId);
        }

        return task;
    }

    /**
     * Get task by ID
     */
    public async getTaskById(taskId: string, tenantId: string) {
        const task = await this.prisma.task.findFirst({
            where: {
                id: taskId,
                tenantId,
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                assignee: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                comments: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        author: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        if (!task) {
            throw new Error('Task not found');
        }

        return task;
    }

    /**
     * Query tasks with filters and pagination
     */
    public async queryTasks(filters: QueryTasksInput, tenantId: string) {
        const {
            status,
            priority,
            assigneeId,
            tags,
            dueBefore,
            dueAfter,
            createdAfter,
            createdBefore,
            search,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = filters;

        // Build where clause
        const where: any = {
            tenantId,
        };

        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (assigneeId) where.assigneeId = assigneeId;

        if (tags) {
            const tagArray = tags.split(',').map(t => t.trim());
            where.tags = { hasSome: tagArray };
        }

        if (dueBefore || dueAfter) {
            where.dueDate = {};
            if (dueBefore) where.dueDate.lte = dueBefore;
            if (dueAfter) where.dueDate.gte = dueAfter;
        }

        if (createdAfter || createdBefore) {
            where.createdAt = {};
            if (createdAfter) where.createdAt.gte = createdAfter;
            if (createdBefore) where.createdAt.lte = createdBefore;
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Execute query with pagination
        const [tasks, total] = await Promise.all([
            this.prisma.task.findMany({
                where,
                include: {
                    createdBy: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                        },
                    },
                    assignee: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.task.count({ where }),
        ]);

        return {
            tasks,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        };
    }

    /**
     * Update a task
     */
    public async updateTask(taskId: string, data: UpdateTaskInput, tenantId: string) {
        // Verify task exists and belongs to brand
        const existingTask = await this.getTaskById(taskId, tenantId);

        // Update the task
        const task = await this.prisma.task.update({
            where: { id: taskId },
            data: {
                ...data,
                updatedAt: new Date(),
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                assignee: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        // Send notification if assignee changed
        if (this.config.enableNotifications && data.assigneeId && data.assigneeId !== existingTask.assigneeId) {
            await this.sendTaskAssignedNotification(task.id, data.assigneeId);
        }

        // Send notification if status changed to DONE
        if (this.config.enableNotifications && data.status === 'DONE' && existingTask.status !== 'DONE') {
            await this.sendTaskCompletedNotification(task.id, existingTask.createdById);
        }

        return task;
    }

    /**
     * Delete a task
     */
    public async deleteTask(taskId: string, tenantId: string) {
        // Verify task exists and belongs to brand
        await this.getTaskById(taskId, tenantId);

        // Soft delete by marking as CANCELLED
        const task = await this.prisma.task.update({
            where: { id: taskId },
            data: {
                status: 'CANCELLED',
                updatedAt: new Date(),
            },
        });

        return task;
    }

    // ============================================
    // Bulk Operations
    // ============================================

    /**
     * Bulk update task status
     */
    public async bulkUpdateStatus(data: BulkUpdateStatusInput, tenantId: string) {
        const { taskIds, status } = data;

        // Verify all tasks belong to the brand
        const tasks = await this.prisma.task.findMany({
            where: {
                id: { in: taskIds },
                tenantId,
            },
        });

        if (tasks.length !== taskIds.length) {
            throw new Error('Some tasks not found or access denied');
        }

        // Update all tasks
        const result = await this.prisma.task.updateMany({
            where: {
                id: { in: taskIds },
                tenantId,
            },
            data: {
                status,
                updatedAt: new Date(),
            },
        });

        return {
            updated: result.count,
            taskIds,
            status,
        };
    }

    /**
     * Bulk assign tasks
     */
    public async bulkAssign(data: BulkAssignInput, tenantId: string) {
        const { taskIds, assigneeId } = data;

        // Verify assignee exists and belongs to brand
        const assignee = await this.prisma.user.findFirst({
            where: {
                id: assigneeId,
                tenantId,
            },
        });

        if (!assignee) {
            throw new Error('Assignee not found or access denied');
        }

        // Verify all tasks belong to the brand
        const tasks = await this.prisma.task.findMany({
            where: {
                id: { in: taskIds },
                tenantId,
            },
        });

        if (tasks.length !== taskIds.length) {
            throw new Error('Some tasks not found or access denied');
        }

        // Assign all tasks
        const result = await this.prisma.task.updateMany({
            where: {
                id: { in: taskIds },
                tenantId,
            },
            data: {
                assigneeId,
                updatedAt: new Date(),
            },
        });

        // Send notification
        if (this.config.enableNotifications) {
            await this.sendBulkAssignmentNotification(taskIds, assigneeId);
        }

        return {
            assigned: result.count,
            taskIds,
            assigneeId,
        };
    }

    // ============================================
    // Task Statistics
    // ============================================

    /**
     * Get task statistics for a brand
     */
    public async getTaskStats(tenantId: string) {
        const [
            totalTasks,
            todoTasks,
            inProgressTasks,
            reviewTasks,
            doneTasks,
            overdueTasks,
        ] = await Promise.all([
            this.prisma.task.count({ where: { tenantId } }),
            this.prisma.task.count({ where: { tenantId, status: 'TODO' } }),
            this.prisma.task.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
            this.prisma.task.count({ where: { tenantId, status: 'REVIEW' } }),
            this.prisma.task.count({ where: { tenantId, status: 'DONE' } }),
            this.prisma.task.count({
                where: {
                    tenantId,
                    status: { notIn: ['DONE', 'CANCELLED'] },
                    dueDate: { lt: new Date() },
                },
            }),
        ]);

        return {
            total: totalTasks,
            byStatus: {
                todo: todoTasks,
                inProgress: inProgressTasks,
                review: reviewTasks,
                done: doneTasks,
            },
            overdue: overdueTasks,
            completionRate: totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0,
        };
    }

    // ============================================
    // Private Helper Methods
    // ============================================

    /**
     * Send task assigned notification (stub - implement with your notification service)
     */
    private async sendTaskAssignedNotification(taskId: string, assigneeId: string) {
        // TODO: Implement notification logic
        console.log(`Notification: Task ${taskId} assigned to user ${assigneeId}`);
    }

    /**
     * Send task completed notification (stub - implement with your notification service)
     */
    private async sendTaskCompletedNotification(taskId: string, creatorId: string) {
        // TODO: Implement notification logic
        console.log(`Notification: Task ${taskId} completed, notifying creator ${creatorId}`);
    }

    /**
     * Send bulk assignment notification (stub - implement with your notification service)
     */
    private async sendBulkAssignmentNotification(taskIds: string[], assigneeId: string) {
        // TODO: Implement notification logic
        console.log(`Notification: ${taskIds.length} tasks assigned to user ${assigneeId}`);
    }
}
