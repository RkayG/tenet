# API Reference

Welcome to the **Tenet Framework** API reference. This documentation covers the core functions, types, and utilities provided by the framework.

## 📦 Core Exports

The framework provides a set of factory functions to create secure, type-safe API handlers.

### Handler Factories

| Function | Description |
|----------|-------------|
| [`createPublicHandler`](api/handlers.md#createpublichandler) | Create a public API handler (no auth) with validation. |
| [`createAuthenticatedHandler`](api/handlers.md#createauthenticatedhandler) | Create a handler that requires authentication. |
| [`createTenantHandler`](api/handlers.md#createtenanthandler) | Create a handler with automatic tenant scoping and authorization. |

### Configuration

| Interface | Description |
|-----------|-------------|
| [`HandlerConfig`](config/configuration.md#handlerconfig) | Main configuration object for handlers. |
| [`SecurityPreset`](security/presets.md) | Pre-configured security settings (`public`, `authenticated`, `admin`, etc.). |

---

## 🔒 Context & Services

Every handler receives a context object containing these services:

```typescript
type HandlerContext<TInput> = {
  input: TInput;              // Validated Zod input
  user: User | null;          // Authenticated user
  tenant: TenantContext;      // Current tenant (if multi-tenant)
  prisma: PrismaClient;       // Tenant-scoped database client
  request: Request;           // Express request
  modifictions: any;          // Internal use
};
```

---

## 🛠️ Utilities

### Validation

- `z` - Re-export of Zod for schema definition.

### Errors

- `AppError` - Base error class.
- `ValidationError` - Input validation failure.
- `AuthenticationError` - Auth failure.
- `AuthorizationError` - Permission denial.

---

## 📚 Detailed Documentation

- **[Handlers Guide](api/handlers.md)** - Deep dive into creating handlers.
- **[Security Features](security/features.md)** - Rate limiting, encryption, CSRF.
- **[Multi-Tenancy](architecture/multi-tenancy.md)** - Tenant isolation and resolution.
- **[Audit System](api/audit.md)** - Logging and compliance.
