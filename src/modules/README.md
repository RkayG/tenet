# Modules Directory

This directory contains **modular feature implementations** for the Tenet framework. Each module represents a **single, cohesive domain** (e.g., Tasks, Users, Products) and follows a consistent structure.

## 📁 Module Structure

Each module should follow this standardized structure:

```
modules/
└── your-module-name/
    ├── routes/
    │   └── your-module-routes.ts    # Express route definitions
    ├── services/
    │   └── your-module-service.ts   # Business logic layer
    ├── validators/
    │   └── your-module-validators.ts # Zod validation schemas
    └── README.md (optional)          # Module-specific documentation
```

## 🎯 Design Principles

### 1. **Single Responsibility**
Each module handles **ONE domain** only. Don't mix multiple unrelated features.

✅ **GOOD**: `task-module` handles only task management  
❌ **BAD**: `task-user-product-module` handles multiple domains

### 2. **Consistent Naming**
- **Modules**: `kebab-case` (e.g., `task-management`, `user-profile`)
- **Files**: `kebab-case` with descriptive suffixes (e.g., `task-routes.ts`, `task-service.ts`)
- **Classes**: `PascalCase` (e.g., `TaskService`)
- **Functions**: `camelCase` (e.g., `createTask`)

### 3. **Dependency Injection**
Services should accept dependencies (like Prisma) rather than creating them internally.

```typescript
// ✅ GOOD
constructor(config: Config = {}, prisma?: PrismaClient) {
  this.prisma = prisma ?? (global as any).prisma;
}

// ❌ BAD
constructor() {
  this.prisma = new PrismaClient(); // Hard-coded dependency
}
```

### 4. **Type Safety**
Always use TypeScript types inferred from Zod schemas.

```typescript
// Define schema
export const createTaskSchema = z.object({ ... });

// Infer type
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// Use in service
public async createTask(data: CreateTaskInput) { ... }
```

## 📚 Example Module: Task Management

The `example-module` demonstrates a complete **Task Management** system. Study this module to understand:

### **Validators** (`validators/example-validators.ts`)
- ✅ Input validation with Zod
- ✅ Type inference for TypeScript
- ✅ Reusable schemas
- ✅ Complex validation rules

**Key Patterns**:
```typescript
// Basic schema
export const createTaskSchema = z.object({
  title: z.string().min(3).max(200),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

// Partial schema for updates
export const updateTaskSchema = createTaskSchema.partial();

// Type inference
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
```

### **Services** (`services/example-service.ts`)
- ✅ Singleton pattern
- ✅ Business logic separation
- ✅ Database operations
- ✅ Error handling
- ✅ Notification hooks

**Key Patterns**:
```typescript
export class TaskService {
  private static instance: TaskService;
  
  public static getInstance(config?, prisma?): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService(config, prisma);
    }
    return TaskService.instance;
  }
  
  public async createTask(data: CreateTaskInput, userId: string) {
    // Business logic here
    return await this.prisma.task.create({ ... });
  }
}
```

### **Routes** (`routes/example-route.ts`)
- ✅ Express router setup
- ✅ Handler configuration
- ✅ Authentication & authorization
- ✅ Ownership verification
- ✅ Caching & rate limiting
- ✅ Audit logging

**Key Patterns**:
```typescript
// Tenant-scoped route with validation
// Automatically requires authentication and multitenancy
router.post('/tasks', createTenantHandler({
  schema: createTaskSchema,
  handler: async ({ input, user }) => {
    return await taskService.createTask(input, user.id, user.tenant_id);
  },
  auditConfig: {
    enabled: true,
    action: 'task.create',
  },
}));

// Route with ownership verification
router.get('/tasks/:id', createTenantHandler({
  requireOwnership: {
    model: 'Task',
    resourceIdParam: 'id',
    ownerIdField: 'tenantId',
  },
  handler: async ({ resource }) => {
    return resource; // Already loaded and verified
  },
}));
```

## 🚀 Creating a New Module

### Step 1: Create Directory Structure
```bash
mkdir -p src/modules/your-module/routes
mkdir -p src/modules/your-module/services
mkdir -p src/modules/your-module/validators
```

### Step 2: Create Validators
Define your Zod schemas in `validators/your-module-validators.ts`:

```typescript
import { z } from 'zod';

export const createItemSchema = z.object({
  name: z.string().min(3).max(100),
  // ... other fields
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
```

