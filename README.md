# Secure API Handler Template

A comprehensive, enterprise-grade API handler framework for **Node.js + Express + Prisma** to build secure, multi-tenant systems with authentication, sanitization, encryption, rate limiting, caching, and observability.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.6-green.svg)](https://prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🚀 Features

### Core Security
- **Authentication** - JWT, API Key, OAuth strategies
- **Input Sanitization** - HTML, SQL injection, XSS protection
- **Data Encryption** - AES-256-GCM encryption with key management
- **Rate Limiting** - Redis-based distributed rate limiting
- **Request Validation** - Zod schema validation

### Multi-Tenant Support
- **Tenant Isolation** - Shared schema, separate schema, separate database
- **Tenant Context** - Automatic tenant resolution and context management
- **Resource Ownership** - Automatic ownership verification

### Performance & Reliability
- **Caching Layer** - Redis + Memory cache with invalidation
- **API Versioning** - URL-based and header-based versioning
- **Health Checks** - Comprehensive system health monitoring
- **Monitoring & Observability** - Metrics, tracing, error tracking

### Developer Experience
- **TypeScript** - Full type safety and IntelliSense
- **Feature Flags** - Dynamic feature toggles
- **Configuration Management** - Environment-based config
- **Comprehensive Documentation** - API reference and guides

### Audit Trail & Compliance
- **Automatic Audit Logging** - Track all API operations automatically
- **Data Change Tracking** - Before/after snapshots for compliance
- **Flexible Querying** - Filter and search audit logs
- **Compliance Reports** - GDPR, SOC2, HIPAA-ready reports
- **Retention Policies** - Automatic cleanup based on data category
- **Export Capabilities** - CSV, JSON export for analysis

## 📦 Installation

```bash
# Clone the template
git clone https://github.com/RkayG/secure-api-request-handler
cd secure-api-request-handler

# Install dependencies
npm install

# Set up Prisma
npx prisma generate

# Copy environment file
cp .env.example .env

# Configure your environment variables
nano .env

# Run database migrations
npx prisma db push

# Start the development server
npm run dev
```

## ⚡ Quick Start

### 1. Basic API Handler

```typescript
import express from 'express';
import { createHandler } from 'secure-api-handler';

const app = express();

// Basic GET handler
app.get('/api/items', createHandler({
  schema: z.object({
    limit: z.number().min(1).max(100).optional().default(10),
    offset: z.number().min(0).optional().default(0),
  }),
  handler: async ({ input, prisma }) => {
    const { limit, offset } = input;

    const items = await prisma.item.findMany({
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return items;
  },
}));

app.listen(3000, () => console.log('Server running on port 3000'));
```

### 2. Authenticated Handler with Ownership

```typescript
import { Router } from 'express';
import { createAuthenticatedHandler } from 'secure-api-handler';

const router = Router();

// PUT /api/projects/:id
router.put('/projects/:id', createAuthenticatedHandler({
  schema: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
  }),
  requireOwnership: {
    model: 'Project',
    resourceIdParam: 'id',
    ownerIdField: 'ownerId',
    selectFields: ['id', 'name', 'ownerId'],
  },
  handler: async ({ input, prisma, params, resource }) => {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: input,
      select: { id: true, name: true, description: true, updatedAt: true },
    });
    return project;
  },
}));

export default router;
```

### 3. Advanced Handler with Caching & Rate Limiting

```typescript
import { Router } from 'express';
import { createHandler } from 'secure-api-handler';

const router = Router();

// GET /api/products
router.get('/products', createHandler({
  schema: z.object({
    category: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
  }),
  cache: {
    ttl: 300, // 5 minutes
    keyGenerator: (req) => `products:${req.query.category || 'all'}:${req.query.limit}:${req.query.offset}`,
  },
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
  },
  handler: async ({ input, prisma }) => {
    const { category, limit, offset } = input;

    const whereClause: any = {};
    if (category) {
      whereClause.category = category;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    return {
      products,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  },
}));

export default router;
```

## 🏗️ Architecture

```
secure-api-handler/
├── core/                    # Core framework (Express middleware)
│   ├── handler.ts          # Main API handler factory
│   ├── types.ts            # TypeScript definitions
│   └── response.ts         # Response utilities
├── prisma/                 # Database schema & migrations
│   └── schema.prisma       # Prisma schema definition
├── auth/                    # Authentication strategies
│   ├── strategies/         # JWT, API Key, OAuth
│   └── manager.ts          # Auth manager
├── security/                # Security features
│   ├── sanitization.ts     # Input/output sanitization
│   ├── encryption.ts       # Data encryption
│   └── rate-limiting.ts    # Rate limiting
├── caching/                 # Caching layer
│   ├── redis.ts            # Redis cache
│   ├── memory.ts           # Memory cache
│   └── manager.ts          # Cache manager
├── monitoring/              # Observability
│   ├── service.ts          # Monitoring service
│   └── health.ts           # Health checks
├── versioning/              # API versioning
│   ├── manager.ts          # Version manager
│   └── strategies/         # URL/Header strategies
├── config/                  # Configuration
│   ├── manager.ts          # Config manager
│   └── feature-flags.ts    # Feature flags
├── multitenancy/            # Multi-tenant support
├── database/                # Database utilities
└── utils/                   # Helper utilities
```

## 🔧 Configuration

### Environment Variables

```bash
# Database (Prisma)
DATABASE_URL=postgresql://user:password@localhost:5432/secure_api
# For MySQL: mysql://user:password@localhost:3306/secure_api

# Authentication
JWT_SECRET=your-super-secret-jwt-key
AUTH_STRATEGIES=jwt,api_key

# Security
ENCRYPTION_KEY=your-encryption-key
RATE_LIMITING_ENABLED=true
XSS_PROTECTION_ENABLED=true

# Caching
CACHE_PROVIDER=redis
REDIS_URL=redis://localhost:6379
CACHE_DEFAULT_TTL=300

# Monitoring
MONITORING_PROVIDER=datadog
SERVICE_NAME=my-api
MONITORING_API_KEY=your-api-key

# Multi-tenancy
MULTITENANCY_ENABLED=true
MULTITENANCY_STRATEGY=shared_schema
TENANT_HEADER=X-Tenant-ID

# Feature Flags
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_EXPERIMENTAL_UI=false
```

### Feature Flags

Enable or disable features dynamically:

```typescript
import { FeatureFlags } from 'secure-api-handler';

const features = FeatureFlags.getInstance();

// Enable a feature
features.enable('advanced-analytics');

// Check if feature is enabled
if (features.isEnabled('advanced-analytics', { userId: '123' })) {
  // Show advanced analytics
}

// Override for specific user
features.overrideForUser('experimental-ui', 'user-123', true);
```

## 🔒 Security Features

### Input Sanitization

Automatic sanitization of all inputs:

```typescript
// HTML sanitization
const cleanHtml = sanitizeService.sanitizeHTML('<script>alert("xss")</script>');
// Result: <p>alert("xss")</p>

// SQL injection prevention
const safeQuery = sanitizeService.preventSQLInjection("'; DROP TABLE users; --");
// Result: anitized input

// Sensitive data masking
const masked = sanitizeService.maskSensitiveData("password: secret123");
// Result: password: *********
```

### Data Encryption

Encrypt sensitive data automatically:

```typescript
import { EncryptionService } from 'secure-api-handler';

const encryption = EncryptionService.getInstance();

// Encrypt data
const encrypted = await encryption.encrypt({ password: 'secret' });

// Decrypt data
const decrypted = await encryption.decrypt(encrypted);
```

### Rate Limiting

Distributed rate limiting with Redis:

```typescript
rateLimit: {
  windowMs: 60000,    // 1 minute
  maxRequests: 100,   // 100 requests per minute
  keyGenerator: (req, user) => `api:${user?.id}:${req.nextUrl.pathname}`,
}
```

### Dependency Scanning

Automated security scanning for vulnerable dependencies:

#### npm audit (Built-in)

The project includes npm audit scripts for security scanning:

```bash
# Check for vulnerabilities
npm run audit

# Fix automatically fixable issues
npm run audit:fix

# Check only production dependencies
npm run audit:production

# Get JSON output for CI/CD
npm run audit:json

# Check with custom severity level
npm run security:check
```

#### Dependabot (GitHub)

Automated dependency updates via Dependabot are configured in `.github/dependabot.yml`:

- **Weekly updates** - Checks for updates every Monday
- **Security-first** - Prioritizes security vulnerabilities
- **Grouped PRs** - Groups updates to reduce PR noise
- **Auto-labeling** - Labels PRs with `dependencies` and `security`

Dependabot will automatically:
- Create PRs for security vulnerabilities
- Update dependencies weekly
- Group related updates together
- Ignore major version updates (for manual review)

#### Alternative: Snyk

For more advanced scanning, you can use Snyk:

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor project
snyk monitor

# Fix vulnerabilities
snyk wizard
```

**Recommendation**: Use **npm audit** for quick checks and **Dependabot** for automated updates. Snyk is optional for teams needing advanced features like license compliance and container scanning.

### Static Analysis

Detect unsafe code patterns and security vulnerabilities in your codebase:

#### ESLint Security Plugins

The project includes security-focused ESLint plugins to catch common vulnerabilities:

```bash
# Run standard linting
npm run lint

# Run security-focused linting
npm run lint:security

# Generate JSON report
npm run lint:report

# Auto-fix issues
npm run lint:fix
```

**Security Rules Detected:**
- Object injection vulnerabilities
- Non-literal file system operations
- Unsafe regex patterns
- Eval usage
- CSRF vulnerabilities
- Timing attacks
- Unsafe buffer operations
- Child process vulnerabilities
- Insecure randomness
- Dangerous redirects

**Configuration**: See `.eslintrc.json` for full security rules configuration.

#### SonarQube

For enterprise-grade code quality and security analysis:

**Setup:**

1. Install SonarQube Scanner:
   ```bash
   # macOS/Linux
   brew install sonar-scanner
   
   # Or download from: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/
   ```

2. Configure SonarQube server connection in `sonar-project.properties`

3. Run analysis:
   ```bash
   npm run analyze:sonar
   ```

**Features:**
- Code quality metrics
- Security vulnerability detection
- Code smell detection
- Code duplication analysis
- Test coverage integration
- Technical debt tracking

**Configuration Files:**
- `sonar-project.properties` - Project configuration
- `.sonarlint.json` - IDE integration settings

**SonarQube Cloud**: For hosted solutions, use [SonarCloud](https://sonarcloud.io/) (free for open source projects).

#### Combined Analysis

Run all static analysis tools together:

```bash
# Run linting, type checking, and dependency audit
npm run analyze
```

**Recommendation**: 
- Use **ESLint security plugins** for real-time feedback during development
- Use **SonarQube** for comprehensive code quality analysis in CI/CD pipelines
- Integrate both into your development workflow for maximum security coverage

## 📊 Monitoring & Observability

### Health Checks

```typescript
import { HealthChecker } from 'secure-api-handler';

const healthChecker = HealthChecker.getInstance();

// Add database health check
healthChecker.registerCheck(
  'database',
  HealthChecker.createDatabaseCheck('database', async () => {
    const client = getDatabaseClient();
    await client.query('SELECT 1');
    return true;
  })
);

// Add Redis health check
healthChecker.registerCheck(
  'redis',
  HealthChecker.createRedisCheck('redis', redisClient)
);

// Check overall health
const health = await healthChecker.getOverallHealth();
console.log(health.status); // 'healthy' | 'unhealthy' | 'degraded'
```

### Metrics & Tracing

```typescript
import { MonitoringService } from 'secure-api-handler';

const monitoring = MonitoringService.getInstance();

// Record custom metrics
monitoring.recordMetric('api.requests', 1, {
  method: 'GET',
  endpoint: '/api/users',
  status: 200,
});

// Start a trace span
const spanId = monitoring.startSpan('user-creation', {
  userId: '123',
  email: 'user@example.com',
});

// End the span
monitoring.endSpan(spanId, 'ok');
```

## 🏢 Multi-Tenant Support

### Configuration

```typescript
multitenancy: {
  enabled: true,
  strategy: 'shared_schema', // 'shared_schema' | 'separate_schema' | 'separate_database'
  tenantHeader: 'X-Tenant-ID',
}
```

### Tenant-Aware Handlers

```typescript
export const GET = createTenantHandler({
  handler: async ({ tenant, supabase }) => {
    // Tenant context is automatically available
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenant.id);

    return data;
  },
});
```

## 🏷️ API Versioning

### URL-Based Versioning

```
GET /api/v1/users
GET /api/v2/users
```

### Header-Based Versioning

```typescript
// Accept-Version: v2
GET /api/users
```

### Version Management

```typescript
import { VersionManager } from 'secure-api-handler';

