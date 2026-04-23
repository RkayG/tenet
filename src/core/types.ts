/**
 * Comprehensive TypeScript types and interfaces for the Tenet Framework
 */

import { Request, Response } from 'express';
import { z } from 'zod';

// ============================================
// Core User and Authentication Types
// ============================================

export interface User {
  id: string;
  email: string;
  tenantId: string;
  role?: string;
  permissions?: string[];
  metadata?: Record<string, any>;
  last_login?: Date;
  is_active?: boolean;
}

export interface AuthToken {
  access_token: string;
  refresh_token?: string;
  token_type: 'Bearer';
  expires_in: number;
  expires_at: Date;
}

export interface AuthStrategy {
  name: string;
  authenticate(request: Request): Promise<User | null>;
  refresh?(token: string): Promise<User | null>;
  validate?(token: string): Promise<boolean>;
}

// ============================================
// Handler Configuration Types
// ============================================

export interface HandlerConfig<TInput = unknown, TOutput = unknown> {
  /**
   * Security preset to use (optional)
   * Provides pre-configured security settings that can be overridden
   * 
   * Available presets:
   * - 'public': No auth, IP rate limiting
   * - 'authenticated': Basic auth + CSRF
   * - 'admin': Superadmin only
   * - 'tenant': Multi-tenant with auto-scoping
   * - 'readonly': GET requests with caching
   * - 'highSecurity': Payments, idempotency required
   */
  preset?: 'public' | 'authenticated' | 'admin' | 'tenant' | 'readonly' | 'highSecurity';

  /** Zod schema for input validation */
  schema?: z.ZodSchema<TInput>;

  /** Whether authentication is required */
  requireAuth?: boolean;

  /** Authentication strategies to use */
  authStrategies?: string[];

  /** Allowed user roles */
  allowedRoles?: string[];

  /** Required permissions */
  requiredPermissions?: string[];

  /** Automatic resource ownership verification */
  requireOwnership?: OwnershipConfig;

  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;

  /** Caching configuration */
  cache?: CacheConfig;

  /** Whether to automatically sanitize the response */
  sanitizeResponse?: boolean;

  /** API version requirements */
  apiVersion?: string;

  /** Custom success status code */
  successStatus?: number;

  /** Monitoring configuration */
  monitoring?: MonitoringConfig;

  /** Feature flags */
  featureFlags?: string[];

  /** Audit trail configuration */
  auditConfig?: AuditConfig;

  /**
   * Validate that user's role is scoped to the current tenant
   * Prevents cross-tenant role escalation attacks
   * @default true (when multitenancy is enabled)
   */
  tenantRoleValidation?: boolean;

  /**
   * Automatically scope all database queries to current tenant
   * Adds tenantId filter to Prisma queries via middleware
   * @default true (when using createTenantHandler)
   */
  autoTenantScope?: boolean;

  /**
   * Enable CSRF protection for state-changing requests
   * @default true (for authenticated endpoints)
   */
  csrfProtection?: boolean;

  /**
   * Enable idempotency support
   * @default false
   */
  idempotency?: boolean;

  /**
   * Request timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /** The actual request handler */
  handler: (ctx: HandlerContext<TInput>) => Promise<TOutput>;
}

export interface AuditConfig {
  /** Enable audit logging for this handler */
  enabled?: boolean | undefined;

  /** Event type override (auto-detected from HTTP method if not provided) */
  eventType?: string | undefined;

  /** Category override */
  category?: string | undefined;

  /** Custom action name */
  action?: string | undefined;

  /** Capture request body in audit log */
  captureRequestBody?: boolean | undefined;

  /** Capture response body in audit log */
  captureResponseBody?: boolean | undefined;

  /** Track data changes (for UPDATE/DELETE operations) */
  trackDataChanges?: boolean | undefined;

  /** Resource type for data change tracking */
  resourceType?: string | undefined;

  /** Custom metadata to include in audit log */
  metadata?: Record<string, any> | undefined;

  /** Tags for categorizing audit logs */
  tags?: string[] | undefined;

  /** Retention category */
  retentionCategory?: string | undefined;
}

export interface OwnershipConfig {
  model: string;              // Prisma model name (e.g., 'User', 'Project')
  resourceIdParam: string;    // URL parameter name containing resource ID
  resourceIdField?: string | undefined;   // Field name for resource ID (default: 'id')
  ownerIdField?: string | undefined;      // Field name for owner ID (e.g., 'userId', 'createdBy')
  tenantIdField?: string | undefined;     // Field name for tenant ID (e.g., 'tenantId')
  selectFields?: string[] | undefined;    // Fields to select (Prisma syntax)
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean | undefined;
  skipFailedRequests?: boolean | undefined;
  keyGenerator?: ((req: Request, user?: User | undefined) => string) | undefined;
  handler?: ((req: Request, res: Response) => Promise<Response>) | undefined;
}

export interface CacheConfig {
  ttl: number;
  keyGenerator?: ((req: Request, user?: User | undefined) => string) | undefined;
  condition?: ((req: Request, user?: User | undefined) => boolean) | undefined;
  invalidateOn?: string[] | undefined;
}

