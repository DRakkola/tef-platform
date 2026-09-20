# Incident Management & Response Policy

This framework defines the escalation ladder, severity classifications, operational roles, communication protocols, and blameless Root Cause Analysis (RCA) procedures for production incidents affecting the TEF platform.

---

## 1. Severity Classifications & SLAs

| Severity Level | Definition & Criteria | Target TTA (Acknowledge) | Target TTR (Mitigate) | Update Cadence |
|:---|:---|:---|:---|:---|
| **SEV-1 (Critical)** | Complete platform outage, active data loss, security compromise, or payment processing failure affecting > 50% users. | **< 15 minutes** | **< 2 hours** | Every 30 minutes |
| **SEV-2 (Major)** | Core module degraded (e.g., AI speaking evaluator offline, writing submissions failing, practice pool queue stuck). | **< 30 minutes** | **< 4 hours** | Every 60 minutes |
| **SEV-3 (Minor)** | Non-critical functionality degraded with available workaround (e.g. avatar upload failure, localized dashboard metric delay). | **< 2 hours** | **< 24 hours** | Every 4 hours |
| **SEV-4 (Low)** | Cosmetic UI glitch, minor typo, or edge-case documentation issue. | **< 24 hours** | Next release cycle | As needed |

---

## 2. Incident Response Roles

During an active SEV-1 or SEV-2 incident:

1. **Incident Commander (IC)**:
   - Owns the response strategy and coordinates engineering efforts.
   - Makes emergency callouts and assigns diagnostic tasks.
   - Authorizes high-risk mitigations (e.g. database failover, maintenance mode, rollback).
2. **Operations Lead**:
   - Executes technical diagnostics, log inspection (`structlog`), Prometheus metrics analysis, and container rollbacks.
3. **Communications Lead**:
   - Posts external updates to the public status page (`status.tef-prep.example.com`).
   - Drafts user advisory notices for active students and teachers.

---

## 3. Incident Lifecycle & Procedures

### Phase 1: Detection & Triage
- Triggered via Prometheus alert (`ALERTING.md`) or customer support ticket.
- On-call engineer acknowledges alert via PagerDuty/Slack within 15 minutes.
- Quick verification: Check `/health/ready`, `/metrics`, and reverse proxy error rates.

### Phase 2: Containment & Mitigation
- **Primary Goal**: Restore service availability immediately, even if via degraded mode:
  - If upstream AI provider down: Enable `FEATURE_FLAG_AI_SPEAKING = False` or `FEATURE_FLAG_AI_WRITING = False`.
  - If unexpected database table locks: Terminate locking queries (`pg_terminate_backend`) or fail over to read replica.
  - If bad release deployed: Trigger zero-downtime container rollback (`docs/DEPLOYMENT.md`).
  - If active compromise detected: Invalidate all active JWT tokens and revoke Redis sessions immediately.

### Phase 3: Resolution & Verification
- Verify error rate drops to baseline (< 0.05%).
- Run `python scripts/smoke_test.py https://app.tef-prep.example.com`.
- Demote incident status and notify stakeholders of resolution.

---

## 4. Communication Templates

### SEV-1 Initial Notification (Statuspage / Customer Notice)
> **Subject**: [Investigating] Issues accessing TEF Canada practice platform
> 
> **Message**: We are currently investigating an issue impacting access to the TEF platform and practice modules. Our engineering team is actively diagnosing the root cause. Next update will be provided within 30 minutes.

### Resolution Notification
> **Subject**: [Resolved] All TEF platform services restored
> 
> **Message**: The issue causing service degradation has been successfully resolved. All mock assessments, writing corrections, and speaking sessions are operating normally. We apologize for the interruption.

---

## 5. Blameless Post-Mortem & RCA Template

Within 48 hours of any SEV-1 or SEV-2 resolution, the IC must submit a written post-mortem covering:

1. **Executive Summary**: Brief narrative of the incident and impact.
2. **Timeline (UTC)**:
   - `HH:MM`: Trigger event occurred
   - `HH:MM`: Automated alert fired
   - `HH:MM`: Incident Commander acknowledged
   - `HH:MM`: Mitigation applied
   - `HH:MM`: Service verified healthy
3. **Root Cause Analysis (5 Whys)**: Deep causal breakdown without assigning personal blame.
4. **Impact Assessment**: Total downtime minutes, number of affected users, dropped mock exams or failed bookings.
5. **Corrective & Preventative Action Items**: Specific GitHub issues assigned to owners with due dates to eliminate the failure mode permanently.
