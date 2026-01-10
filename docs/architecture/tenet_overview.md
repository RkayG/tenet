# Tenet Architecture Overview

Tenet is an **opinionated, enterprise-grade API framework** built for Node.js. It is designed to solve the common challenges of building secure, compliant, and scalable SaaS applications without reinventing the wheel for every project.

## 🧠 Core Philosophy

### 1. Security by Default
Most frameworks require you to "opt-in" to security checks. In Tenet, security is **opt-out**. By default, every handler you create has:
- Strict input sanitization
- Authentication checks
- CSRF protection (for mutations)
- Rate limiting
- Secure HTTP headers

### 2. Configuration over Boilerplate
Developers spend too much time writing the same 20 lines of middleware setup for every text endpoint. Tenet uses a **declarative configuration object** (`HandlerConfig`) to define behavior. You describe *what* you want (e.g., "Authenticated, Rate Limited, Audited"), and the framework constructs the pipeline.

### 3. Type Safety as a First-Class Citizen
The framework leverages TypeScript to its fullest.
- **Input Types**: Derived automatically from Zod schemas.
- **Database Types**: Generated from your Prisma schema.
- **Context Types**: Guaranteed user/tenant presence based on your configuration.

---

## 🏗️ Technical Stack Choices

We chose a "Boring but Proven" technology stack to ensure long-term maintainability and stability.

### Express.js (The Core)
**Why?** Ecosystem maturity.
While newer runtimes (Bun, Deno) and frameworks (Fastify, Hono) are exciting, Express remains the industry standard. It has the largest ecosystem of middleware, best documentation, and is battle-tested in virtually every enterprise environment. We wrap Express to provide modern features (async handling, typed inputs) while keeping compatibility with its vast ecosystem.

### Prisma (The Data Layer)
**Why?** Developer experience and type safety.
Prisma's ability to introspect the database and generate a type-safe client is unmatched. For multi-tenancy, its Client Extensions API allows us to inject security filters (row-level security logic) directly into the query builder, preventing data leaks at the application level.

### Zod (Validation)
**Why?** Runtime validation with static type inference.
Zod is the bridge between the untyped world of HTTP JSON payloads and the strictly typed world of TypeScript. It is composable, readable, and powerful enough to handle complex validation rules.

### Redis (Infrastructure)
**Why?** Distributed performance.
We rely on Redis for:
- **Rate Limiting**: Distributed counters across multiple API instances.
- **Caching**: Storing API responses.
- **Idempotency**: Tracking processed request keys.
It is a simple, robust infrastructure requirement that scales horizontally.

---

## 🔄 The Request Pipeline

When a request hits a Tenet API endpoint, it traverses a sophisticated pipeline before reaching your business logic.

```mermaid
graph TD
    A[Incoming Request] --> B[Security Headers (Helmet)]
    B --> C[Rate Limiting (Redis)]
    C --> D[Input Sanitization (XSS/SQLi)]
    D --> E[Authentication (JWT/API Key)]
    E --> F[Tenant Resolution]
    F --> G[Tenant Authorization]
    G --> H[Input Validation (Zod)]
    H --> I[Audit Log (Start)]
    I --> J{Business Logic}
    J --> K[Response]
    K --> L[Audit Log (Complete)]
```

### 1. The Shield (Outer Layer)
Before we even parse the body, we apply Helmets, check IP rate limits, and sanitize raw inputs. This protects the application from common flood and injection attacks.

### 2. The Context (Middle Layer)
We identify **Who** (User) and **Where** (Tenant) the request is coming from.
- **Authentication**: Validates tokens.
- **Resolution**: determines the active tenant from headers/subdomain.
- **Authorization**: Checks if the user belongs to the tenant and has required roles.

### 3. The Guard (Inner Layer)
We validate the semantic correctness of the input using Zod schemas. If this passes, the input is guaranteed effectively safe and typed.

### 4. The Handler (Your Code)
Finally, your function runs. It receives a clean context: a validated `input`, a confirmed `user`, and a pre-scoped `prisma` client.

---

## 🏢 Why use Tenet?

### For Startups
**Speed to MVP.** You get a production-ready foundation with Auth, Multi-Tenancy, and Logging out of the box. You focus 100% on your product's unique value.

### For Enterprises
**Compliance & Standardization.** Tenet enforces patterns that satisfy security audits (SOC2/GDPR). The uniform structure means any developer can jump into any backend system built with Tenet and understand it immediately.
