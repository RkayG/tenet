# Handler Factories

The Tenet framework utilizes a **Factory Pattern** to standardize the lifecycle of API endpoints. Rather than interfacing with raw Express route handlers, we define endpoints using specialized factory functions. This architecture ensures that security, validation, auditing, and observability are applied consistently across the entire application.

---

## 🏗️ Core Benefits

### Declarative Security
Define the security requirements for an endpoint (e.g., role-based access, rate limits, ownership constraints) within a configuration object. The framework handles the middleware orchestration automatically.

### Automated Type Safety
Input schemas defined with **Zod** are automatically used to infer the static types for the handler's `input`. This eliminates manual type casting and ensures runtime validation strictly matches the TypeScript contracts.

### Context-Rich Execution
Handlers receive a simplified `HandlerContext` that contains pre-resolved identities, verified ownership data, and a database client (Prisma) that is automatically scoped to the user's active tenant.

---

## 🔓 `createPublicHandler`

Used for endpoints that do not require authentication, such as public webhooks, health checks, or discovery endpoints. While open, these endpoints still benefit from the framework's rate limiting and input sanitization engines.

### Implementation Example

```typescript
import { createPublicHandler, z } from '@tenet/api';

export const healthCheck = createPublicHandler({
  schema: z.object({
    echo: z.string().optional(),
  }),
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 50,
  },
  handler: async ({ input }) => {
    return {
      status: 'service_healthy',
      echo: input.echo,
      timestamp: new Date().toISOString(),
    };
  },
});
```

---

## 🔒 `createAuthenticatedHandler`

The standard factory for protected endpoints. It enforces a "valid session" constraint; if the request arrives without a verifiable identity, the framework automatically returns `401 Unauthorized`.

### Implementation Example

```typescript
import { createAuthenticatedHandler, z } from '@tenet/api';

export const updateProfile = createAuthenticatedHandler({
  schema: z.object({
    displayName: z.string().min(2).max(50),
    bio: z.string().max(500).optional(),
  }),
  handler: async ({ input, user, prisma }) => {
    // Identity is guaranteed by the factory
    return await prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.displayName,
        bio: input.bio,
      },
    });
  },
});
```

---

## 🏢 `createTenantHandler`

Use this for **SaaS applications**. It adds a layer of multi-tenant isolation on top of authentication. It ensures the user belongs to the requested tenant and provides a database client that **automatically filters data** for that tenant.

### Implementation Example

```typescript
import { createTenantHandler, z } from '@tenet/api';

export const getProjectDetails = createTenantHandler({
  schema: z.object({
    projectId: z.string().uuid(),
  }),

  // Authorization: Only allow these roles within the tenant
  allowedRoles: ['ADMIN', 'MEMBER'],

  handler: async ({ input, prisma, tenant }) => {
    // Queries are automatically scoped: WHERE tenant_id = tenant.id
    return await prisma.project.findUnique({
      where: { id: input.projectId },
    });
  },
});
```

---

## 🛡️ `createSuperAdminHandler`

Reserved for critical system-level operations. Access is restricted to users with the global `SUPER_ADMIN` role. Operations through this handler are logged with elevated severity.

### Implementation Example

```typescript
import { createSuperAdminHandler, z } from '@tenet/api';

export const deactivateTenant = createSuperAdminHandler({
  schema: z.object({
    tenant_id: z.string().cuid(),
  }),
  handler: async ({ input, prisma }) => {
    await prisma.tenant.update({
      where: { id: input.tenant_id },
      data: { isActive: false },
    });
    return { success: true };
  },
});
```
