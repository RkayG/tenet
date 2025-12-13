/**
 * Tenant Manager
 * 
 * Manages multi-tenancy support with different isolation strategies:
 * - Shared Schema: All tenants share the same database schema with tenant_id filtering
 * - Separate Schema: Each tenant has its own schema within the same database
 * - Separate Database: Each tenant has its own dedicated database
 */

import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { TenantContext, MultitenancyConfig } from '../core/types';

export interface TenantStrategy {
  name: string;
  getPrismaClient(tenantId: string): Promise<PrismaClient>;
  resolveTenantId(request: Request): Promise<string | null>;
  validateTenant(tenantId: string): Promise<boolean>;
  getTenantContext(tenantId: string): Promise<TenantContext | null>;
}

export class TenantManager {
  private static instance: TenantManager;
  private strategy: TenantStrategy | null = null;
  private config: MultitenancyConfig;
  private tenantCache: Map<string, TenantContext> = new Map();
  private prismaClientCache: Map<string, PrismaClient> = new Map();

  private constructor(config: MultitenancyConfig) {
    this.config = config;
  }

  /**
   * Get singleton instance
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
   * Set the tenant isolation strategy
   */
  public setStrategy(strategy: TenantStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get the current tenant strategy
   */
  public getStrategy(): TenantStrategy | null {
    return this.strategy;
  }

  /**
   * Resolve tenant ID from request
   */
  public async resolveTenantId(request: Request): Promise<string | null> {
    if (!this.config.enabled) {
      return this.config.defaultTenant || null;
    }

    if (!this.strategy) {
      throw new Error('Tenant strategy not set');
    }

    // Try to get from custom header
    const headerTenantId = request.headers[this.config.tenantHeader.toLowerCase()];
    if (headerTenantId && typeof headerTenantId === 'string') {
      const isValid = await this.strategy.validateTenant(headerTenantId);
      if (isValid) {
        return headerTenantId;
      }
    }

    // Try to get from subdomain
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

    // Fall back to strategy's resolution
    return await this.strategy.resolveTenantId(request);
  }

  /**
   * Get tenant context
   */
  public async getTenantContext(tenantId: string): Promise<TenantContext | null> {
    // Check cache first
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
   * Get Prisma client for specific tenant
   */
  public async getPrismaClient(tenantId: string): Promise<PrismaClient> {
    // Check cache first
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
   * Validate if tenant exists and is active
   */
  public async validateTenant(tenantId: string): Promise<boolean> {
    if (!this.strategy) {
      throw new Error('Tenant strategy not set');
    }

    return await this.strategy.validateTenant(tenantId);
  }

  /**
   * Clear tenant cache
   */
  public clearCache(tenantId?: string): void {
    if (tenantId) {
      this.tenantCache.delete(tenantId);
      
      // Disconnect and remove Prisma client
      const client = this.prismaClientCache.get(tenantId);
      if (client) {
        client.$disconnect().catch(console.error);
        this.prismaClientCache.delete(tenantId);
      }
    } else {
      this.tenantCache.clear();
      
      // Disconnect all Prisma clients
      for (const client of this.prismaClientCache.values()) {
        client.$disconnect().catch(console.error);
      }
      this.prismaClientCache.clear();
    }
  }

  /**
   * Extract subdomain from host
   */
  private extractSubdomain(host: string): string | null {
    // Remove port if present
    const hostname = host.split(':')[0];
    
    // Split by dots
    const parts = hostname?.split('.') ?? [];
    
    // If we have more than 2 parts (e.g., tenant.example.com), the first part is the subdomain
    if (parts.length > 2) {
      return parts[0] ?? null;
    }
    
    return null;
  }

  /**
   * Get multitenancy configuration
   */
  public getConfig(): MultitenancyConfig {
    return this.config;
  }

  /**
   * Update multitenancy configuration
   */
  public updateConfig(config: Partial<MultitenancyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if multitenancy is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get all cached tenant IDs
   */
  public getCachedTenantIds(): string[] {
    return Array.from(this.tenantCache.keys());
  }

  /**
   * Disconnect all tenant connections
   */
  public async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.prismaClientCache.values()).map(
      client => client.$disconnect()
    );
    
    await Promise.all(disconnectPromises);
    this.prismaClientCache.clear();
  }
}
