# Multi-Tenancy Architecture

Tenet provides a robust multi-tenancy system designed for B2B SaaS applications. It ensures data isolation at the infrastructure level while keeping the developer experience simple.

## Tenant Resolution

The framework determines the current tenant context for every request strategy:

1.  **Header**: `X-Tenant-ID` (Most common for APIs)
2.  **Subdomain**: `marketing.app.com` -> tenant `marketing`
3.  **Token Claim**: `tenant_id` inside JWT

Once resolved, the `tenant` object is available in the handler context:

```typescript
handler: async ({ tenant }) => {
  console.log(tenant.id); // 'tenant-123'
}
```

## Data Isolation

We use **Prisma Client Extensions** to enforce logical separation of data within a Shared Database strategy (Row-Level Security concept).

### Automatic Scoping

When `autoTenantScope: true` (default in `tenant` preset), the framework:

1.  Intercepts the `prisma` client instance.
2.  Should the model have a `tenantId` field?
3.  **YES**: Automatically appends `WHERE tenantId = ?` to every query (find, update, delete).
4.  **YES**: Automatically injects `data: { tenantId: ? }` on create.

### Example

```typescript
// Developer writes:
await prisma.project.findMany();

// Framework executes:
SELECT * FROM "Project" WHERE "tenantId" = 'current-tenant-id';
```

## Tenant Authorization

Beyond just knowing the tenant, we verify the **User's Membership**.

- A user might be authenticated but not a member of the requested tenant.
- The `tenant` preset automatically checks the `TenantMember` table.
- You can enforce roles: `allowedRoles: ['ADMIN']` ensures the user is a Tenant Admin.

## Database Strategies supported

1.  **Shared Database (Schema-based)**: (Default) All tenants in one DB, separated by `tenantId` column.
2.  **Separate Schemas**: Postgres schemas (`tenant_a`, `tenant_b`).
3.  **Separate Databases**: Physically distinct DBs (Enterprise tier).

*Currently, the framework is optimized for Strategy 1 (Shared Database).*
