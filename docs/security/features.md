# Security Features

Tenet enforces a **Security by Default** philosophy. This page details the specific security mechanisms built into the framework.

## 1. Authentication

The framework supports multiple authentication strategies simultaneously. By default, it looks for a Bearer token in the `Authorization` header.

- **JWT**: Standard stateless tokens.
- **API Key**: Long-lived keys for machine-to-machine communication.
- **OAuth**: Google/GitHub integration (extensible).

Strategies are tried in the order specified in `authStrategies`.

## 2. Input Sanitization

Every request input (body, query, params) undergoes rigorous sanitization **before** it reaches your handler.

- **HTML**: Strips dangerous tags (scripts, iframes) using `dompurify` to prevent XSS.
- **SQL**: Detects and blocks obvious SQL injection patterns (though Prisma prevents this via parameterized queries, this is an extra defense layer).
- **Trimming**: Whitespace is trimmed from strings.

## 3. Rate Limiting

Distributed rate limiting is implemented using **Redis** (with a memory fallback).

- **Sliding Window**: Prevents burst attacks at window boundaries.
- **Context Aware**: Limits by User ID (if authenticated) or IP address (if public).
- **Headers**: Returns standard `X-RateLimit-*` headers.

## 4. CSRF Protection

For state-changing operations (POST, PUT, DELETE), we implement the **Double-Submit Cookie** pattern.

1. Getting a secure `csrf-token` cookie.
2. Requiring the `X-CSRF-Token` header to match the cookie hash.

This is enabled by default in the `authenticated` and `highSecurity` presets.

## 5. Idempotency

Prevents duplicate processing of the same request (e.g., payment charges).

- Clients send an `Idempotency-Key` header.
- The framework caches the response of the first successful request.
- Subsequent requests with the same key return the **cached response** immediately, without re-executing the handler logic.

## 6. Data Encryption

AES-256-GCM encryption helper is available for sensitive fields at rest.

```typescript
// Auto-decrypts input fields specified in config
encryptedFields: ['socialSecurityNumber']
```

## 7. Security Headers

The framework automatically sets strict security headers (Helmet):

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
