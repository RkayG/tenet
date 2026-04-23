/**
 * Secure API Handler Framework for Node.js + Express + Prisma
 *
 * A comprehensive framework for building secure, multi-tenant API handlers
 * with authentication, sanitization, encryption, rate limiting, caching,
 * and observability features.
 *
 * @packageDocumentation
 */

// Core framework
export { createAuthenticatedHandler } from './core/handler';
export { createPublicHandler } from './core/handler';
export { createSuperAdminHandler } from './core/handler';
export { createTenantHandler } from './core/handler';

// Types and interfaces
export type {
  HandlerConfig,
  HandlerContext,
  User,
  AuthToken,
  ApiResponse,
  ApiError,
  TenantContext,
  TraceContext,
  SanitizationConfig,
  CacheConfig,
  RateLimitConfig,
  MonitoringConfig,
  AppConfig,
  ApiVersion,
  FrameworkEvent,
  ErrorCode,
  OwnershipConfig,
} from './core/types';

// Authentication
export { JWTStrategy } from './auth/strategies/jwt';
export { AuthManager } from './auth/manager';

// Security
export { SanitizationService } from './security/sanitization';
export { EncryptionService } from './security/encryption';

// Rate limiting
export { RedisRateLimiter } from './security/rate-limiting';
export { MemoryRateLimiter } from './security/rate-limiting';

// Caching
export { RedisCache } from './caching/redis';
export { MemoryCache } from './caching/memory';
export { CacheManager } from './caching/manager';

// Monitoring & Observability
export { MonitoringService } from './monitoring/service';
export { HealthChecker } from './monitoring/health';

// Multi-tenancy
export { TenantManager } from './multitenancy/manager';
export { SharedSchemaStrategy } from './multitenancy/strategies/shared-schema';

// API Versioning
export { VersionManager } from './versioning/manager';
export { UrlVersioningStrategy } from './versioning/strategies/url';
export { HeaderVersioningStrategy } from './versioning/strategies/header';

// Configuration
export { ConfigManager } from './config/manager';
export { EnvironmentConfig } from './config/providers/environment';
export { FeatureFlags } from './config/feature-flags';

// Database
export { DatabaseManager } from './database/manager';
export { ConnectionPool } from './database/pool';

// Utilities
export { Logger } from './utils/logger';
export { ValidationUtils } from './utils/validation';
export { CryptoUtils } from './utils/crypto';
export { DateUtils } from './utils/date';

// Response helpers
export {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  rateLimitResponse,
  internalErrorResponse,
  serviceUnavailableResponse,
  healthCheckResponse,
} from './core/response';

// Audit Trail
export {
  AuditService,
  AuditReporter,
  AuditRetentionManager,
  createAuditMiddleware,
  skipHealthChecks,
  defaultAuditConfig,
  AuditEventType,
  AuditCategory,
  AuditStatus,
  AuditSeverity,
} from './audit';

export type {
  AuditEventData,
  AuditLog,
  AuditQueryFilter,
  AuditQueryOptions,
  AuditQueryResult,
  AuditServiceConfig,
  AuditContext,
  AuditReportConfig,
  AuditReport,
  RetentionPolicy,
  RetentionCleanupResult,
} from './audit';

// Re-export commonly used external dependencies for convenience
export { z } from 'zod';
export { PrismaClient } from '@prisma/client';
