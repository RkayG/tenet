# Example Module - Task Management

This module serves as a reference implementation for building features within the Tenet framework. It demonstrates how to implement a complete vertical slice of functionality (Tasks) while following the framework's security, multi-tenancy, and architectural patterns.

## Directory Structure

```text
example-module/
├── dtos/                # Data Transfer Objects (API response structures)
│   └── task.dto.ts
├── routes/              # Express routes using framework handlers
│   └── example-route.ts
├── services/            # Business logic and database operations
│   └── example-service.ts
└── validators/          # Zod schemas for input validation
    └── example-validators.ts
```

## Key Features Demonstrated

### 1. Secure Route Handlers
The module uses specialized handler wrappers from the core:
- `createTenantHandler`: Automatically requires authentication and enforces tenant isolation.
- `createPublicHandler`: For endpoints accessible without authentication (with built-in rate limiting).

### 2. Multi-Tenancy & Isolation
- **Automatic Scoping**: Routes pass the scoped `prisma` client from the `HandlerContext` to the service. This client uses the framework's Prisma extension to automatically filter all queries by `tenant_id`.
- **Tenant Context**: Uses `tenant.id` from the context for resource creation and validation.

### 3. Resource Ownership
- Demonstrates the `requireOwnership` configuration to ensure users can only access or modify resources belonging to their tenant.
- Example:
  ```typescript
  requireOwnership: {
      model: 'task',
      resourceIdParam: 'id',
      tenant_idField: 'tenant_id',
  }
  ```

### 4. Input Validation
- Uses Zod schemas located in the `validators/` directory to strictly validate all incoming request bodies and query parameters.
- Combines validation with the framework's built-in sanitization to protect against XSS and injection.

### 5. Standardized Responses (DTOs)
- Implements DTOs to ensure a consistent API contract and prevent leaking sensitive database fields.
- Returns structured `ApiResponse` objects as enforced by the core handler.

### 6. Observability & Audit
- Individual routes are configured with `auditConfig` to track data changes, view events, and security-relevant actions.
- Performance metrics are automatically recorded for all operations.

## How to use as a template

1. Copy the `example-module` folder to a new directory in `src/modules/`.
2. Rename the files and update the logic to match your new domain.
3. Define your data models in `prisma/schema.prisma`.
4. Register your new router in the main application entry point.
