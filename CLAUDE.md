# CLAUDE.md - AI Assistant Guidelines for Secure API Request Handler

## Project Overview

This is a **TypeScript-based secure API framework** with strict type safety and comprehensive security features. The codebase follows enterprise-level patterns with multi-tenancy, audit logging, monitoring, and extensive type checking.

## Critical TypeScript Configuration

### Strict Mode Settings (tsconfig.json)
```json
{
  "strict": true,
  "exactOptionalPropertyTypes": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true
}
```

### Key Implications

1. **`exactOptionalPropertyTypes: true`** - This is CRITICAL
   - Optional properties CANNOT be explicitly set to `undefined`
   - `interface Foo { bar?: string }` means `bar` can be omitted OR be a string, but NOT `undefined`
   - ❌ WRONG: `{ bar: undefined }`
   - ✅ CORRECT: `{}` or `{ bar: "value" }`

2. **`noUncheckedIndexedAccess: true`**
   - Array/object indexing returns `T | undefined`
   - Always check for undefined before using indexed values

## Type Handling Patterns

### ✅ CORRECT Patterns

#### 1. Handling Optional Config Properties
```typescript
// When a config property might be undefined, use nullish coalescing
const metric: Metric = {
  labels: {
    service: this.config.serviceName ?? 'default-service',
    environment: this.config.environment ?? 'development',
  }
};
```

#### 2. Optional Properties in Objects
```typescript
// Only include property if value exists
const auditLog = {
  user_id: user?.id,  // OK - will be string | undefined
  ...(metadata && { metadata }),  // Only add if metadata exists
};

// OR use conditional spreading
const auditLog = {
  ...user?.id && { user_id: user.id },
};
```

#### 3. Record Types with Strict Values
```typescript
// Record<string, string> means ALL values must be strings
const labels: Record<string, string> = {
  key1: value ?? 'default',  // Ensure no undefined
  key2: String(numericValue),  // Convert if needed
};
```

### ❌ INCORRECT Patterns to AVOID

#### 1. Non-Null Assertions (!)
```typescript
// ❌ AVOID - Bypasses type safety
service: this.config.serviceName!,

// ✅ PREFER - Explicit handling
service: this.config.serviceName ?? 'default-service',
```

#### 2. Setting Optional Properties to Undefined
```typescript
// ❌ WRONG with exactOptionalPropertyTypes
interface Config {
  timeout?: number;
}
const config: Config = { timeout: undefined };  // ERROR!

// ✅ CORRECT
const config: Config = {};  // Omit the property
// OR
const config: Config = { timeout: 5000 };  // Provide a value
```

#### 3. Mixing Types in Records
```typescript
// ❌ WRONG
const labels: Record<string, string> = {
  count: 123,  // number is not assignable to string
};

// ✅ CORRECT
const labels: Record<string, string> = {
  count: String(123),
};
```

## Architecture Patterns

### 1. Handler Pattern
- All API handlers use `createHandler` or `createPublicHandler`
- Handlers receive `HandlerContext<TInput>` with validated input
- Always return `Promise<TOutput>`

### 2. Service Layer
- Services are singleton instances (use `getInstance()`)
- Services handle business logic, not HTTP concerns
- Services should be dependency-injected where possible

### 3. Type Safety
- Use Zod schemas for runtime validation
- Define TypeScript interfaces for compile-time safety
- Infer types from Zod schemas: `z.infer<typeof schema>`

### 4. Error Handling
- Use custom error classes from `core/response.ts`
- Always include error codes and messages
- Errors should be caught and transformed to API responses

## File Organization

```
src/
├── core/           # Core framework (handler, types, response)
├── auth/           # Authentication strategies
├── audit/          # Audit logging system
├── monitoring/     # Observability and health checks
├── security/       # Encryption, sanitization, rate limiting
├── caching/        # Cache providers (Redis, Memory)
├── multitenancy/   # Multi-tenant strategies
├── database/       # Database connection management
├── config/         # Configuration management
├── utils/          # Utility functions
└── versioning/     # API versioning
```

## Common Tasks

