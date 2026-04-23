/**
 * Shared Schema Tenant Strategy
 * 
 * All tenants share the same database schema with tenantId filtering.
 * This is the simplest and most cost-effective approach but provides the least isolation.
 * 
 * Pros:
 * - Simple to implement and maintain
 * - Cost-effective (single database)
 * - Easy schema updates
 * 
 * Cons:
 * - Shared infrastructure requires careful resource management
 * - Potential for data leakage if auto-scoping is bypassed
 * - All tenants affected by shared database maintenance
 */

import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../../core/types';
import { TenantStrategy } from '../manager';

export interface SharedSchemaConfig {
  prismaClient: PrismaClient;
  tenantIdField?: string;
  cacheTtl?: number;
}

export class SharedSchemaStrategy implements TenantStrategy {
  public readonly name = 'shared_schema';
  private prismaClient: PrismaClient;
  private tenantIdField: string;
  private tenantCache: Map<string, TenantContext> = new Map();
  private cacheTtl: number;

  constructor(config: SharedSchemaConfig) {
    this.prismaClient = config.prismaClient;
    this.tenantIdField = config.tenantIdField || 'tenantId';
    this.cacheTtl = config.cacheTtl || 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Get Prisma client for tenant
   * In shared schema, all tenants use the same Prisma client
   */
  public async getPrismaClient(tenantId: string): Promise<PrismaClient> {
    // Validate tenant exists
    await this.validateTenant(tenantId);
    
    // Return the shared Prisma client
    // Note: Automatic tenant filtering is applied via the TenantManager/Handler lifecycle using Prisma Client Extensions.
    return this.prismaClient;
  }

  /**
   * Resolve tenant ID from request
   */
  public async resolveTenantId(request: Request): Promise<string | null> {
    // Try to get from URL params (e.g., /api/tenants/:tenantId/...)
    if (request.params.tenantId) {
      return request.params.tenantId;
    }

    // Try to get from query params
    if (request.query.tenantId && typeof request.query.tenantId === 'string') {
      return request.query.tenantId;
    }

    // Try to get from user context (if authenticated)
    const user = (request as any).user;
    if (user && user.tenantId) {
      return user.tenantId;
    }

    return null;
  }

  /**
   * Validate if tenant exists and is active
   */
  public async validateTenant(tenantId: string): Promise<boolean> {
    try {
      // Check if tenant exists in the database
      const tenant = await (this.prismaClient as any).tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, isActive: true },
      });

      return tenant && tenant.isActive;
    } catch (error) {
      console.error(`Error validating tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Get tenant context
   */
  public async getTenantContext(tenantId: string): Promise<TenantContext | null> {
    // Check cache first
    const cached = this.tenantCache.get(tenantId);
    if (cached) {
      return cached;
    }

    try {
      // Fetch tenant from database
      const tenant = await (this.prismaClient as any).tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          config: true,
          isActive: true,
        },
      });

      if (!tenant || !tenant.isActive) {
        return null;
      }

      const context: TenantContext = {
        id: tenant.id,
        name: tenant.name,
        config: tenant.config || {},
      };

      // Cache the context
      this.tenantCache.set(tenantId, context);

      // Set up cache expiry
      setTimeout(() => {
        this.tenantCache.delete(tenantId);
      }, this.cacheTtl);

      return context;
    } catch (error) {
      console.error(`Error fetching tenant context for ${tenantId}:`, error);
      return null;
    }
  }


  /**
   * Clear tenant cache
   */
  public clearCache(tenantId?: string): void {
    if (tenantId) {
      this.tenantCache.delete(tenantId);
    } else {
      this.tenantCache.clear();
    }
  }

  /**
   * Get tenant ID field name
   */
  public getTenantIdField(): string {
    return this.tenantIdField;
  }
}
