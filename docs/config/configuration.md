# Configuration

The `HandlerConfig` interface allows you to granularly configure every aspect of an API endpoint. While [Security Presets](../security/presets.md) provide good defaults, you often need to override specific settings.

## HandlerConfig Reference

```typescript
interface HandlerConfig<TInput, TOutput> {
  // Core
  handler: (ctx: HandlerContext<TInput>) => Promise<TOutput>;
  schema?: ZodSchema<TInput>;
  preset?: SecurityPresetName;

  // Authentication & Authorization
  requireAuth?: boolean;          // Force authentication
  authStrategies?: string[];      // e.g. ['jwt', 'api-key']
  allowedRoles?: string[];        // RBAC: e.g. ['ADMIN']

  // Multi-Tenancy
  tenantRoleValidation?: boolean; // Check tenant membership roles
  autoTenantScope?: boolean;      // Enable Prisma auto-filter

  // Security
  rateLimit?: RateLimitConfig;
  csrfProtection?: boolean;       // Enable Double-Submit Cookie pattern
  idempotency?: boolean;          // Specific for POST/PUT non-safe ops
  encryptedFields?: string[];     // Fields to auto-decrypt in input

  // Observability
  auditConfig?: AuditConfig;
  monitoring?: MonitoringConfig;

  // Caching
  cache?: CacheConfig;
}
```

### Rate Limiting

Controls the request rate for the specific endpoint.

```typescript
rateLimit: {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,         // Limit per IP/User
}
```

### Caching

Configures response caching.

```typescript
cache: {
  ttl: 60, // Seconds
  // Custom key generator
  keyGenerator: (req) => `${req.path}:${req.query.type}`
}
```

### Audit Configuration

Fine-tune what gets logged.

```typescript
auditConfig: {
  enabled: true,
  trackDataChanges: true,     // Log before/after snapshots (db writes)
  captureResponseBody: false, // Don't log potentially large responses
  sensitiveFields: ['password', 'ssn'], // Mask these fields
  tags: ['billing', 'critical']
}
```

### Ownership Verification

Automatically verify that a user owns the resource they are trying to access/modify.

```typescript
requireOwnership: {
  model: 'Project',           // Prisma model name
  resourceIdParam: 'id',      // URL param usually
  ownerIdField: 'userId',     // Field on model pointing to owner
}
```
