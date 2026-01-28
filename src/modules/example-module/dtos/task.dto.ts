/**
 * Task Module - Data Transfer Objects (DTOs)
 * 
 * This file defines the output structures for the Task module.
 */



/**
 * User summary information included in other DTOs
 */
export interface UserSummaryDto {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
}

/**
 * Comment DTO
 */
export interface TaskCommentDto {
    id: string;
    content: string;
    author: UserSummaryDto;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Main Task DTO
 */
export interface TaskDto {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    projectId: string;
    dueDate?: Date | null;
    tags: string[];
    estimatedHours?: number | null;
    actualHours?: number | null;
    completionPercentage: number;
    createdById: string;
    createdBy: UserSummaryDto;
    assigneeId?: string | null;
    assignee?: UserSummaryDto | null;
    tenantId: string;
    createdAt: Date;
    updatedAt: Date;
    comments?: TaskCommentDto[];
}

/**
 * Simplified Task DTO for list views
 */
export interface TaskInListDto {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: Date | null;
    assignee?: UserSummaryDto | null;
    createdAt: Date;
}

/**
 * Task Statistics DTO
 */
export interface TaskStatsDto {
    total: number;
    byStatus: {
        todo: number;
        inProgress: number;
        review: number;
        done: number;
    };
    overdue: number;
    completionRate: number;
}