const versionManager = VersionManager.getInstance();

// Check version compatibility
const isCompatible = versionManager.isVersionSupported('v1', 'v1');

// Deprecate a version
versionManager.deprecateVersion('v1', new Date('2024-12-31'));
```

## 📋 Audit Trail & Compliance

The framework includes a comprehensive audit trail system for tracking all API operations, user actions, and data changes with full compliance support.

### Features

- **Automatic Logging** - All handler operations logged automatically
- **Data Change Tracking** - Before/after snapshots for compliance
- **Flexible Querying** - Filter by user, tenant, event type, date range
- **Compliance Reports** - GDPR, SOC2, HIPAA-ready reports
- **Retention Policies** - Automatic cleanup based on data category
- **Export Capabilities** - CSV and JSON export for analysis

### Basic Usage

```typescript
import { createAuthenticatedHandler } from 'secure-api-handler';

// Enable audit logging in handler
app.put('/api/projects/:id', createAuthenticatedHandler({
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  requireOwnership: {
    model: 'Project',
    resourceIdParam: 'id',
  },
  // Audit configuration
  auditConfig: {
    enabled: true,
    resourceType: 'Project',
    trackDataChanges: true, // Capture before/after state
    captureResponseBody: true,
    tags: ['project', 'update'],
    retentionCategory: 'general', // 90 days retention
  },
  handler: async ({ input, params, prisma }) => {
    return await prisma.project.update({
      where: { id: params.id },
      data: input,
    });
  },
}));
```

### Query Audit Logs

```typescript
import { AuditService } from 'secure-api-handler';

