/**
 * Tenant Manager
 * 
 * The TenantManager is the core orchestrator of the Tenet framework's multi-tenancy system.
 * It is responsible for resolving, validating, and managing the lifecycle of tenant contexts
 * and their associated database connections.
 * 
 * Key Responsibilities:
 * 1. Tenant Resolution: Identifying the tenant from incoming HTTP requests.
 * 2. Context Caching: Storing tenant metadata in-memory to optimize performance.
 * 3. Connection Management: Providing and caching tenant-scoped Prisma clients.
 * 4. Validation: Ensuring requests only proceed for active, valid tenants.
 * 
 * This class follows the Singleton pattern and must be initialized with a MultitenancyConfig.
 */

import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { TenantContext, MultitenancyConfig } from '../core/types';

/**
 * Interface defining the requirements for a tenant resolution and isolation strategy.
 */
export interface TenantStrategy {
  /** Uniquely identifies the strategy (e.g., 'shared_schema') */
  name: string;

  /**
   * Returns a Prisma client configured for the specific tenant.
   * In a shared schema, this returns the global client (isolation is handled by extensions).
   */
  getPrismaClient(tenantId: string): Promise<PrismaClient>;

  /**
   * Logic to extract the tenant ID from a raw Express request.
   */
  resolveTenantId(request: Request): Promise<string | null>;

  /**
   * Verifies that a tenant ID corresponds to a valid, active tenant in the system.
   */
  validateTenant(tenantId: string): Promise<boolean>;

  /**
   * Fetches the full metadata context for a tenant.
   */
  getTenantContext(tenantId: string): Promise<TenantContext | null>;
}

export class TenantManager {
  private static instance: TenantManager;
  private strategy: TenantStrategy | null = null;
  private config: MultitenancyConfig;
  
  /** 
   * In-memory cache for tenant metadata contexts to avoid redundant DB lookups.
   */
  private tenantCache: Map<string, TenantContext> = new Map();

  /** 
   * Cache for tenant-scoped Prisma clients to reuse connection pools efficiently.
   */
  private prismaClientCache: Map<string, PrismaClient> = new Map();

  /**
   * Private constructor to enforce Singleton pattern.
   * @param config - The framework's multitenancy configuration.
   */
  private constructor(config: MultitenancyConfig) {
    this.config = config;
  }

  /**
   * Retrieves the singleton instance of the TenantManager.
   * Must be provided with a configuration on the first call.
   * 
   * @param config - Configuration required for initialization.
   * @throws Error if called without config before initialization.
   */
  public static getInstance(config?: MultitenancyConfig): TenantManager {
    if (!TenantManager.instance && config) {
      TenantManager.instance = new TenantManager(config);
    }
    if (!TenantManager.instance) {
      throw new Error('TenantManager not initialized. Please provide config on first call.');
    }
    return TenantManager.instance;
  }

