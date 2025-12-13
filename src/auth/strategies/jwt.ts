/**
 * JWT Authentication Strategy
 * 
 * Validates JWT tokens and authenticates users
 */

import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { AuthStrategy, User } from '../../core/types';

export interface JWTConfig {
  secret: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  refreshExpiresIn?: string;
}

export class JWTStrategy implements AuthStrategy {
  public readonly name = 'jwt';
  private config: JWTConfig;

  constructor(config: JWTConfig) {
    this.config = config;
  }

  /**
   * Authenticate user from JWT token
   */
  async authenticate(request: Request): Promise<User | null> {
    try {
      const token = this.extractToken(request);
      if (!token) {
        return null;
      }

      const payload = await this.verifyToken(token);
      if (!payload) {
        return null;
      }

      // Convert JWT payload to User object
      return this.payloadToUser(payload);
    } catch (error) {
      console.error('JWT authentication error:', error);
      return null;
    }
  }

  /**
   * Verify JWT token
   */
  async validate(token: string): Promise<boolean> {
    try {
      const payload = await this.verifyToken(token);
      return !!payload;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh JWT token
   */
  async refresh(refreshToken: string): Promise<User | null> {
    try {
      const payload = await this.verifyToken(refreshToken);
      if (!payload) {
        return null;
      }

      return this.payloadToUser(payload);
    } catch (error) {
      console.error('JWT refresh error:', error);
      return null;
    }
  }

  /**
   * Extract token from request
   */
  private extractToken(request: Request): string | null {
    // Check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter
    if (request.query.token && typeof request.query.token === 'string') {
      return request.query.token;
    }

    // Check cookie
    if (request.cookies && request.cookies.token) {
      return request.cookies.token;
    }

    return null;
  }

  /**
   * Verify JWT token
   */
  private async verifyToken(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.config.secret,
        {
          issuer: this.config.issuer,
          audience: this.config.audience,
        },
        (error, decoded) => {
          if (error) {
            reject(error);
          } else {
            resolve(decoded);
          }
        }
      );
    });
  }

  /**
   * Convert JWT payload to User object
   */
  private payloadToUser(payload: any): User {
    return {
      id: payload.sub || payload.id,
      email: payload.email,
      brand_id: payload.brand_id,
      role: payload.role,
      permissions: payload.permissions,
      tenant_id: payload.tenant_id,
      metadata: payload.metadata,
      is_active: payload.is_active !== false,
    };
  }

  /**
   * Generate JWT token for user
   */
  public generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      brand_id: user.brand_id,
      role: user.role,
      permissions: user.permissions,
      tenant_id: user.tenant_id,
      metadata: user.metadata,
    };

    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.expiresIn || '1h',
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  /**
   * Generate refresh token
   */
  public generateRefreshToken(user: User): string {
    const payload = {
      sub: user.id,
      type: 'refresh',
    };

    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.refreshExpiresIn || '7d',
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }
}
