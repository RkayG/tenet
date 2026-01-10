# API Design Standards

To ensure a consistent developer experience for frontend teams and 3rd-party integrators, all APIs built with Tenet must adhere to these standards.

## 📐 Core Principles

1.  **JSON First**: All requests and responses must communicate in `application/json`.
2.  **ISO 8601 Dates**: All timestamps must be returned in UTC ISO 8601 format (e.g., `2024-03-15T14:30:00Z`).
3.  **Snake Case**: The API accepts and returns properties in `camelCase` (standard JavaScript convention), though internally we map to database columns.
4.  **Stateless**: The API does not rely on server-side session state; authentication is token-based.

---

## 📦 Response Format

Every API response is wrapped in a standardized envelope. This ensures clients can always check the `success` field before parsing data.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "usr_123",
    "name": "Alice"
  },
  "meta": {
    "requestId": "req_89234-234",
    "timestamp": "2024-03-15T14:30:00Z",
    "version": "1.0.0"
  }
}
```

- **success**: Always `true` for 2xx responses.
- **data**: The actual payload. Can be an object or an array.
- **meta**: Request metadata (ID for tracing, timestamp).

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email address provided",
    "details": {
      "email": ["Invalid format"]
    },
    "traceId": "trc_998877"
  }
}
```

- **success**: Always `false` for 4xx/5xx responses.
- **error.code**: A stable, machine-readable string (e.g., `RESOURCE_NOT_FOUND`).
- **error.message**: A human-readable English message.
- **error.details**: Optional structured data explaining the error (validation fields).

---

## 🚦 HTTP Status Codes

We use a strict subset of HTTP status codes to communicate outcome.

| Comde | Meaning | When to use |
|-------|---------|-------------|
| **200** | OK | Standard success for GET, PUT, DELETE. |
| **201** | Created | Successful creation (POST). Should return the new resource. |
| **400** | Bad Request | Client sent invalid data (Zod validation failure). |
| **401** | Unauthorized | User is not logged in or token is invalid. |
| **403** | Forbidden | User is logged in but lacks permission (e.g., wrong tenant). |
| **404** | Not Found | Resource ID does not exist. |
| **409** | Conflict | Unique constraint violation (e.g., email already taken). |
| **429** | Too Many Requests | Rate limit exceeded. Retry later. |
| **500** | Internal Error | Server bug. Check logs with `traceId`. |

---

## 📄 Pagination

Collections are paginated using the standard Limit/Offset or Page/Size pattern.

**Request:**
`GET /api/projects?page=1&limit=20`

**Response:**

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

## ⚠️ Standard Error Codes

Use these `error.code` string values for consistent client-side handling.

- `VALIDATION_ERROR`: Zod schema check failed.
- `AUTHENTICATION_ERROR`: Token invalid/expired.
- `AUTHORIZATION_ERROR`: Insufficient permissions.
- `RESOURCE_NOT_FOUND`: ID look up failed.
- `RATE_LIMIT_EXCEEDED`: Too many requests.
- `INTERNAL_SERVER_ERROR`: Uncaught exception.
- `TENANT_CONTEXT_MISSING`: Tenant ID header required but missing.
