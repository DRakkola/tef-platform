# TEF Canada Platform — Daily & Weekly Beta Operations Runbook

**Document Version:** 1.0.0-beta  
**Date:** September 18, 2026  
**Audience:** Site Reliability Engineers (SRE), Platform Operations, Support Engineers, Community Managers  
**Scope:** Private Beta Cohort 1 & 2 Operations (10–50 Students, 5–15 Teachers)  

---

## 1. Daily Operational Schedule

### 1.1 Morning System Inspection (08:00 UTC)
Duration: ~15 minutes  
Assigned to: Primary On-Call SRE / Operations Lead

- [ ] **Infrastructure Health Check:**
  - Query health endpoint: `curl -sSf https://api.tef-prep.example.com/api/v1/health/ready | jq .`
  - Verify all 4 subsystems report `"connected"` (`database`, `redis`, `storage`, `celery`).
- [ ] **Container & Node Metrics:**
  - Verify host CPU $< 50\%$ and Memory RSS $< 70\%$: `docker stats --no-stream`
  - Check disk space: `df -h /` (must have $\ge 20\%$ free capacity).
- [ ] **Error Log Inspection:**
  - Review Sentry / structured logs for unexpected 5xx spikes or unhandled exceptions in the last 12 hours:
    ```bash
    docker compose logs --tail=100 api | grep -i "error" | grep -v "app_exception"
    ```
- [ ] **Celery Asynchronous Tasks:**
  - Check Celery queue depth: `docker compose exec api uv run celery -A app.core.celery_app inspect active`
  - Verify dead-letter queue count is 0.
- [ ] **Database Replication & Backup Verification:**
  - Confirm the 06:00 UTC automated database snapshot completed and was mirrored to cold storage:
    ```bash
    ls -l /backups/postgres | tail -n 3
    ```
- [ ] **Post Morning Status in Slack/Discord `#beta-ops`:**
  - *"Morning Ops Check: Green. All systems operational. DB connections 8/100, AI spend yesterday: \$14.20. Ready for morning peak."*

---

### 1.2 Midday Cohort & Marketplace Pulse (14:00 UTC)
Duration: ~10 minutes  
Assigned to: Support Lead / Community Manager

- [ ] **Admin Beta Cockpit Overview:**
  - Navigate to `/admin/beta` in web portal.
  - Review active beta users, recent registrations, and quota utilization.
- [ ] **Practice Pool Matchmaking Health:**
  - Check average queue wait times ($< 45\text{ s}$ target).
  - Verify WebSocket connection drop rate $< 2\%$.
- [ ] **Teacher Booking Pipeline:**
  - Verify upcoming teacher sessions for the next 24 hours have valid meeting links generated.
  - Review any teacher cancellations or unfulfilled booking requests.
- [ ] **Support Ticket Triage:**
  - Review open tickets in `/admin/beta` (or Zendesk/Linear queue).
  - Ensure all P0/P1 issues have immediate responses within the 1-hour SLA.

---

### 1.3 Evening Sign-Off & Cost Accounting (20:00 UTC)
Duration: ~15 minutes  
Assigned to: Secondary On-Call SRE

- [ ] **Daily AI Cost & Quota Reconciliation:**
  - Review AI spend for the last 24h on `/admin/beta`:
    - Confirm total daily platform AI cost is within the \$50/day beta ceiling.
    - Inspect any individual user exceeding 80% daily quota to ensure limits are cleanly enforced.
- [ ] **Stripe Sandbox Webhook Review:**
  - Confirm all payment events processed with 200 OK:
    ```bash
    docker compose exec api uv run python -c "from app.modules.billing.models import PaymentWebhookEvent; print('Failures:', PaymentWebhookEvent.query...)"
    ```
- [ ] **Nightly Log Rotation & Pruning:**
  - Ensure temporary test artifacts and expired sessions are pruned:
    ```bash
    docker compose exec api uv run python -m app.cli.prune_ephemeral_data
    ```
