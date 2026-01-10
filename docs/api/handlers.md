# Helper Factories

The Tenet framework uses a **Factory Pattern** to create API endpoints. Instead of writing raw Express routes, you define handlers using `createHandler` and its variants. This ensures that validation, security, logging, and error handling are applied consistently.

## ✨ The Beauty of Tenet Handlers

Why use these helpers instead of raw Express routes?

### 1. Declarative & Type-Safe
Define your input schema once using Zod, and get full TypeScript type inference for your handler's `input` automatically. No more manual type casting or validation checks.

### 2. Security by Default
Every handler comes with built-in protection:
- **Input Sanitization**: XSS and injection attacks are blocked before your code runs.
- **Rate Limiting**: Intelligent limits prevent abuse.
- **Security Headers**: Best-practice HTTP headers are set automatically.

### 3. Focus on Business Logic
Your handler function is clean. It receives validated inputs, an authenticated user, and a tenant-scoped database client. You just write the logic.

---

## `createPublicHandler`

Use this for endpoints that **do not require authentication**, such as health checks, login routes, or public webhooks.

### Usage

```typescript
import { createPublicHandler, z } from '@tenet/api';

export const healthCheck = createPublicHandler({
  // Optional: Validate query params
  schema: z.object({
    echo: z.string().optional(),
  }),

  // Optional: Custom rate limit for public routes
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 20,
  },

  handler: async ({ input }) => {
    return {
      status: 'ok',
      echo: input.echo,
      timestamp: new Date(),
    };
  },
});
```

---

## `createAuthenticatedHandler`

The standard way to build API endpoints. This helper ensures that a valid user is present before your handler runs. If the user is missing or the token is invalid, it returns `401 Unauthorized` automatically.

### Usage

```typescript
import { createAuthenticatedHandler, z } from '@tenet/api';

export const updateProfile = createAuthenticatedHandler({
  // Input validation
  schema: z.object({
    displayName: z.string().min(2).max(50),
    bio: z.string().max(500).optional(),
  }),

  handler: async ({ input, user, prisma }) => {
    // 'user' is guaranteed to be defined here
    console.log(`User ${user.id} is updating profile`);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.displayName,
        bio: input.bio,
      },
    });

    return updatedUser;
  },
});
```

### Key Features
- **Guaranteed User Context**: The `user` object is fully typed and non-null.
- **Audit Logging**: Automatically logs the user ID and action.
- **CSRF Protection**: Enabled by default for mutation methods (POST/PUT/DELETE).

---

## `createTenantHandler`

Use this for **SaaS applications**. It adds a layer of multi-tenant isolation on top of authentication. It ensures the user belongs to the requested tenant and provides a database client that **automatically filters data** for that tenant.

### Usage

```typescript
import { createTenantHandler, z } from '@tenet/api';

export const getProjectDetails = createTenantHandler({
  schema: z.object({
    projectId: z.string().uuid(),
  }),

  // Authorization: Only allow these roles within the tenant
  allowedRoles: ['ADMIN', 'MEMBER'],

  handler: async ({ input, prisma, tenant }) => {
    // 'prisma' is automatically scoped to 'tenant.id'
    // You cannot accidentally query another tenant's data
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
    });

    return project;
  },
});
```

### Key Features
- **Auto-Scoping**: The `prisma` client injects `WHERE tenantId = ?` into queries.
- **Role Verification**: Checks the user's role specifically within the current tenant context.
- **Tenant Context**: Provides details about the active tenant.

---

## `createSuperAdminHandler`

For internal back-office tools. This requires the user to have a global `SUPER_ADMIN` system role.

### Usage

```typescript
import { createSuperAdminHandler, z } from '@tenet/api';

export const deleteTenant = createSuperAdminHandler({
  schema: z.object({
    tenantId: z.string(),
  }),

  handler: async ({ input, prisma }) => {
    // High-privilege operation
    await prisma.tenant.delete({
      where: { id: input.tenantId },
    });

    return { success: true };
  },
});
```

### Key Features
- **Strict Authorization**: Only global super admins can access.
- **Critical Audit**: Logs are marked with `CRITICAL` severity and retained for 7 years.