const auditService = AuditService.getInstance();

// Query logs with filters
const result = await auditService.queryLogs(
  {
    userId: 'user-123',
    eventTypes: ['CREATE', 'UPDATE', 'DELETE'],
    startDate: new Date('2024-01-01'),
    endDate: new Date(),
  },
  {
    page: 1,
    pageSize: 20,
    sortOrder: 'desc',
  }
);

// Get resource history
const history = await auditService.getResourceHistory('Project', 'project-123');

// Get user activity
const activity = await auditService.getUserActivity('user-123');
```

### Generate Compliance Reports

```typescript
import { AuditReporter } from 'secure-api-handler';

const reporter = AuditReporter.getInstance();

// User activity report
const userReport = await reporter.generateUserActivityReport(
  'user-123',
  startDate,
  endDate
);

// Security report
const securityReport = await reporter.generateSecurityReport(startDate, endDate);

// Compliance report
const complianceReport = await reporter.generateComplianceReport(
  startDate,
  endDate,
  'tenant-123'
);

// Export to CSV
const csv = await reporter.exportToCSV({ startDate, endDate });

// Export to JSON
const json = await reporter.exportToJSON({ startDate, endDate });
```

### Retention Management

```typescript
import { AuditRetentionManager } from 'secure-api-handler';

