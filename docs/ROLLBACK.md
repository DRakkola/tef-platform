# TEF Canada Platform — Production & Beta Rollback Playbook

**Document Version:** 1.0.0-beta  
**Date:** September 18, 2026  
**Audience:** Site Reliability Engineers (SRE), Release Managers, Primary On-Call Engineers  
**Classification:** HIGH PRIORITY OPERATIONAL RUNBOOK  

---

## 1. Rollback Decision Framework

Rollback is an emergency operational procedure. When an issue occurs post-deployment, choose the least disruptive tier that completely mitigates user impact:

```
                  +-----------------------------------+
                  | Deployment Incident Detected (P0) |
                  +-----------------------------------+
                                    |
          Is the defect isolated to a single feature/flag?
                         /                     \
                      [YES]                    [NO]
                       /                         \
        +----------------------------+   Is it a Frontend-only UI bug?
        | Tier 1: Feature Flag Kill  |          /              \
        | (Latency: < 30 seconds)    |       [YES]             [NO]
        +----------------------------+        /                  \
                            +-----------------------+  Did release include DB migrations?
                            | Tier 2: Web SPA Swap  |         /               \
                            | (Latency: < 2 minutes)|      [YES]              [NO]
                            +-----------------------+       /                   \
                                            +---------------------+  +----------------------+
                                            | Tier 4: DB + API    |  | Tier 3: API Container|
                                            | Reversion           |  | Tag Rollback         |
                                            | (Latency: 5-15 min) |  | (Latency: < 3 min)   |
                                            +---------------------+  +----------------------+
```

---

## 2. Tier 1: Emergency Feature Flag & Kill-Switch Rollback

**Impact:** Zero downtime, zero container restarts.  
**Execution Time:** $< 30$ seconds.

If a specific subsystem (AI evaluation, peer practice pool, bookings, or payment sandbox) is malfunctioning or driving unexpected costs:

### Via Admin Beta Control Panel:
1. Navigate to `/admin/beta` in your web browser.
2. Under **Interrupteurs d'urgence (Kill Switches)**, toggle the failing component to **Désactivé**.
3. Confirm the modal prompt. Audit logs are automatically created.

### Via Authenticated API / Terminal:
```bash
# Emergency kill-switch for AI writing
curl -s -X POST https://api.tef-prep.example.com/api/v1/admin/beta/controls/toggle-feature \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"feature_name": "ai_writing", "enabled": false}'

# Emergency kill-switch for peer practice pool
curl -s -X POST https://api.tef-prep.example.com/api/v1/admin/beta/controls/toggle-feature \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"feature_name": "practice_pool", "enabled": false}'

# Put entire platform into maintenance mode
curl -s -X POST https://api.tef-prep.example.com/api/v1/admin/beta/controls/toggle-feature \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"feature_name": "maintenance_mode", "enabled": true}'
```

---

## 3. Tier 2: Frontend Web SPA Static Rollback

**Impact:** Zero API downtime. Users on old bundle seamlessly receive previous stable JavaScript/CSS assets on reload.  
**Execution Time:** $< 2$ minutes.

If a frontend release introduces rendering regressions, JavaScript exceptions, or broken client navigation:

### Procedure:
1. Identify the previous immutable frontend container image tag:
   ```bash
   # Inspect running image
   docker inspect --format='{{.Config.Image}}' tef-web
   # Output: ghcr.io/tef-prep/web:20260918-v1.0.1
   ```
