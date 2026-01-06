/**
 * API Versioning Manager
 *
 * Manages API versioning with support for URL-based and header-based versioning
 */

import { Request } from 'express';
import { ApiVersion, VersionConfig } from '../core/types';

export class VersionManager {
  private static instance: VersionManager;
  private config: VersionConfig;
  private versions: Map<string, ApiVersion> = new Map();

  private constructor(config: VersionConfig) {
    this.config = {
      current: config.current || 'v1',
      supported: config.supported || ['v1'],
      default: config.default || 'v1',
      header: config.header || 'Accept-Version',
      parameter: config.parameter || 'version',
    };

    this.initializeVersions();
  }

  public static getInstance(config?: Partial<VersionConfig>): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager({
        current: 'v1',
        supported: ['v1'],
        default: 'v1',
        ...config,
      });
    }
    return VersionManager.instance;
  }

  private initializeVersions(): void {
    // Initialize with default versions
    this.config.supported.forEach(version => {
      this.versions.set(version, {
        version,
        path: `/api/${version}`,
        deprecated: false,
        changelog: [],
      });
    });
  }

  /**
   * Get client API version from Express request
   */
  public getClientVersion(request: Request): string {
    // Try header-based versioning first
    const headerVersion = request.get(this.config.header);
    if (headerVersion && this.isValidVersion(headerVersion)) {
      return headerVersion;
    }

    // Try URL-based versioning
    const urlVersion = this.extractVersionFromUrl(request.originalUrl || request.url);
    if (urlVersion && this.isValidVersion(urlVersion)) {
      return urlVersion;
    }

    // Try query parameter versioning
    const paramVersion = request.query[this.config.parameter] as string;
    if (paramVersion && this.isValidVersion(paramVersion)) {
      return paramVersion;
    }

    // Return default version
    return this.config.default;
  }

  /**
   * Check if a version is supported
   */
  public isVersionSupported(clientVersion: string, requiredVersion?: string): boolean {
    const targetVersion = requiredVersion || this.config.current;

    // Exact match
    if (clientVersion === targetVersion) {
      return true;
    }

    // Check if client version is compatible with required version
    return this.isCompatible(clientVersion, targetVersion);
  }

  /**
   * Get version information
   */
  public getVersionInfo(version: string): ApiVersion | null {
    return this.versions.get(version) || null;
  }

  /**
   * Add a new API version
   */
  public addVersion(version: ApiVersion): void {
    this.versions.set(version.version, version);

    if (!this.config.supported.includes(version.version)) {
      this.config.supported.push(version.version);
    }
  }

  /**
   * Deprecate a version
   */
  public deprecateVersion(version: string, sunsetDate?: Date): void {
    const versionInfo = this.versions.get(version);
    if (versionInfo) {
      versionInfo.deprecated = true;
      versionInfo.sunsetDate = sunsetDate;
    }
  }

  /**
   * Get all supported versions
   */
  public getSupportedVersions(): string[] {
    return [...this.config.supported];
  }

  /**
   * Get current version
   */
  public getCurrentVersion(): string {
    return this.config.current;
  }

  /**
   * Set current version
   */
  public setCurrentVersion(version: string): void {
    if (this.config.supported.includes(version)) {
      this.config.current = version;
    } else {
      throw new Error(`Version ${version} is not supported`);
    }
  }

  /**
   * Get versioned endpoint URL
   */
  public getVersionedUrl(baseUrl: string, version?: string): string {
    const targetVersion = version || this.config.current;

    // For URL-based versioning, prepend version to path
    if (baseUrl.startsWith('/api/')) {
      // Replace existing version or add new one
      const versionPattern = /^\/api\/v\d+\//;
      if (versionPattern.test(baseUrl)) {
        return baseUrl.replace(versionPattern, `/api/${targetVersion}/`);
      } else {
        return baseUrl.replace('/api/', `/api/${targetVersion}/`);
      }
    }

    return baseUrl;
  }

  /**
   * Check if a version is deprecated
   */
  public isVersionDeprecated(version: string): boolean {
    const versionInfo = this.versions.get(version);
    return versionInfo?.deprecated || false;
  }

  /**
   * Get deprecation information
   */
  public getDeprecationInfo(version: string): { deprecated: boolean; sunsetDate?: Date; message?: string } {
    const versionInfo = this.versions.get(version);

    if (!versionInfo) {
      return { deprecated: false };
    }

    return {
      deprecated: versionInfo.deprecated || false,
      sunsetDate: versionInfo.sunsetDate,
      message: versionInfo.deprecated
        ? `API version ${version} is deprecated${versionInfo.sunsetDate ? ` and will be removed on ${versionInfo.sunsetDate.toISOString()}` : ''}`
        : undefined,
    };
  }

  /**
   * Get version compatibility matrix
   */
  public getCompatibilityMatrix(): Record<string, string[]> {
    const matrix: Record<string, string[]> = {};

    for (const version of this.config.supported) {
      matrix[version] = this.config.supported.filter(v => this.isCompatible(v, version));
    }

    return matrix;
  }

  /**
   * Update version configuration
   */
  public updateConfig(config: Partial<VersionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): VersionConfig {
    return { ...this.config };
  }

  // Private helper methods

  private extractVersionFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      // Look for version pattern like /api/v1/, /v2/endpoint
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (part.match(/^v\d+$/)) {
          return part;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private isValidVersion(version: string): boolean {
    return this.config.supported.includes(version);
  }

  private isCompatible(clientVersion: string, targetVersion: string): boolean {
    // Simple semantic versioning compatibility
    // v2 is compatible with v1, but v1 is not compatible with v2

    const clientNum = this.versionToNumber(clientVersion);
    const targetNum = this.versionToNumber(targetVersion);

    // Same major version or higher
    return clientNum >= targetNum;
  }

  private versionToNumber(version: string): number {
    const match = version.match(/^v(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Middleware for automatic version handling (Express)
   */
  public createVersionMiddleware() {
    return (req: Request, res: any, next: any) => {
      const clientVersion = this.getClientVersion(req);

      // Add version to request headers for downstream use
      req.headers['x-api-version'] = clientVersion;

      // Check for deprecation
      if (this.isVersionDeprecated(clientVersion)) {
        const deprecation = this.getDeprecationInfo(clientVersion);

        // Add deprecation warning header to response
        res.setHeader('X-API-Deprecation', deprecation.message || 'This API version is deprecated');

        if (deprecation.sunsetDate) {
          res.setHeader('X-API-Sunset', deprecation.sunsetDate.toISOString());
        }
      }

      next();
    };
  }

  /**
   * Generate version response headers
   */
  public getVersionHeaders(clientVersion: string): Record<string, string> {
    const headers: Record<string, string> = {
      'X-API-Version': clientVersion,
      'X-API-Current-Version': this.config.current,
      'X-API-Supported-Versions': this.config.supported.join(', '),
    };

    const deprecation = this.getDeprecationInfo(clientVersion);
    if (deprecation.deprecated) {
      headers['X-API-Deprecation'] = deprecation.message || 'This API version is deprecated';

      if (deprecation.sunsetDate) {
        headers['X-API-Sunset'] = deprecation.sunsetDate.toISOString();
      }
    }

    return headers;
  }
}
