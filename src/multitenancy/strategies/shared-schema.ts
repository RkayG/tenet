/**
 * Shared Schema Tenant Strategy
 * 
 * The SharedSchemaStrategy implements the most common isolation pattern where all tenants 
 * share a single database and the same database schema. Data isolation is achieved 
 * logically rather than physically, using a discriminator column (tenantId) on every table.
 * 
 * In this strategy:
 * 1. All tenants use the same underlying Prisma client connection pool.
 * 2. Tenet automatically scopes queries using Prisma Client Extensions (RLS concept).
 * 3. It is highly optimized for serverless and cloud-native environments due to 
 *    low connection overhead.
 */

import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../../core/types';
import { TenantStrategy } from '../manager';

/**
 * Configuration options for the SharedSchemaStrategy.
 */
export interface SharedSchemaConfig {
  /** The global PrismaClient instance that all tenants will share. */
  prismaClient: PrismaClient;

  /** 
   * Optional: Overrides the field name used for tenant filtering.
   * @default 'tenantId'
   */
  tenantIdField?: string;

  /** 
   * Time-to-Live for the internal tenant context cache (milliseconds).
   * @default 300000 (5 minutes)
   */
  cacheTtl?: number;
}

export class SharedSchemaStrategy implements TenantStrategy {
  public readonly name = 'shared_schema';
  private prismaClient: PrismaClient;
  private tenantIdField: string;

  /** 
   * Local context cache to avoid redundant metadata queries within the strategy.
   * Note: This is separate from the TenantManager's high-level cache.
   */
  private tenantCache: Map<string, TenantContext> = new Map();
  private cacheTtl: number;

  constructor(config: SharedSchemaConfig) {
    this.prismaClient = config.prismaClient;
    this.tenantIdField = config.tenantIdField || 'tenantId';
    this.cacheTtl = config.cacheTtl || 5 * 60 * 1000;
  }

  /**
   * Retrieves the shared Prisma client.
   * In a shared schema environment, we return the singleton client instance.
   * Data isolation is then applied at the Handler level via Client Extensions.
   * 
   * @param tenantId - The identifier of the tenant.
   * @returns The shared PrismaClient instance.
   */
  public async getPrismaClient(tenantId: string): Promise<PrismaClient> {
    // We validate that the tenant is active before returning the client
    await this.validateTenant(tenantId);
    return this.prismaClient;
  }

  /**
   * Resolves the tenant ID from common URL patterns or the request state.
   * This is used as a fallback if headers or subdomains aren't present.
   * 
   * @param request - Incoming Express request.
   * @returns Character ID of the tenant or null.
   */
  public async resolveTenantId(request: Request): Promise<string | null> {
    // 1. Check URL parameters (e.g., /:tenantId/projects)
    if (request.params.tenantId) {
      return request.params.tenantId;
    }

    // 2. Check query string (e.g., ?tenantId=acme)
    if (request.query.tenantId && typeof request.query.tenantId === 'string') {
      return request.query.tenantId;
    }

    // 3. Extract from an already authenticated user context
    const user = (request as any).user;
    if (user && user.tenantId) {
      return user.tenantId;
    }

    return null;
  }

  /**
   * Performs a database check to verify if a tenant ID is valid and active.
   * 
   * @param tenantId - Character ID of the tenant to validate.
   */
  public async validateTenant(tenantId: string): Promise<boolean> {
    try {
      // Direct query against the global client to verify existence
      const tenant = await (this.prismaClient as any).tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, isActive: true },
      });

      return tenant && tenant.isActive;
    } catch (error) {
      console.error(`[SharedSchemaStrategy] Validation Error for ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Fetches the detailed metadata context for a tenant.
   * This context is used to populate the HandlerContext during request execution.
   */
  public async getTenantContext(tenantId: string): Promise<TenantContext | null> {
    const cached = this.tenantCache.get(tenantId);
    if (cached) {
      return cached;
    }

    try {
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

      this.tenantCache.set(tenantId, context);

      // Auto-purge the local strategy cache based on TTL
      setTimeout(() => {
        this.tenantCache.delete(tenantId);
      }, this.cacheTtl);

      return context;
    } catch (error) {
      console.error(`[SharedSchemaStrategy] Context Fetch Error for ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Clears the internal strategy cache.
   */
  public clearCache(tenantId?: string): void {
    if (tenantId) {
      this.tenantCache.delete(tenantId);
    } else {
      this.tenantCache.clear();
    }
  }

  /**
   * Utility to retrieve the field name used for tenant isolation.
   */
  public getTenantIdField(): string {
    return this.tenantIdField;
  }
}