- [ ] **Post Evening Sign-Off in `#beta-ops`:**
  - *"Evening Sign-Off: Green. Active students today: 34. Total submissions: 68. AI cost: \$22.80. Zero critical incidents. Handoff to on-call secondary."*

---

## 2. Weekly Operational Routines

### Every Monday: New Cohort Onboarding & Distribution
1. **Cohort Provisioning:**
   - Create new cohort record in `/admin/beta` (e.g., "Cohorte Novembre 2026 - Alpha").
   - Set maximum student capacity (default: 25) and teacher capacity (default: 5).
2. **Cryptographic Invitation Generation:**
   - Generate single-use invitation tokens:
     - `POST /api/v1/admin/beta/invitations` with `{"max_uses": 1, "valid_days": 7}`.
   - Securely distribute token links to invited applicants via welcome email.
3. **Curriculum Integrity Run:**
   - Execute CLI validation prior to onboarding:
     ```bash
     uv --project apps/api run python scripts/validate_content.py
     ```

### Every Wednesday: Learning Quality & Rubric Review
1. **Grade Alignment Audit:**
   - Academic Lead extracts 10 random AI writing evaluations and 5 speaking sessions.
   - Dual-scores them against official CCIP rubrics.
   - Records scoring differential in pedagogical monitoring sheet.
2. **Teacher Feedback Calibration:**
   - Review teacher ratings and comments submitted via the platform.
   - Adjust prompt instructions or guideline documentation if systemic grading drift is observed.

### Every Friday: Cohort Retrospective & Capacity Planning
1. **Engagement Analysis:**
   - Compute D7 retention, assessment completion rates, and average exercises completed per student.
2. **Infrastructure Capacity Review:**
   - Check database growth rate (MB/day) and MinIO storage consumption.
   - Verify backup storage retention policy and execute weekly synthetic recovery drill.

---

## 3. Incident Management & Escalation Protocol

### 3.1 Severity Matrix & Response SLAs

| Severity Level | Definition | Target Response SLA | Target Resolution SLA | Escalation Target |
|---|---|---|---|---|
| **P0 — Critical** | Full outage of API, database down, data corruption, or security breach | **$\le$ 15 minutes** | **$\le$ 2 hours** | Lead SRE + CTO + DPO |
| **P1 — High** | Core feature blocked (assessment submission fails, payment webhook down, AI scoring hung) | **$\le$ 30 minutes** | **$\le$ 6 hours** | Primary On-Call SRE + Backend Lead |
| **P2 — Medium** | Degraded performance, single non-critical endpoint slow, minor UI glitch | **$\le$ 2 hours** | **$\le$ 24 hours** | Duty Engineer |
| **P3 — Low** | Typo in question content, cosmetic styling, feature request | **$\le$ 1 business day** | Next scheduled release | Product / Content Studio |

### 3.2 Emergency Kill-Switch Cheat Sheet
If a subsystem experiences runaway cost, memory leak, or abuse, use the Admin Beta Cockpit (`/admin/beta`) or execute directly via authenticated API:

```bash
# Disable AI writing correction immediately
curl -X POST https://api.tef-prep.example.com/api/v1/admin/beta/controls/toggle-feature \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"feature_name": "ai_writing", "enabled": false}'

# Disable Peer Practice Pool immediately
curl -X POST https://api.tef-prep.example.com/api/v1/admin/beta/controls/toggle-feature \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"feature_name": "practice_pool", "enabled": false}'

# Put platform in Maintenance Mode
curl -X POST https://api.tef-prep.example.com/api/v1/admin/beta/controls/toggle-feature \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"feature_name": "maintenance_mode", "enabled": true}'
```

---

## 4. Emergency Contacts & Communication Tree

- **Lead SRE (Primary):** `ops-lead@tef-prep.example.com` / Slack `@sre-oncall`
- **Security & Privacy Lead (DPO):** `dpo@tef-prep.example.com`
- **Academic & Pedagogical Lead:** `academic@tef-prep.example.com`
- **Product & Release Manager:** `release-lead@tef-prep.example.com`
- **Status Page:** `https://status.tef-prep.example.com`
