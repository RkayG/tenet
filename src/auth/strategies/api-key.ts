/**
 * API Key Authentication Strategy
 * 
 * Validates API keys and authenticates users/services
 */

import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthStrategy, User } from '../../core/types';

export interface APIKeyConfig {
  prismaClient: PrismaClient;
  headerName?: string;
  queryParamName?: string;
  hashingEnabled?: boolean;
}

export class APIKeyStrategy implements AuthStrategy {
  public readonly name = 'api_key';
  private prismaClient: PrismaClient;
  private headerName: string;
  private queryParamName: string;
  private hashingEnabled: boolean;

  constructor(config: APIKeyConfig) {
    this.prismaClient = config.prismaClient;
    this.headerName = config.headerName || 'x-api-key';
    this.queryParamName = config.queryParamName || 'api_key';
    this.hashingEnabled = config.hashingEnabled !== false;
  }

  /**
   * Authenticate user from API key
   */
  async authenticate(request: Request): Promise<User | null> {
    try {
      const apiKey = this.extractApiKey(request);
      if (!apiKey) {
        return null;
      }

      // Validate API key against database
      const keyRecord = await this.validateApiKey(apiKey);
      if (!keyRecord) {
        return null;
      }

      // Update last used timestamp
      await this.updateLastUsed(keyRecord.id);

      // Return user associated with API key
      return this.keyRecordToUser(keyRecord);
    } catch (error) {
      console.error('API Key authentication error:', error);
      return null;
    }
  }

  /**
   * Validate API key
   */
  async validate(apiKey: string): Promise<boolean> {
    try {
      const keyRecord = await this.validateApiKey(apiKey);
      return !!keyRecord;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract API key from request
   */
  private extractApiKey(request: Request): string | null {
    // Check custom header
    const headerKey = request.headers[this.headerName.toLowerCase()];
    if (headerKey && typeof headerKey === 'string') {
      return headerKey;
    }

    // Check Authorization header with custom scheme
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('ApiKey ')) {
      return authHeader.substring(7);
    }

    // Check query parameter
    if (request.query[this.queryParamName] && typeof request.query[this.queryParamName] === 'string') {
      return request.query[this.queryParamName] as string;
    }

    return null;
  }

  /**
   * Validate API key against database
   */
  private async validateApiKey(apiKey: string): Promise<any> {
    // Hash the key if hashing is enabled
    const keyToLookup = this.hashingEnabled ? this.hashApiKey(apiKey) : apiKey;

    // Query database for API key
    // Note: This assumes you have an ApiKey model in your Prisma schema
    const keyRecord = await (this.prismaClient as any).apiKey.findUnique({
      where: {
        key: keyToLookup,
        isActive: true,
      },
      include: {
        user: true,
      },
    });

    if (!keyRecord) {
      return null;
    }

    // Check expiration
    if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
      return null;
    }

    // Check rate limits if applicable
    // This could be extended to check usage quotas

    return keyRecord;
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(keyId: string): Promise<void> {
    try {
      await (this.prismaClient as any).apiKey.update({
        where: { id: keyId },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      console.error('Error updating API key last used:', error);
    }
  }

  /**
   * Convert key record to User object
   */
  private keyRecordToUser(keyRecord: any): User {
    const user = keyRecord.user;

    return {
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id || keyRecord.tenantId,
      role: user.role,
      permissions: keyRecord.permissions || user.permissions,
      metadata: {
        ...user.metadata,
        apiKeyId: keyRecord.id,
        apiKeyName: keyRecord.name,
      },
      is_active: user.is_active,
    };
  }

  /**
   * Hash API key (simple implementation - use bcrypt or similar in production)
   */
  private hashApiKey(apiKey: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
  }

  /**
   * Generate new API key
   */
  public async generateApiKey(userId: string, name: string, expiresAt?: Date): Promise<string> {
    const crypto = require('crypto');
    const apiKey = crypto.randomBytes(32).toString('hex');
    const hashedKey = this.hashingEnabled ? this.hashApiKey(apiKey) : apiKey;

    await (this.prismaClient as any).apiKey.create({
      data: {
        key: hashedKey,
        name,
        userId,
        expiresAt,
        isActive: true,
      },
    });

    // Return the raw key (only time it's available)
    return apiKey;
  }

  /**
   * Revoke API key
   */
  public async revokeApiKey(keyId: string): Promise<void> {
    await (this.prismaClient as any).apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });
  }
}
