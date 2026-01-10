# Audit System

The Audit System provides a comprehensive trail of all actions performed within the API. It is designed to satisfy compliance requirements for **SOC2**, **GDPR**, and **HIPAA**.

## Automatic Logging

By default, the framework logs an event for every API request handled.

### Event Structure

```json
{
  "id": "evt_123",
  "eventType": "UPDATE",
  "category": "DATA",
  "action": "project.update",
  "status": "SUCCESS",
  "severity": "INFO",
  "actor": {
    "userId": "user_123",
    "ip": "1.2.3.4"
  },
  "resource": {
    "type": "Project",
    "id": "proj_abc",
    "tenantId": "tenant_xyz"
  },
  "changes": {
    "title": { "old": "Proposal A", "new": "Proposal B" }
  },
  "metadata": {
    "userAgent": "Mozilla/5.0...",
    "requestId": "req_789"
  }
}
```

## Configuration

You can customize logging per handle:

```typescript
auditConfig: {
  // Capture the full JSON response? (Use carefully!)
  captureResponseBody: true,

  // Calculate diff of data before/after update?
  trackDataChanges: true,

  // Mask PII automatically
  sensitiveFields: ['password', 'creditCard'],

  // Custom tagging
  tags: ['billing-critical'],
}
```

## Data Retention

The `AuditRetentionManager` handles automated cleanup of old logs based on their legal requirements.

| Category | Typical Retention | Description |
|----------|-------------------|-------------|
| `auth` | 1 Year | Logins, password changes. |
| `admin` | 2 Years | Administrative actions. |
| `security` | 7 Years | Security incidents, policy changes. |
| `general` | 90 Days | Standard CRUD operations. |

## Compliance Reporting

The framework includes utilities to generate CSV/JSON reports for auditors:

- **User Activity Report**: Everything a specific user did.
- **Resource History**: Timeline of changes to a specific object.
- **System Access**: List of all logins/failed attempts.
