/**
 * URL-based API Versioning Strategy
 *
 * Handles versioning through URL paths (e.g., /api/v1/users, /api/v2/users)
 */

import { Request } from 'express';

export interface UrlVersioningConfig {
  prefix?: string;
  versionPattern?: RegExp;
  defaultVersion?: string;
}

export class UrlVersioningStrategy {
  private config: Required<UrlVersioningConfig>;

  constructor(config: UrlVersioningConfig = {}) {
    this.config = {
      prefix: config.prefix || '/api',
      versionPattern: config.versionPattern || /^v\d+$/,
      defaultVersion: config.defaultVersion || 'v1',
    };
  }

  /**
   * Extract version from URL
   */
  public extractVersion(request: Request): string | null {
    const pathname = request.path || request.url;

    // Check if path starts with API prefix
    if (!pathname.startsWith(this.config.prefix)) {
      return null;
    }

    // Extract version from path
    const pathParts = pathname.substring(this.config.prefix.length).split('/').filter(Boolean);

    if (pathParts.length === 0) {
      return null;
    }

    const firstPart = pathParts[0];

    // Check if it matches version pattern
    if (this.config.versionPattern.test(firstPart)) {
      return firstPart;
    }

    return null;
  }

  /**
   * Check if URL contains a version
   */
  public hasVersion(request: Request): boolean {
    return this.extractVersion(request) !== null;
  }

  /**
   * Add version to URL
   */
  public addVersion(url: string, version: string): string {
    try {
      const urlObj = new URL(url);

      // If already has version, replace it
      const pathname = urlObj.pathname;
      if (pathname.includes(`/${version}/`) || pathname.endsWith(`/${version}`)) {
        urlObj.pathname = this.replaceVersion(urlObj.pathname, version);
      } else {
        // Add version after prefix
        const prefix = this.config.prefix;
        if (urlObj.pathname.startsWith(prefix)) {
          const remainingPath = urlObj.pathname.substring(prefix.length);
          urlObj.pathname = `${prefix}/${version}${remainingPath}`;
        } else {
          urlObj.pathname = `/${version}${urlObj.pathname}`;
        }
      }

      return urlObj.toString();
    } catch {
      // If URL parsing fails, try simple string manipulation
      return this.addVersionToPath(url, version);
    }
  }

  /**
   * Remove version from URL
   */
  public removeVersion(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.pathname = this.removeVersionFromPath(urlObj.pathname);
      return urlObj.toString();
    } catch {
      return this.removeVersionFromPath(url);
    }
  }

  /**
   * Get base URL without version
   */
  public getBaseUrl(request: Request): string {
    const url = request.originalUrl || request.url;
    try {
      const urlObj = new URL(url, `http://${request.get('host')}`);
      urlObj.pathname = this.removeVersionFromPath(urlObj.pathname);
      return urlObj.toString();
    } catch {
      return this.removeVersionFromPath(url);
    }
  }

  /**
   * Generate versioned routes for an endpoint
   */
  public generateVersionedRoutes(baseRoute: string, versions: string[]): Record<string, string> {
    const routes: Record<string, string> = {};

    for (const version of versions) {
      routes[version] = this.addVersion(baseRoute, version);
    }

    return routes;
  }

  /**
   * Validate version format
   */
  public isValidVersion(version: string): boolean {
    return this.config.versionPattern.test(version);
  }

  // Private helper methods

  private replaceVersion(pathname: string, newVersion: string): string {
    const parts = pathname.split('/').filter(Boolean);
    const prefixIndex = this.config.prefix.split('/').filter(Boolean).length;

    if (parts.length > prefixIndex && this.config.versionPattern.test(parts[prefixIndex])) {
      parts[prefixIndex] = newVersion;
    }

    return '/' + parts.join('/');
  }

  private addVersionToPath(url: string, version: string): string {
    // Simple string manipulation for URLs that can't be parsed
    const prefix = this.config.prefix;

    if (url.includes(prefix)) {
      const prefixIndex = url.indexOf(prefix) + prefix.length;
      const nextSlash = url.indexOf('/', prefixIndex);

      if (nextSlash === -1) {
        // Prefix is at the end
        return url + `/${version}`;
      } else {
        // Insert version after prefix
        return url.substring(0, nextSlash) + `/${version}` + url.substring(nextSlash);
      }
    }

    // No prefix found, prepend version
    return `/${version}${url}`;
  }

  private removeVersionFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    const prefixParts = this.config.prefix.split('/').filter(Boolean);
    const prefixIndex = prefixParts.length;

    // Find where prefix ends
    let pathIndex = 0;
    let prefixMatch = true;

    for (let i = 0; i < prefixParts.length; i++) {
      if (parts[i] !== prefixParts[i]) {
        prefixMatch = false;
        break;
      }
      pathIndex = i + 1;
    }

    if (prefixMatch && parts.length > pathIndex && this.config.versionPattern.test(parts[pathIndex])) {
      // Remove the version part
      parts.splice(pathIndex, 1);
    }

    return '/' + parts.join('/');
  }

  /**
   * Get version pattern
   */
  public getPattern(): RegExp {
    return this.config.versionPattern;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<UrlVersioningConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