export interface MonitoringConfig {
  enableTracing?: boolean | undefined;
  enableMetrics?: boolean | undefined;
  customTags?: Record<string, string> | undefined;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | undefined;
}

// ============================================
// Handler Context and Response Types
// ============================================

export interface HandlerContext<TInput = unknown> {
  /** Validated input data */
  input: TInput;

  /** Authenticated user */
  user: User | null;

  /** Prisma client instance */
  prisma: any; // PrismaClient type

  /** URL parameters */
  params: Record<string, string>;

  /** Query string parameters */
  query: Record<string, any>;

  /** Original Express request object */
  request: Request;

  /** Verified resource data */
  resource?: any | undefined;

  /** Tenant context */
  tenant?: TenantContext | undefined;

  /** Request tracing information */
  trace?: TraceContext | undefined;

  /** Cache instance */
  cache?: any | undefined; // Redis type
}

export interface TenantContext {
  id: string;
  name: string;
  config: Record<string, any>;
  database?: string;
  schema?: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: Date;
  tags: Record<string, string>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
  traceId?: string;
}

export interface ApiMeta {
  timestamp: string;
  version: string;
  requestId: string;
  executionTime?: number;
  cached?: boolean;
  idempotent?: boolean;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_FORBIDDEN'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'REQUEST_TIMEOUT';

// ============================================
// Security and Sanitization Types
// ============================================

export interface SanitizationConfig {
  html?: HtmlSanitizationConfig;
  sql?: SqlSanitizationConfig;
  xss?: XssProtectionConfig;
  sensitive?: SensitiveDataConfig;
}

export interface HtmlSanitizationConfig {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  selfClosing?: string[];
  allowComments?: boolean;
}

export interface SqlSanitizationConfig {
  allowedOperators?: string[];
  maxQueryLength?: number;
  preventInjection?: boolean;
}

export interface XssProtectionConfig {
  enabled: boolean;
  customPatterns?: RegExp[];
  escapeHtml?: boolean;
}

export interface SensitiveDataConfig {
  fields: string[];
  maskCharacter?: string;
  maskLength?: number;
  algorithms?: EncryptionAlgorithm[];
}

export type EncryptionAlgorithm = 'AES-256-GCM' | 'AES-256-CBC' | 'RSA-OAEP';

// ============================================
// Caching Types
// ============================================

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: Date;
  tags?: string[];
}

export interface CacheInvalidationRule {
  pattern: string;
  tags?: string[];
  condition?: (key: string, entry: CacheEntry) => boolean;
}

// ============================================
// Monitoring and Observability Types
// ============================================

export interface Metric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: Record<string, string>;
  timestamp?: Date;
}

export interface TraceSpan {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  attributes: Record<string, any>;
  events: TraceEvent[];
  status?: 'ok' | 'error';
}

export interface TraceEvent {
  name: string;
  timestamp: Date;
  attributes: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

// ============================================
// Configuration Types
// ============================================

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  port: number;
  host: string;

  // Database
  database: DatabaseConfig;

  // Authentication
  auth: AuthConfig;

  // Security
  security: SecurityConfig;

  // Caching
  cache: CacheProviderConfig;

  // Monitoring
  monitoring: MonitoringProviderConfig;

  // Multi-tenancy
  multitenancy: MultitenancyConfig;

  // Feature flags
  features: Record<string, boolean>;
}

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  ssl: boolean;
  timeout: number;
}

export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
  };
  strategies: string[];
}

export interface SecurityConfig {
  encryption: {
    algorithm: EncryptionAlgorithm;
    key: string;
  };
  rateLimiting: {
    enabled: boolean;
    redisUrl?: string | undefined;
  };
  sanitization: SanitizationConfig;
}

export interface CacheProviderConfig {
  provider: 'redis' | 'memory' | 'none';
  redis?: RedisConfig;
  defaultTtl: number;
}

export interface RedisConfig {
  url: string;
  password?: string | undefined;
  database?: number | undefined;
}

export interface MonitoringProviderConfig {
  provider: 'datadog' | 'newrelic' | 'prometheus' | 'none';
  apiKey?: string | undefined;
  serviceName: string;
  environment: string;
}

export interface MultitenancyConfig {
  tenantHeader: string;
  defaultTenant?: string | undefined;
}

// ============================================
// API Versioning Types
// ============================================

export interface ApiVersion {
  version: string;
  path: string;
  deprecated?: boolean;
  sunsetDate?: Date;
  changelog?: string[];
}

export interface VersionConfig {
  current: string;
  supported: string[];
  default: string;
  header: string;
  parameter: string;
}

// ============================================
// Utility Types
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// ============================================
// Event Types for Extensibility
// ============================================

export interface FrameworkEvent {
  type: string;
  timestamp: Date;
  data: Record<string, any>;
  context?: HandlerContext;
}

export type FrameworkEventType =
  | 'handler:start'
  | 'handler:complete'
  | 'handler:error'
  | 'auth:success'
  | 'auth:failure'
  | 'cache:hit'
  | 'cache:miss'
  | 'rate_limit:exceeded'
  | 'sanitization:applied'
  | 'encryption:applied';