### Step 3: Create Service
Implement business logic in `services/your-module-service.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { CreateItemInput } from '../validators/your-module-validators';

export class YourModuleService {
  private static instance: YourModuleService;
  private prisma: PrismaClient;

  private constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? (global as any).prisma ?? new PrismaClient();
  }

  public static getInstance(prisma?: PrismaClient): YourModuleService {
    if (!YourModuleService.instance) {
      YourModuleService.instance = new YourModuleService(prisma);
    }
    return YourModuleService.instance;
  }

  public async createItem(data: CreateItemInput, userId: string, tenantId: string) {
    return await this.prisma.item.create({
      data: { ...data, userId, tenantId },
    });
  }
}
```

### Step 4: Create Routes
Define Express routes in `routes/your-module-routes.ts`:

```typescript
import { Router } from 'express';
import { createTenantHandler } from '../../../core/handler';
import { YourModuleService } from '../services/your-module-service';
import { createItemSchema } from '../validators/your-module-validators';

const router = Router();
const service = YourModuleService.getInstance();

router.post('/items', createTenantHandler({
  schema: createItemSchema,
  handler: async ({ input, user }) => {
    return await service.createItem(input, user.id, user.tenant_id);
  },
}));

export default router;
```

### Step 5: Register Routes
In your main `server.ts` or `index.ts`:

```typescript
import yourModuleRoutes from './modules/your-module/routes/your-module-routes';

app.use('/api', yourModuleRoutes);
```

## 🔒 Security Best Practices

### 1. **Always Validate Input**
```typescript
// ✅ GOOD
router.post('/items', createTenantHandler({
  schema: createItemSchema, // Validates input
  handler: async ({ input }) => { ... }
}));

// ❌ BAD
router.post('/items', async (req, res) => {
  const data = req.body; // No validation!
});
```

### 2. **Verify Ownership**
```typescript
// ✅ GOOD
router.get('/items/:id', createTenantHandler({
  requireOwnership: {
    model: 'Item',
    resourceIdParam: 'id',
    ownerIdField: 'tenantId',
  },
  handler: async ({ resource }) => resource,
}));
```

### 3. **Use Role-Based Access Control**
```typescript
// Admin-only route
router.delete('/items/:id', createAdminHandler({
  handler: async ({ params }) => { ... },
}));
```

### 4. **Enable Audit Logging**
```typescript
router.post('/items', createTenantHandler({
  auditConfig: {
    enabled: true,
    category: AuditCategory.DATA,
    action: 'item.create',
    captureResponseBody: true,
  },
  handler: async ({ input }) => { ... },
}));
```

## ⚡ Performance Optimization

### 1. **Enable Caching**
```typescript
router.get('/items', createTenantHandler({
  cache: {
    ttl: 300, // Cache for 5 minutes
  },
  handler: async () => { ... },
}));
```

### 2. **Implement Rate Limiting**
```typescript
router.get('/public-items', createPublicHandler({
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  handler: async () => { ... },
}));
```

### 3. **Use Pagination**
```typescript
export const queryItemsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
```

## 📊 Testing Your Module

### Unit Tests (Services)
```typescript
import { TaskService } from './services/task-service';

describe('TaskService', () => {
  it('should create a task', async () => {
    const service = TaskService.getInstance();
    const task = await service.createTask({ ... }, 'user-id', 'tenant-id');
    expect(task).toBeDefined();
  });
});
```

### Integration Tests (Routes)
```typescript
import request from 'supertest';
import app from '../../../server';

describe('Task Routes', () => {
  it('POST /api/tasks should create a task', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer token')
      .send({ title: 'Test Task' });
    
    expect(response.status).toBe(201);
  });
});
```

## 📖 Additional Resources

- **Framework Documentation**: See main [README.md](../../../README.md)
- **CLAUDE.md**: AI assistant guidelines for this codebase
- **Type Definitions**: See [src/core/types.ts](../../core/types.ts)
- **Handler Utilities**: See [src/core/handler.ts](../../core/handler.ts)

## 🤝 Contributing

When adding a new module:

1. ✅ Follow the established structure
2. ✅ Focus on a single domain
3. ✅ Include comprehensive validation
4. ✅ Implement proper error handling
5. ✅ Add audit logging for sensitive operations
6. ✅ Write tests
7. ✅ Update this README if you add common patterns

---

**Remember**: Modules should be **self-contained**, **focused**, and **reusable**. Keep them simple, secure, and well-documented!