### Adding a New Handler
1. Define Zod schema for input validation
2. Create handler using `createHandler`
3. Implement business logic in handler function
4. Register route in appropriate router

### Adding a New Service
1. Create singleton class with `getInstance()`
2. Define configuration interface
3. Implement core methods
4. Add health checks if applicable

### Fixing Type Errors

1. **Check tsconfig.json settings** - Understand which strict flags are enabled
2. **Never use `any`** - Use `unknown` and type guards instead
3. **Avoid non-null assertions (!)** - Use nullish coalescing (??) or optional chaining (?.)
4. **Handle undefined explicitly** - Don't assume values exist

## Testing Approach

- Unit tests for services and utilities
- Integration tests for handlers
- Mock external dependencies (database, cache, etc.)
- Test error cases and edge conditions

## Code Style

### Naming Conventions
- **Interfaces**: PascalCase (e.g., `HandlerConfig`)
- **Types**: PascalCase (e.g., `ErrorCode`)
- **Functions**: camelCase (e.g., `createHandler`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`)
- **Files**: kebab-case (e.g., `rate-limiting.ts`)

### Comments
- Use JSDoc for public APIs
- Explain WHY, not WHAT
- Document complex algorithms
- Add TODO/FIXME with context

## Security Considerations

1. **Never log sensitive data** - Use sanitization
2. **Validate all inputs** - Use Zod schemas
3. **Use parameterized queries** - Prevent SQL injection
4. **Implement rate limiting** - Prevent abuse
5. **Audit critical operations** - Track changes

## Performance Guidelines

1. **Use caching strategically** - Cache expensive operations
2. **Implement pagination** - Don't load all data
3. **Use database indexes** - Optimize queries
4. **Monitor metrics** - Track performance over time
5. **Lazy load dependencies** - Import only when needed

## When Making Changes

### Before Editing
1. Read the file outline to understand structure
2. Check related types and interfaces
3. Look for existing patterns to follow
4. Consider backward compatibility

### While Editing
1. Maintain consistent style with existing code
2. Update related tests
3. Add/update documentation
4. Consider edge cases

### After Editing
1. Run TypeScript compiler (`npx tsc --noEmit`)
2. Run linter (`npm run lint`)
3. Run tests (`npm test`)
4. Update CHANGELOG if applicable

## Consistency Rules

### Type Handling Consistency
- **ALWAYS** use `??` (nullish coalescing) instead of `!` (non-null assertion)
- **ALWAYS** provide default values for optional config properties
- **ALWAYS** ensure Record<string, string> values are actually strings
- **NEVER** explicitly set optional properties to `undefined`

### Import Consistency
- Group imports: external → internal → types
- Use absolute paths from `src/`
- Avoid circular dependencies

### Error Handling Consistency
- Use try-catch in async functions
- Always log errors with context
- Return appropriate HTTP status codes
- Include error codes for client handling

## AI Assistant Behavior

### When Analyzing Code
1. Check TypeScript strict mode settings first
2. Look for existing patterns before creating new ones
3. Understand the full context before making changes
4. Consider the impact on other parts of the codebase

### When Fixing Issues
1. Identify the root cause, not just symptoms
2. Fix ALL instances of the same issue, not just one
3. Maintain consistency across the codebase
4. Test the fix thoroughly

### When Adding Features
1. Follow existing architectural patterns
2. Maintain type safety throughout
3. Add appropriate error handling
4. Include monitoring/logging
5. Update documentation

## Common Pitfalls

1. **Forgetting `exactOptionalPropertyTypes`** - Don't set optional props to undefined
2. **Using non-null assertions** - Defeats the purpose of strict mode
3. **Inconsistent error handling** - Use framework error classes
4. **Missing validation** - Always validate external input
5. **Ignoring monitoring** - Add metrics for new features
6. **Breaking changes** - Consider backward compatibility

## Resources

- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- Zod Documentation: https://zod.dev/
- Express.js Guide: https://expressjs.com/
- Prisma Documentation: https://www.prisma.io/docs/

---

**Remember**: This codebase prioritizes **type safety**, **security**, and **consistency**. When in doubt, choose the safer, more explicit option.