const retentionManager = AuditRetentionManager.getInstance();

// Start automatic cleanup (runs every 24 hours)
retentionManager.startAutomaticCleanup(24);

// Manual cleanup
const result = await retentionManager.runCleanup();
console.log(`Deleted ${result.deletedCount} expired logs`);
```

### Configuration

```typescript
import { AuditService } from 'secure-api-handler';

const auditService = AuditService.getInstance({
  enabled: true,
  autoLogAuth: true,
  autoLogCRUD: true,
  maskSensitiveData: true,
  sensitiveFields: ['password', 'token', 'secret', 'apiKey'],
  asyncLogging: true,
  batchSize: 100,
  retentionPolicies: {
    general: 90,        // 90 days
    auth: 365,          // 1 year
    security: 2555,     // 7 years (compliance)
    compliance: 2555,   // 7 years
    admin: 730,         // 2 years
  },
});
```

### Global Middleware

```typescript
import { createAuditMiddleware, skipHealthChecks } from 'secure-api-handler';

// Apply to all routes
app.use(createAuditMiddleware({
  enabled: true,
  skipPathPatterns: skipHealthChecks,
  captureQueryParams: true,
}));
```

## 🐳 Docker & Deployment

### Docker Setup

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
COPY prisma/ ./prisma/
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

COPY dist/ ./dist/
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/app
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=app
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password

  redis:
    image: redis:7-alpine
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e
```

## 📚 Examples

Check out the `examples/` directory for complete implementations:

- `examples/basic-api/` - Simple CRUD API
- `examples/multi-tenant-app/` - Multi-tenant application
- `examples/advanced-features/` - Advanced features showcase

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [Redis](https://redis.io/) - In-memory data structure store
- [DOMPurify](https://github.com/cure53/DOMPurify) - XSS sanitizer
