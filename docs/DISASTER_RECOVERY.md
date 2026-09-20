# Disaster Recovery & Operational Failover Runbook

This document details failure modes, system behaviors, data integrity protections, and recovery procedures across 8 critical infrastructure failure scenarios.

---

## Scenario Matrix Summary

| Scenario | Severity | RPO Target | RTO Target | Business Truth Impact | User-Facing Experience |
|:---|:---|:---|:---|:---|:---|
| **A. PostgreSQL Unavailable** | Critical (P0) | 0 (local) / < 1h (restore) | < 15 min | None (DB is ACID system of record) | 503 "System Maintenance" |
| **B. Redis Unavailable** | High (P1) | 0 | < 5 min | None (Redis is strictly ephemeral) | Degraded (in-memory rate limit fallback) |
| **C. MinIO Unavailable** | High (P1) | 0 | < 10 min | None (file paths remain in Postgres) | Audio/document downloads delayed |
| **D. Celery Worker Unavailable**| Medium (P2)| 0 | < 10 min | None (jobs queue in Redis broker) | Async corrections delayed |
| **E. AI Provider Unavailable** | Medium (P2)| 0 | < 5 min (switch) | None (retries with backoff) | Fallback to mock / teacher queue |
| **F. Payment Provider Unavailable**| High (P1)| 0 | < 15 min | None (zero partial transactions) | Hosted checkout unavailable |
| **G. Application Container Crash**| High (P1)| 0 | < 2 min (auto) | None (stateless API processes) | Transient 502 / instant recovery |
| **H. Deployment Rollback** | High (P1)| 0 | < 10 min | None (reversible migrations) | Zero-downtime version rollback |

---

## Scenario A: PostgreSQL Unavailable

### 1. Expected System Behavior
- Readiness probe `/health/ready` immediately fails and returns HTTP 503 `{"status": "degraded"}`.
- Active HTTP mutations are aborted with standard database connection error responses; transactions are rolled back by PostgreSQL engine.
- Celery tasks attempting DB updates back off and retry with exponential jitter.

### 2. Recovery Steps
1. Inspect container logs: `docker logs tef-postgres --tail 100`.
2. Check host disk space and memory: `df -h /var/lib/postgresql/data`.
3. Restart service: `docker restart tef-postgres`.
4. If volume corruption occurred:
   ```bash
   # Restore clean database from latest verified backup
   python scripts/restore_postgres.py backups/postgres/tef_backup_tef_platform_LATEST.dump --target-db tef_platform
   ```
5. Run Alembic verification to confirm head revision: `uv run alembic current`.

### 3. Data-Loss Considerations
- Zero data loss for committed transactions. Uncommitted in-flight HTTP requests fail cleanly.

### 4. User-Facing Behavior
- Web UI displays persistent banner: *"Notre système fait l'objet d'une opération de maintenance. Veuillez patienter..."*
- Ongoing exam timer states remain safe server-side.

---

## Scenario B: Redis Unavailable

### 1. Expected System Behavior
- Redis is strictly **ephemeral infrastructure**. No persistent domain data resides in Redis.
- Rate limiting automatically falls back to local in-memory sliding window counters.
- Practice pool ephemeral presence heartbeats lapse gracefully.
- Celery worker queues pause until Redis reconnects.

### 2. Recovery Steps
1. Inspect container status: `docker logs tef-redis --tail 100`.
2. Restart Redis: `docker restart tef-redis`.
3. Verify AOF persistence file: `docker exec tef-redis redis-cli ping`.

### 3. Data-Loss Considerations
- Zero business data loss. Ephemeral matchmaking queues and temporary rate limit keys reset cleanly.

### 4. User-Facing Behavior
- Active sessions and exam completions continue unimpeded. Practice pool matchmaking queue briefly resets.

---

## Scenario C: MinIO Object Storage Unavailable

### 1. Expected System Behavior
- Stored audio passages and student writing text cannot be uploaded or downloaded.
- Attempt drafts continue saving text in PostgreSQL `writing_draft_revisions`.
- Presigned URL generation endpoints return HTTP 503 `STORAGE_UNAVAILABLE`.

