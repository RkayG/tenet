/**
 * OAuth Authentication Strategy
 * 
 * Validates OAuth tokens (OAuth 2.0) and authenticates users
 * Supports multiple OAuth providers (Google, GitHub, etc.)
 */

// ======= UNSUPPORTED YET =======

//import { Request } from 'express';
//import { AuthStrategy, User } from '../../core/types';
//
//export interface OAuthConfig {
//  provider: 'google' | 'github' | 'microsoft' | 'facebook' | 'custom';
//  clientId: string;
//  clientSecret: string;
//  redirectUri: string;
//  scope?: string[];
//  tokenEndpoint?: string;
//  userInfoEndpoint?: string;
//}
//
//export class OAuthStrategy implements AuthStrategy {
//  public readonly name = 'oauth';
//  private config: OAuthConfig;
//  private tokenCache: Map<string, any> = new Map();
//
//  constructor(config: OAuthConfig) {
//    this.config = config;
//  }
//
//  /**
//   * Authenticate user from OAuth token
//   */
//  async authenticate(request: Request): Promise<User | null> {
//    try {
//      const token = this.extractToken(request);
//      if (!token) {
//        return null;
//      }
//
//      // Validate token with OAuth provider
//      const userInfo = await this.validateToken(token);
//      if (!userInfo) {
//        return null;
//      }
//
//      // Convert OAuth user info to User object
//      return this.oauthUserToUser(userInfo);
//    } catch (error) {
//      console.error('OAuth authentication error:', error);
//      return null;
//    }
//  }
//
//  /**
//   * Validate OAuth token
//   */
//  async validate(token: string): Promise<boolean> {
//    try {
//      const userInfo = await this.validateToken(token);
//      return !!userInfo;
//    } catch (error) {
//      return false;
//    }
//  }
//
//  /**
//   * Extract token from request
//   */
//  private extractToken(request: Request): string | null {
//    // Check Authorization header
//    const authHeader = request.headers.authorization;
//    if (authHeader && authHeader.startsWith('Bearer ')) {
//      return authHeader.substring(7);
//    }
//
//    // Check query parameter
//    if (request.query.access_token && typeof request.query.access_token === 'string') {
//      return request.query.access_token;
//    }
//
//    return null;
//  }
//
//  /**
//   * Validate token with OAuth provider
//   */
//  private async validateToken(token: string): Promise<any> {
//    // Check cache first
//    if (this.tokenCache.has(token)) {
//      return this.tokenCache.get(token);
//    }
//
//    // Get user info endpoint based on provider
//    const userInfoEndpoint = this.config.userInfoEndpoint || this.getDefaultUserInfoEndpoint();
//
//    try {
//      const response = await fetch(userInfoEndpoint, {
//        headers: {
//          Authorization: `Bearer ${token}`,
//        },
//      });
//
//      if (!response.ok) {
//        return null;
//      }
//
//      const userInfo = await response.json();
//
//      // Cache the result (with expiry)
//      this.tokenCache.set(token, userInfo);
//      setTimeout(() => {
//        this.tokenCache.delete(token);
//      }, 5 * 60 * 1000); // 5 minutes
//
//      return userInfo;
//    } catch (error) {
//      console.error('Error validating OAuth token:', error);
//      return null;
//    }
//  }
//
//  /**
//   * Get default user info endpoint based on provider
//   */
//  private getDefaultUserInfoEndpoint(): string {
//    switch (this.config.provider) {
//      case 'google':
//        return 'https://www.googleapis.com/oauth2/v2/userinfo';
//      case 'github':
//        return 'https://api.github.com/user';
//      case 'microsoft':
//        return 'https://graph.microsoft.com/v1.0/me';
//      case 'facebook':
//        return 'https://graph.facebook.com/me?fields=id,name,email';
//      default:
//        throw new Error(`No default user info endpoint for provider: ${this.config.provider}`);
//    }
//  }
//
//  /**
//   * Convert OAuth user info to User object
//   */
//  private oauthUserToUser(userInfo: any): User {
//    // Map provider-specific fields to our User model
//    let id: string;
//    let email: string;
//    let name: string;
//
//    switch (this.config.provider) {
//      case 'google':
//        id = userInfo.id;
//        email = userInfo.email;
//        name = userInfo.name;
//        break;
//      case 'github':
//        id = userInfo.id.toString();
//        email = userInfo.email;
//        name = userInfo.name || userInfo.login;
//        break;
//      case 'microsoft':
//        id = userInfo.id;
//        email = userInfo.userPrincipalName || userInfo.mail;
//        name = userInfo.displayName;
//        break;
//      case 'facebook':
//        id = userInfo.id;
//        email = userInfo.email;
//        name = userInfo.name;
//        break;
//      default:
//        id = userInfo.id || userInfo.sub;
//        email = userInfo.email;
//        name = userInfo.name;
//    }
//
//    return {
//      id: `${this.config.provider}_${id}`,
//      email: email,
//      brand_id: `${this.config.provider}_${id}`,
//      role: 'USER',
//      metadata: {
//        provider: this.config.provider,
//        providerUserId: id,
//        name: name,
//        ...userInfo,
//      },
//      is_active: true,
//    };
//  }
//
//  /**
//   * Exchange authorization code for access token
//   */
//  public async exchangeCodeForToken(code: string): Promise<{ accessToken: string; refreshToken?: string } | null> {
//    const tokenEndpoint = this.config.tokenEndpoint || this.getDefaultTokenEndpoint();
//
//    try {
//      const response = await fetch(tokenEndpoint, {
//        method: 'POST',
//        headers: {
//          'Content-Type': 'application/x-www-form-urlencoded',
//        },
//        body: new URLSearchParams({
//          grant_type: 'authorization_code',
//          code,
//          client_id: this.config.clientId,
//          client_secret: this.config.clientSecret,
//          redirect_uri: this.config.redirectUri,
//        }),
//      });
//
//      if (!response.ok) {
//        return null;
//      }
//
//      const data = await response.json();
//
//      return {
//        accessToken: data.access_token,
//        refreshToken: data.refresh_token,
//      };
//    } catch (error) {
//      console.error('Error exchanging code for token:', error);
//      return null;
//    }
//  }
//
//  /**
//   * Get default token endpoint based on provider
//   */
//  private getDefaultTokenEndpoint(): string {
//    switch (this.config.provider) {
//      case 'google':
//        return 'https://oauth2.googleapis.com/token';
//      case 'github':
//        return 'https://github.com/login/oauth/access_token';
//      case 'microsoft':
//        return 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
//      case 'facebook':
//        return 'https://graph.facebook.com/v12.0/oauth/access_token';
//      default:
//        throw new Error(`No default token endpoint for provider: ${this.config.provider}`);
//    }
//  }
//
//  /**
//   * Get authorization URL
//   */
//  public getAuthorizationUrl(state?: string): string {
//    const params = new URLSearchParams({
//      client_id: this.config.clientId,
//      redirect_uri: this.config.redirectUri,
//      response_type: 'code',
//      scope: (this.config.scope || this.getDefaultScopes()).join(' '),
//    });
//
//    if (state) {
//      params.set('state', state);
//    }
//
//    const baseUrl = this.getAuthorizationEndpoint();
//    return `${baseUrl}?${params.toString()}`;
//  }
//
//  /**
//   * Get authorization endpoint based on provider
//   */
//  private getAuthorizationEndpoint(): string {
//    switch (this.config.provider) {
//      case 'google':
//        return 'https://accounts.google.com/o/oauth2/v2/auth';
//      case 'github':
//        return 'https://github.com/login/oauth/authorize';
//      case 'microsoft':
//        return 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
//      case 'facebook':
//        return 'https://www.facebook.com/v12.0/dialog/oauth';
//      default:
//        throw new Error(`No authorization endpoint for provider: ${this.config.provider}`);
//    }
//  }
//
//  /**
//   * Get default scopes based on provider
//   */
//  private getDefaultScopes(): string[] {
//    switch (this.config.provider) {
//      case 'google':
//        return ['openid', 'email', 'profile'];
//      case 'github':
//        return ['user:email'];
//      case 'microsoft':
//        return ['openid', 'email', 'profile'];
//      case 'facebook':
//        return ['email', 'public_profile'];
//      default:
//        return ['openid', 'email', 'profile'];
//    }
//  }
//
//  /**
//   * Clear token cache
//   */
//  public clearCache(): void {
//    this.tokenCache.clear();
//  }
//}
//