  /**
   * Injects the underlying isolation strategy (e.g., SharedSchemaStrategy).
   * This must be set before the framework can resolve tenants.
   */
  public setStrategy(strategy: TenantStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Returns the currently active tenant strategy.
   */
  public getStrategy(): TenantStrategy | null {
    return this.strategy;
  }

  /**
   * Orchestrates the resolution of a tenant ID from an incoming request.
   * It checks headers (standardized via config), subdomains, and falls back
   * to the provided strategy or a default tenant.
   * 
   * @param request - The incoming Express request.
   * @returns The resolved tenant ID string, or null if unresolvable.
   */
  public async resolveTenantId(request: Request): Promise<string | null> {
    if (!this.strategy) {
      throw new Error('Tenant strategy not set');
    }

    // 1. Try to resolve via the configured custom header (defaults to X-Tenant-ID)
    const headerTenantId = request.headers[this.config.tenantHeader.toLowerCase()];
    if (headerTenantId && typeof headerTenantId === 'string') {
      const isValid = await this.strategy.validateTenant(headerTenantId);
      if (isValid) {
        return headerTenantId;
      }
    }

    // 2. Try to resolve via subdomain (e.g., tenant-a.myapp.com)
    const host = request.headers.host;
    if (host) {
      const subdomain = this.extractSubdomain(host);
      if (subdomain) {
        const isValid = await this.strategy.validateTenant(subdomain);
        if (isValid) {
          return subdomain;
        }
      }
    }

    // 3. Fallback to the strategy-specific resolution logic
    const resolvedId = await this.strategy.resolveTenantId(request);
    
    // 4. Final fallback to the system default tenant if provided
    return resolvedId || this.config.defaultTenant || null;
  }

  /**
   * Retrieves the full context (metadata, config, name) for a specific tenant.
   * Utilizes an internal cache to minimize database round-trips.
   * 
   * @param tenantId - The unique identifier of the tenant.
   * @returns The TenantContext object, or null if the tenant is invalid/inactive.
   */
  public async getTenantContext(tenantId: string): Promise<TenantContext | null> {
    if (this.tenantCache.has(tenantId)) {
      return this.tenantCache.get(tenantId)!;
    }

    if (!this.strategy) {
      throw new Error('Tenant strategy not set');
    }

    const context = await this.strategy.getTenantContext(tenantId);
    if (context) {
      this.tenantCache.set(tenantId, context);
    }

    return context;
  }

  /**
   * Provides a Prisma client instance scoped to the specified tenant.
   * This is used by the Handler lifecycle to ensure data isolation.
   * 
   * @param tenantId - The unique identifier of the tenant.
   * @returns A PrismaClient instance.
   */
  public async getPrismaClient(tenantId: string): Promise<PrismaClient> {
    if (this.prismaClientCache.has(tenantId)) {
      return this.prismaClientCache.get(tenantId)!;
    }

    if (!this.strategy) {
      throw new Error('Tenant strategy not set');
    }

    const client = await this.strategy.getPrismaClient(tenantId);
    this.prismaClientCache.set(tenantId, client);

    return client;
  }

  /**
   * Validates whether a tenant exists and is in an 'Active' state.
   * 
   * @param tenantId - The unique identifier of the tenant to check.
   */
  public async validateTenant(tenantId: string): Promise<boolean> {
    if (!this.strategy) {
      throw new Error('Tenant strategy not set');
    }

    return await this.strategy.validateTenant(tenantId);
  }

  /**
   * Purges the internal metadata and client caches.
   * If a tenantId is provided, only that tenant is cleared.
   * Useful when tenant configurations are updated at runtime.
   * 
   * @param tenantId - Optional ID of a specific tenant to purge.
   */
  public clearCache(tenantId?: string): void {
    if (tenantId) {
      this.tenantCache.delete(tenantId);
      
      const client = this.prismaClientCache.get(tenantId);
      if (client) {
        client.$disconnect().catch(console.error);
        this.prismaClientCache.delete(tenantId);
      }
    } else {
      this.tenantCache.clear();
      for (const client of this.prismaClientCache.values()) {
        client.$disconnect().catch(console.error);
      }
      this.prismaClientCache.clear();
    }
  }

  /**
   * Utility to extract a subdomain from a Host header.
   */
  private extractSubdomain(host: string): string | null {
    const hostname = host.split(':')[0];
    const parts = hostname?.split('.') ?? [];
    
    // Assumes format: subdomain.domain.tld
    if (parts.length > 2) {
      return parts[0] ?? null;
    }
    return null;
  }

  /**
   * Returns the current multitenancy configuration.
   */
  public getConfig(): MultitenancyConfig {
    return this.config;
  }

  /**
   * Updates the multitenancy configuration at runtime.
   */
  public updateConfig(config: Partial<MultitenancyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Returns an array of all currently cached tenant IDs.
   */
  public getCachedTenantIds(): string[] {
    return Array.from(this.tenantCache.keys());
  }

  /**
   * Gracefully disconnects all cached Prisma clients and clears the registry.
   * Executed during application shutdown to prevent connection leaks.
   */
  public async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.prismaClientCache.values()).map(
      client => client.$disconnect()
    );
    
    await Promise.all(disconnectPromises);
    this.prismaClientCache.clear();
  }
}
