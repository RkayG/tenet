# Security Presets

To simplify configuration, Tenet provides "Presets" that bundle security settings for common scenarios. You should start with a preset and only override what is strictly necessary.

## Usage

```typescript
createHandler({
  preset: 'authenticated', // Apply the preset
  rateLimit: { maxRequests: 50 } // Override specific setting
  // ...
})
```

## Available Presets

### `public`
Use for: Landing pages, public catalogs, health checks.
- **Auth**: None.
- **Rate Limit**: IP-based.
- **CSRF**: Disabled.
- **Audit**: Minimal (errors only).

### `authenticated` (Default)
Use for: Standard user-facing API endpoints.
- **Auth**: Required (JWT/Session).
- **Rate Limit**: User-based.
- **CSRF**: Enabled for mutation methods.
- **Audit**: Full activity logging.
- **Sanitization**: Strict.

### `admin`
Use for: Back-office administration.
- **Auth**: Required + `SUPER_ADMIN` role check.
- **Rate Limit**: Strict (prevent brute force on sensitive ops).
- **Audit**: Critical severity.
- **MFA**: Recommended (implied by policy).

### `tenant`
Use for: SaaS application endpoints.
- **Auth**: Required.
- **Multi-Tenancy**: Enabled (Auto-scope Prisma, context resolution).
- **Authorization**: Checks Tenant Role (e.g., must be Member/Admin of target tenant).

### `readonly`
Use for: Public data retrieval (e.g., blog posts) that might be authenticated but safe.
- **Auth**: Optional/Required (configurable).
- **Caching**: Aggressive defaults.
- **CSRF**: Disabled (GET requests don't need it).

### `highSecurity`
Use for: Payments, password changes, changing 2FA.
- **Auth**: Strict.
- **Idempotency**: Required.
- **Timeouts**: Short (15s).
- **Audit**: Captures full request/response bodies.