2. Update `docker-compose.prod.yml` or deployment manifest to the previous stable tag (e.g., `20260918-v1.0.0`).
3. Re-deploy the web container without touching the backend:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --no-deps web
   ```
4. Verify HTTP 200 response and asset hashing:
   ```bash
   curl -I https://tef-prep.example.com/
   ```

---

## 4. Tier 3: Backend API & Celery Worker Rollback (No DB Migration)

**Impact:** Brief (sub-second) connection drain during container swap.  
**Execution Time:** $< 3$ minutes.

If a backend logic regression is discovered that did not involve database schema migrations:

### Procedure:
1. Pin the deployment image tags in `.env.production` to the previous verified SHA/version:
   ```env
   API_IMAGE_TAG=20260918-v1.0.0
   CELERY_IMAGE_TAG=20260918-v1.0.0
   ```
2. Pull previous immutable images:
   ```bash
   docker compose -f docker-compose.prod.yml pull api celery-worker
   ```
3. Gracefully reload the services:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --no-deps api celery-worker
   ```
4. Verify readiness:
   ```bash
   curl -s https://api.tef-prep.example.com/api/v1/health/ready | jq .
   ```

---

## 5. Tier 4: Database Migration Rollback (`alembic downgrade`)

**Impact:** Planned maintenance window (1–5 minutes) recommended to avoid schema-query contention.  
**Execution Time:** 5–10 minutes.

If a deployment included an Alembic schema migration that must be rolled back:

### Pre-Rollback Safety Checklist:
- [ ] Take a manual pre-downgrade snapshot of the production database immediately:
  ```bash
  docker exec -t tef-db pg_dump -U tef_admin -Fc tef_production > /backups/postgres/pre_downgrade_$(date +%Y%m%d_%H%M%S).dump
  ```
- [ ] Verify that the downgrade will **not** drop columns containing newly written customer data without archival.
- [ ] Stop incoming user traffic by enabling maintenance mode (Tier 1).

### Step-by-Step Execution:
1. Check current migration revision:
   ```bash
   docker compose exec api uv run alembic current
   # Output: 0019_beta_cohorts_and_invitations (head)
   ```
2. Roll back to the preceding revision:
   ```bash
   docker compose exec api uv run alembic downgrade -1
   ```
3. Confirm revision state:
   ```bash
   docker compose exec api uv run alembic current
   # Output: 0018_analytics_and_operations (head)
   ```
4. Revert API and Celery containers to the matching application image tag:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --no-deps api celery-worker
   ```
5. Disable maintenance mode:
   ```bash
   curl -X POST https://api.tef-prep.example.com/api/v1/admin/beta/controls/toggle-feature \
     -H "Authorization: Bearer $ADMIN_JWT" \
     -d '{"feature_name": "maintenance_mode", "enabled": false}'
   ```

---

## 6. Tier 5: Catastrophic Disaster Recovery (Full Database Restore)

**Impact:** System downtime during restoration window ($< 15$ minutes).  
**Execution Time:** 7–15 minutes (Validated in `docs/BETA_BACKUP_DRILL.md`).

Follow the validated recovery sequence documented in [`docs/BETA_BACKUP_DRILL.md`](file:///C:/Users/MSI/Documents/tef-platform/docs/BETA_BACKUP_DRILL.md):
1. Put platform into maintenance mode at edge reverse-proxy (Caddy/Nginx).
2. Restore clean database container from the latest verified snapshot (`pg_restore -Fc`).
3. Replay WAL archives up to the desired point-in-time.
4. Run schema sanity check:
   ```bash
   uv --project apps/api run python scripts/validate_content.py
   ```
5. Re-open public traffic and broadcast incident update.

---

## 7. Post-Rollback Validation Checklist

After completing any rollback procedure, the On-Call SRE must execute the following validation suite before declaring an "all-clear":

- [ ] Health endpoint returns 200: `curl -f https://api.tef-prep.example.com/api/v1/health/ready`
- [ ] Database connection pool returns to baseline ($< 15$ active connections).
- [ ] Celery worker responds to ping: `docker compose exec api uv run celery -A app.core.celery_app inspect ping`
- [ ] Admin beta overview loads without exceptions (`/admin/beta`).
- [ ] Test student can log in and view dashboard.
- [ ] Test assessment taking page initializes correctly.
- [ ] Audit event logged recording the rollback action.
- [ ] Postmortem scheduled within 24 hours.
