/**
 * Task Module - Validators
 * 
 * This file demonstrates how to create Zod schemas for a Task Management module.
 * All validators are focused on a single domain: Tasks.
 */

import { z } from 'zod';

// ============================================
// Enums and Constants
// ============================================

export const TaskStatus = {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    REVIEW: 'REVIEW',
    DONE: 'DONE',
    CANCELLED: 'CANCELLED',
} as const;

export const TaskPriority = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
} as const;

// ============================================
// Create Task Validator
// ============================================

/**
 * Schema for creating a new task
 * Used in: POST /api/tasks
 */
export const createTaskSchema = z.object({
    title: z.string()
        .min(3, 'Title must be at least 3 characters')
        .max(200, 'Title must not exceed 200 characters')
        .trim(),

    description: z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(5000, 'Description must not exceed 5000 characters')
        .optional(),

    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'], {
        errorMap: () => ({ message: 'Invalid priority level' }),
    }).default('MEDIUM'),

    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'])
        .optional()
        .default('TODO'),

    dueDate: z.coerce.date()
        .min(new Date(), 'Due date must be in the future')
        .optional(),

    assigneeId: z.string()
        .uuid('Invalid assignee ID')
        .optional(),

    tags: z.array(z.string().max(50))
        .max(10, 'Maximum 10 tags allowed')
        .optional()
        .default([]),

    estimatedHours: z.number()
        .positive('Estimated hours must be positive')
        .max(1000, 'Estimated hours must not exceed 1000')
        .optional(),
});

// ============================================
// Update Task Validator
// ============================================

/**
 * Schema for updating an existing task
 * Used in: PATCH /api/tasks/:id
 * All fields are optional for partial updates
 */
export const updateTaskSchema = createTaskSchema.partial().extend({
    // Allow status transitions
    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED']).optional(),

    // Track actual hours spent
    actualHours: z.number()
        .positive('Actual hours must be positive')
        .optional(),

    // Completion percentage
    completionPercentage: z.number()
        .min(0, 'Completion percentage must be at least 0')
        .max(100, 'Completion percentage must not exceed 100')
        .optional(),
});

// ============================================
// Query Tasks Validator
// ============================================

/**
 * Schema for querying/filtering tasks
 * Used in: GET /api/tasks
 */
export const queryTasksSchema = z.object({
    // Filters
    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assigneeId: z.string().uuid().optional(),
    tags: z.string().optional(), // Comma-separated tags

    // Date filters
    dueBefore: z.coerce.date().optional(),
    dueAfter: z.coerce.date().optional(),
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),

    // Search
    search: z.string()
        .max(100, 'Search term must not exceed 100 characters')
        .optional(),

    // Pagination
    page: z.coerce.number()
        .int()
        .positive()
        .default(1),

    limit: z.coerce.number()
        .int()
        .positive()
        .max(100, 'Limit must not exceed 100')
        .default(20),

    // Sorting
    sortBy: z.enum(['title', 'priority', 'dueDate', 'createdAt', 'updatedAt'])
        .default('createdAt'),

    sortOrder: z.enum(['asc', 'desc'])
        .default('desc'),
});

// ============================================
// Bulk Operations Validators
// ============================================

/**
 * Schema for bulk updating task status
 * Used in: PATCH /api/tasks/bulk/status
 */
export const bulkUpdateStatusSchema = z.object({
    taskIds: z.array(z.string().uuid())
        .min(1, 'At least one task ID is required')
        .max(50, 'Maximum 50 tasks can be updated at once'),

    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED']),
});

/**
 * Schema for bulk assigning tasks
 * Used in: PATCH /api/tasks/bulk/assign
 */
export const bulkAssignSchema = z.object({
    taskIds: z.array(z.string().uuid())
        .min(1, 'At least one task ID is required')
        .max(50, 'Maximum 50 tasks can be assigned at once'),

    assigneeId: z.string().uuid('Invalid assignee ID'),
});

// ============================================
// Task Comment Validators
// ============================================

/**
 * Schema for adding a comment to a task
 * Used in: POST /api/tasks/:id/comments
 */
export const createTaskCommentSchema = z.object({
    content: z.string()
        .min(1, 'Comment cannot be empty')
        .max(2000, 'Comment must not exceed 2000 characters')
        .trim(),

    mentions: z.array(z.string().uuid())
        .max(10, 'Maximum 10 mentions allowed')
        .optional()
        .default([]),
});

// ============================================
// Type Inference
// ============================================

/**
 * Infer TypeScript types from Zod schemas
 * These types can be used throughout your module for type safety
 */
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type QueryTasksInput = z.infer<typeof queryTasksSchema>;
export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>;
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
