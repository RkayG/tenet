/**
 * Authentication Manager
 * 
 * Manages multiple authentication strategies and handles authentication flow
 */

import { Request } from 'express';
import { AuthStrategy, User } from '../core/types';

export interface AuthConfig {
  strategies: AuthStrategy[];
  defaultStrategy?: string;
  fallbackStrategies?: string[];
}

export class AuthManager {
  private static instance: AuthManager;
  private strategies: Map<string, AuthStrategy> = new Map();
  private defaultStrategy: string | null = null;
  private fallbackStrategies: string[] = [];

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Register authentication strategy
   */
  public registerStrategy(strategy: AuthStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get authentication strategy by name
   */
  public getStrategy(name: string): AuthStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Set default authentication strategy
   */
  public setDefaultStrategy(name: string): void {
    if (!this.strategies.has(name)) {
      throw new Error(`Strategy ${name} not found`);
    }
    this.defaultStrategy = name;
  }

  /**
   * Set fallback strategies (tried in order if default fails)
   */
  public setFallbackStrategies(strategies: string[]): void {
    for (const name of strategies) {
      if (!this.strategies.has(name)) {
        throw new Error(`Strategy ${name} not found`);
      }
    }
    this.fallbackStrategies = strategies;
  }

  /**
   * Authenticate request using specified strategies
   */
  public async authenticate(
    request: Request,
    strategyNames?: string[]
  ): Promise<User | null> {
    const strategies = this.resolveStrategies(strategyNames);

    for (const strategyName of strategies) {
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        continue;
      }

      try {
        const user = await strategy.authenticate(request);
        if (user) {
          // Attach strategy name to user metadata
          user.metadata = {
            ...user.metadata,
            authStrategy: strategyName,
          };
          return user;
        }
      } catch (error) {
        console.error(`Error authenticating with strategy ${strategyName}:`, error);
        // Continue to next strategy
      }
    }

    return null;
  }

  /**
   * Validate token using specified strategy
   */
  public async validateToken(token: string, strategyName?: string): Promise<boolean> {
    const strategy = strategyName
      ? this.strategies.get(strategyName)
      : this.strategies.get(this.defaultStrategy || '');

    if (!strategy || !strategy.validate) {
      return false;
    }

    try {
      return await strategy.validate(token);
    } catch (error) {
      console.error(`Error validating token with strategy ${strategyName}:`, error);
      return false;
    }
  }

  /**
   * Refresh token using specified strategy
   */
  public async refreshToken(refreshToken: string, strategyName?: string): Promise<User | null> {
    const strategy = strategyName
      ? this.strategies.get(strategyName)
      : this.strategies.get(this.defaultStrategy || '');

    if (!strategy || !strategy.refresh) {
      return null;
    }

    try {
      return await strategy.refresh(refreshToken);
    } catch (error) {
      console.error(`Error refreshing token with strategy ${strategyName}:`, error);
      return null;
    }
  }

  /**
   * Resolve strategy names to use for authentication
   */
  private resolveStrategies(strategyNames?: string[]): string[] {
    // Use provided strategies
    if (strategyNames && strategyNames.length > 0) {
      return strategyNames;
    }

    // Use default strategy with fallbacks
    const strategies: string[] = [];
    
    if (this.defaultStrategy) {
      strategies.push(this.defaultStrategy);
    }

    strategies.push(...this.fallbackStrategies);

    // If no strategies configured, try all registered strategies
    if (strategies.length === 0) {
      return Array.from(this.strategies.keys());
    }

    return strategies;
  }

  /**
   * Get all registered strategy names
   */
  public getRegisteredStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if strategy is registered
   */
  public hasStrategy(name: string): boolean {
    return this.strategies.has(name);
  }

  /**
   * Unregister strategy
   */
  public unregisterStrategy(name: string): void {
    this.strategies.delete(name);
    
    // Clear from defaults if it was set
    if (this.defaultStrategy === name) {
      this.defaultStrategy = null;
    }
    
    this.fallbackStrategies = this.fallbackStrategies.filter(s => s !== name);
  }

  /**
   * Clear all strategies
   */
  public clearStrategies(): void {
    this.strategies.clear();
    this.defaultStrategy = null;
    this.fallbackStrategies = [];
  }

  /**
   * Create authentication middleware for Express
   */
  public createMiddleware(options?: {
    strategies?: string[];
    required?: boolean;
    allowedRoles?: string[];
    requiredPermissions?: string[];
  }) {
    return async (req: any, res: any, next: any) => {
      try {
        const user = await this.authenticate(req, options?.strategies);

        if (!user && options?.required !== false) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_ERROR',
              message: 'Authentication required',
            },
          });
        }

        // Check roles
        if (user && options?.allowedRoles && options.allowedRoles.length > 0) {
          if (!user.role || !options.allowedRoles.includes(user.role)) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'AUTHORIZATION_ERROR',
                message: 'Insufficient permissions',
              },
            });
          }
        }

        // Check permissions
        if (user && options?.requiredPermissions && options.requiredPermissions.length > 0) {
          const userPermissions = user.permissions || [];
          const hasAllPermissions = options.requiredPermissions.every(
            perm => userPermissions.includes(perm)
          );

          if (!hasAllPermissions) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'AUTHORIZATION_ERROR',
                message: 'Missing required permissions',
              },
            });
          }
        }

        // Attach user to request
        req.user = user;
        next();
      } catch (error) {
        console.error('Authentication middleware error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Authentication failed',
          },
        });
      }
    };
  }
}
