# Audit Engine & Observability

Tenet features a high-fidelity audit system designed to meet strict regulatory compliance standards, including **SOC2**, **GDPR**, and **HIPAA**. Logging is integrated directly into the request lifecycle, ensuring that every operation is recorded without requiring developer intervention.

---

## 🛰️ Automatic Lifecycle Logging

The framework automatically monitors and records the execution of every handler. A standard audit event captures the full context of a request:

| Field | Description |
|-------|-------------|
| `eventType` | Categorization based on the operation (e.g., CREATE, AUTH, SECURITY). |
| `action` | The specific semantic action (e.g., `user.login`, `project.delete`). |
| `actor` | Details of the executing user, including ID and IP address. |
| `resource` | Type and identifier of the object being manipulated. |
| `tenant_id` | Scoping information for multi-tenant isolation. |
| `severity` | Severity level (INFO, NOTICE, WARNING, CRITICAL). |

---

## 🛡️ Configuration & Customization

Granular audit control is available within the `HandlerConfig` for specialized requirements:

```typescript
auditConfig: {
  // Enables fine-grained diff tracking (Old Value vs New Value)
  trackDataChanges: true,

  // Automatically mask PII or sensitive keys in the audit metadata
  sensitiveFields: ['password', 'token', 'credit_card'],

  // Custom categorization for reporting
  category: 'FINANCIAL',
  tags: ['billing-critical', 'pci-dss'],
}
```

---

## 🏛️ Data Retention & Compliance

Audit logs are managed by a retention policy engine that ensures logs are preserved according to legal requirements and pruned once they are no longer needed.

- **`auth`**: 1 Year retention (Login history, access attempts).
- **`security`**: 7 Year retention (Escalations, configuration changes, violations).
- **`general`**: 90 Day retention (Standard operational CRUD).

---

## 📊 Reporting Utilities

The framework provides built-in reporters for common auditing tasks:
- **User Activity Timeline**: Focused audit trail for specific user identifiers.
- **Resource Lineage**: Chronological map of all changes to a specific dataset.
- **Anomaly Detection**: Access report highlighting failed authentication and authorization attempts.
