/**
 * Task Module - Service
 *
 * This service handles all business logic for task management.
 * It follows the singleton pattern and uses dependency injection for Prisma.
 */

import { PrismaClient } from "@prisma/client";
import {
  CreateTaskInput,
  UpdateTaskInput,
  QueryTasksInput,
  BulkUpdateStatusInput,
  BulkAssignInput,
} from "../validators/example-validators";
import { TaskDto, TaskStatsDto, TaskInListDto } from "../dtos/task.dto";

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
      defaultPriority: config.defaultPriority ?? "MEDIUM",
      enableNotifications: config.enableNotifications ?? true,
    };

    // Use provided Prisma instance or global instance
    this.prisma = prisma ?? (global as any).prisma ?? new PrismaClient();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(
    config?: TaskServiceConfig,
    prisma?: PrismaClient,
  ): TaskService {
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
  public async createTask(
    data: CreateTaskInput,
    userId: string,
    tenantId: string,
    prisma?: PrismaClient,
  ): Promise<TaskDto> {
    const db = prisma || this.prisma;

    // Check user's task limit
    const userTaskCount = await db.task.count({
      where: {
        createdById: userId,
        status: { not: "DONE" },
      },
    } as any);

    if (userTaskCount >= (this.config.maxTasksPerUser ?? 1000)) {
      throw new Error(
        `Task limit reached. Maximum ${this.config.maxTasksPerUser} active tasks allowed.`,
      );
    }

    const include: any = {};
    include.createdBy = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };
    include.assignee = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };

    const taskData: any = {
      ...data,
      createdById: userId,
      tenantId,
      status: (data.status ?? "TODO") as any,
      priority: (data.priority ?? this.config.defaultPriority) as any,
    };

    const task = await db.task.create({
      data: taskData,
      include,
    } as any);

    // Send notification if enabled
    if (this.config.enableNotifications && data.assigneeId) {
      await this.sendTaskAssignedNotification(task.id, data.assigneeId);
    }

    return task as unknown as TaskDto;
  }

  /**
   * Get task by ID
   */
  public async getTaskById(
    taskId: string,
    tenantId: string,
    prisma?: PrismaClient,
  ): Promise<TaskDto> {
    const db = prisma || this.prisma;
    const where: any = {};
    where.id = taskId;
    where.tenantId = tenantId;

    const include: any = {};
    include.createdBy = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };
    include.assignee = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };
    include.comments = {
      orderBy: { createdAt: "desc" },
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
    };

    const task = await db.task.findFirst({
      where,
      include,
    } as any);

    if (!task) {
      throw new Error("Task not found");
    }

    return task as unknown as TaskDto;
  }

  /**
   * Query tasks with filters and pagination
   */
  public async queryTasks(
    filters: QueryTasksInput,
    tenantId: string,
    prisma?: PrismaClient,
  ): Promise<{
    tasks: TaskInListDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const db = prisma || this.prisma;
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
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    // Build where clause
    const where: any = {};
    where.tenantId = tenantId;

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;

    if (tags) {
      const tagArray = tags.split(",").map((t) => t.trim());
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
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const include: any = {};
    include.createdBy = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };
    include.assignee = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        include,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      } as any),
      db.task.count({ where } as any),
    ]);

    return {
      tasks: tasks as TaskInListDto[],
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
  public async updateTask(
    taskId: string,
    data: UpdateTaskInput,
    tenantId: string,
    prisma?: PrismaClient,
  ): Promise<TaskDto> {
    const db = prisma || this.prisma;
    // Verify task exists and belongs to brand
    const existingTask = await this.getTaskById(taskId, tenantId, db);

    // Update the task
    const updateData = Object.entries(data).reduce(
      (acc, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
      },
      {} as Record<string, unknown>,
    );

    const include: any = {};
    include.createdBy = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };
    include.assignee = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };

    const task = await db.task.update({
      where: { id: taskId } as any,
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include,
    } as any);

    // Send notification if assignee changed
    if (
      this.config.enableNotifications &&
      data.assigneeId &&
      data.assigneeId !== existingTask.assigneeId
    ) {
      await this.sendTaskAssignedNotification(task.id, data.assigneeId);
    }

    // Send notification if status changed to DONE
    if (
      this.config.enableNotifications &&
      data.status === "DONE" &&
      existingTask.status !== "DONE"
    ) {
      await this.sendTaskCompletedNotification(
        task.id,
        existingTask.createdById,
      );
    }

    return task as unknown as TaskDto;
  }

  /**
   * Delete a task
   */
  public async deleteTask(
    taskId: string,
    tenantId: string,
    prisma?: PrismaClient,
  ): Promise<TaskDto> {
    const db = prisma || this.prisma;
    // Verify task exists and belongs to brand
    await this.getTaskById(taskId, tenantId, db);

    const include: any = {};
    include.createdBy = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };
    include.assignee = {
      select: {
        id: true,
        email: true,
        name: true,
      },
    };

    // Soft delete by marking as CANCELLED
    const task = await db.task.update({
      where: { id: taskId } as any,
      data: {
        status: "CANCELLED" as any,
        updatedAt: new Date(),
      },
      include,
    } as any);

    return task as unknown as TaskDto;
  }

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Bulk update task status
   */
  public async bulkUpdateStatus(
    data: BulkUpdateStatusInput,
    tenantId: string,
    prisma?: PrismaClient,
  ): Promise<{ updated: number; taskIds: string[]; status: string }> {
    const db = prisma || this.prisma;
    const { taskIds, status } = data;

    // Verify all tasks belong to the brand
    const checkWhere: any = {};
    checkWhere.id = { in: taskIds };
    checkWhere.tenantId = tenantId;

    const tasks = await db.task.findMany({
      where: checkWhere,
    } as any);

    if (tasks.length !== taskIds.length) {
      throw new Error("Some tasks not found or access denied");
    }

    const updateWhere: any = {};
    updateWhere.id = { in: taskIds };
    updateWhere.tenantId = tenantId;

    // Update all tasks
    const result = await db.task.updateMany({
      where: updateWhere,
      data: {
        status: status as any,
        updatedAt: new Date(),
      },
    } as any);

    return {
      updated: result.count,
      taskIds,
      status,
    };
  }

  /**
   * Bulk assign tasks
   */
  public async bulkAssign(
    data: BulkAssignInput,
    tenantId: string,
    prisma?: PrismaClient,
  ): Promise<{ assigned: number; taskIds: string[]; assigneeId: string }> {
    const db = prisma || this.prisma;
    const { taskIds, assigneeId } = data;

    const userWhere: any = {};
    userWhere.id = assigneeId;
    userWhere.tenantId = tenantId;

    // Verify assignee exists and belongs to brand
    const assignee = await db.user.findFirst({
      where: userWhere,
    } as any);

    if (!assignee) {
      throw new Error("Assignee not found or access denied");
    }

    // Verify all tasks belong to the brand
    const taskWhere: any = {};
    taskWhere.id = { in: taskIds };
    taskWhere.tenantId = tenantId;

    const tasks = await db.task.findMany({
      where: taskWhere,
    } as any);

    if (tasks.length !== taskIds.length) {
      throw new Error("Some tasks not found or access denied");
    }

    const bulkAssignWhere: any = {};
    bulkAssignWhere.id = { in: taskIds };
    bulkAssignWhere.tenantId = tenantId;

    // Assign all tasks
    const result = await db.task.updateMany({
      where: bulkAssignWhere,
      data: {
        assigneeId,
        updatedAt: new Date(),
      },
    } as any);

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
  public async getTaskStats(
    tenantId: string,
    prisma?: PrismaClient,
  ): Promise<TaskStatsDto> {
    const db = prisma || this.prisma;
    const [
      totalTasks,
      todoTasks,
      inProgressTasks,
      reviewTasks,
      doneTasks,
      overdueTasks,
    ] = await Promise.all([
      db.task.count({ where: { tenantId } } as any),
      db.task.count({ where: { tenantId, status: "TODO" } } as any),
      db.task.count({ where: { tenantId, status: "IN_PROGRESS" } } as any),
      db.task.count({ where: { tenantId, status: "REVIEW" } } as any),
      db.task.count({ where: { tenantId, status: "DONE" } } as any),
      db.task.count({
        where: {
          tenantId,
          status: { notIn: ["DONE", "CANCELLED"] },
          dueDate: { lt: new Date() },
        },
      } as any),
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
  private async sendTaskAssignedNotification(
    taskId: string,
    assigneeId: string,
  ) {
    // TODO: Implement notification logic
    console.log(`Notification: Task ${taskId} assigned to user ${assigneeId}`);
  }

  /**
   * Send task completed notification (stub - implement with your notification service)
   */
  private async sendTaskCompletedNotification(
    taskId: string,
    creatorId: string,
  ) {
    // TODO: Implement notification logic
    console.log(
      `Notification: Task ${taskId} completed, notifying creator ${creatorId}`,
    );
  }

  /**
   * Send bulk assignment notification (stub - implement with your notification service)
   */
  private async sendBulkAssignmentNotification(
    taskIds: string[],
    assigneeId: string,
  ) {
    // TODO: Implement notification logic
    console.log(
      `Notification: ${taskIds.length} tasks assigned to user ${assigneeId}`,
    );
  }
}