### 2. Recovery Steps
1. Verify container: `docker logs tef-minio --tail 100`.
2. Restart MinIO: `docker restart tef-minio`.
3. Verify bucket health: `python -c "from app.core.storage import check_storage_health; print(check_storage_health())"`.
4. If storage pool corrupted, restore from latest snapshot:
   ```bash
   python scripts/restore_minio.py backups/minio/minio_backup_tef-private_LATEST --target-bucket tef-private
   ```

### 3. Data-Loss Considerations
- Uploads in progress fail cleanly. Historical assets are restored from backup snapshots.

### 4. User-Facing Behavior
- Toast notification: *"L'accès aux enregistrements audio est momentanément indisponible."*

---

## Scenario D: Celery Worker Unavailable

### 1. Expected System Behavior
- Background jobs (AI correction, email notifications, expired reservation cleanups) accumulate in the Redis queue (`redis://:6379/1`).
- Zero HTTP requests are blocked because HTTP endpoints never wait synchronously on background workers.

### 2. Recovery Steps
1. Inspect worker logs: `docker logs tef-celery-worker --tail 100`.
2. Check memory consumption: `docker stats tef-celery-worker`.
3. Restart worker: `docker restart tef-celery-worker`.
4. Celery picks up unacknowledged tasks (`acks_late=True`, `task_reject_on_worker_lost=True`).

### 3. Data-Loss Considerations
- Zero task loss due to Redis broker persistence and Celery late acknowledgments.

### 4. User-Facing Behavior
- Writing submissions show *"Correction en cours"* badge slightly longer than usual.

---

## Scenario E: AI Provider Unavailable (DeepSeek / OpenAI)

### 1. Expected System Behavior
- AI writing evaluations and speaking transcripts catch upstream timeout exceptions.
- Celery tasks retry up to 3 times with exponential backoff (30s, 60s, 120s).
- If retries exhaust, submission status transitions to `QUEUED_FOR_TEACHER` or flags an admin review alert.

### 2. Recovery Steps
1. Verify provider status dashboards (e.g. status.deepseek.com).
2. Toggle emergency feature flag if extended outage:
   ```bash
   # Switch AI writing to human teacher review queue
   curl -X PATCH http://localhost:8000/api/v1/admin/system/flags \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -d '{"AI_WRITING_ENABLED": false}'
   ```

### 3. Data-Loss Considerations
- Zero data loss; submission texts remain safely committed in PostgreSQL.

---

## Scenario F: Payment Provider Unavailable (Stripe Gateway)

### 1. Expected System Behavior
- Checkout session creation (`POST /api/v1/billing/checkout`) catches provider gateway error and returns HTTP 502 `PAYMENT_GATEWAY_UNAVAILABLE`.
- In-flight booking reservations hold for 15 minutes and expire safely without charging student.
- Active subscriptions and existing credit accounts continue functioning normally.

### 2. Recovery Steps
1. Verify Stripe status (status.stripe.com).
2. Webhooks retry with exponential backoff on Stripe's infrastructure for up to 72 hours.
3. Once gateway recovers, incoming webhooks are processed idempotently (`uq_payment_webhooks_provider_event`).

### 3. Data-Loss Considerations
- Zero billing discrepancies or double-charges.

---

## Scenario G: Application Container Crash (FastAPI / Uvicorn)

### 1. Expected System Behavior
- Docker restart policy (`restart: unless-stopped`) triggers immediate container restart within 2 seconds.
- Reverse proxy (Nginx) buffers client requests or returns transient 502 while container boots.

### 2. Recovery Steps
1. Docker automatically restarts container.
2. Review crash backtrace: `docker logs tef-api --tail 200`.
3. If memory OOM killed: increase memory ceiling in compose file.

---

## Scenario H: Deployment Rollback

### 1. Expected System Behavior
- If a new image version causes regressions, traffic is rolled back immediately to the previous immutable image digest.

### 2. Recovery Steps
```bash
# 1. Rollback image tag in docker-compose.production.yml
IMAGE_TAG=v0.1.0-beta.1 docker compose -f infra/compose/docker-compose.production.yml up -d --no-deps api web

# 2. If database migration needs rollback (reversible migrations):
uv run alembic downgrade -1

# 3. Verify health
curl -f http://localhost:8000/health/ready
```
