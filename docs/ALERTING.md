# Production Alerting Policies & Runbooks

This document defines metric thresholds, severity classifications, and step-by-step response procedures for all operational alerts.

---

## 1. Alerting Policy Matrix

| Alert Name | Metric / Trigger | Severity | Threshold | Action Runbook |
|:---|:---|:---|:---|:---|
| `HighHttp5xxRate` | `rate(http_errors_total[5m]) / rate(http_requests_total[5m])` | **Critical (P0)** | > 1.0% for 2 mins | [Runbook 1](#runbook-1-high-http-5xx-rate) |
| `HighHttpLatencyP95` | `histogram_quantile(0.95, http_request_duration_seconds)` | **High (P1)** | > 2.0s for 5 mins | [Runbook 2](#runbook-2-high-p95-latency) |
| `DatabaseDown` | `check_db_health() == False` | **Critical (P0)** | 1 failed check | [Runbook 3](#runbook-3-database-down) |
| `RedisDown` | `check_redis_health() == False` | **High (P1)** | 2 failed checks | [Runbook 4](#runbook-4-redis-down) |
| `CeleryQueueBacklog` | `celery_queue_depth` | **Medium (P2)**| > 150 tasks for 10m | [Runbook 5](#runbook-5-celery-queue-backlog) |
| `PaymentWebhookFailures` | `billing_payments_total{status="failed"}` | **High (P1)** | > 3 failures in 10m | [Runbook 6](#runbook-6-payment-webhook-failure) |
| `ReconciliationDiscrepancy` | `billing_reconciliation_discrepancies_total` | **High (P1)** | > 0 discrepancies | [Runbook 7](#runbook-7-reconciliation-discrepancy) |
| `AuthBruteForce` | `rate(auth_rate_limit_exceeded[5m])` | **High (P1)** | > 20 events/min | [Runbook 8](#runbook-8-auth-brute-force-abuse) |
| `StorageFailure` | `check_storage_health() == False` | **High (P1)** | 1 failed check | [Runbook 9](#runbook-9-storage-failure) |
| `TlsCertExpiringSoon` | Let's Encrypt Certificate Expiry | **Medium (P2)**| < 15 days remaining | [Runbook 10](#runbook-10-certificate-renewal) |

---

## Runbook 1: High HTTP 5xx Rate

1. **Investigate**: Query error logs via structlog:
   ```bash
   docker logs tef-prod-api --since 10m | grep -E '"level":"error"'
   ```
2. **Determine Source**: Check if errors concentrate on a single route (e.g. `/api/v1/writing/`) or across all endpoints (database connection issue).
3. **Mitigate**:
   - If database pool exhausted: restart API container or scale up DB pool size in config (`DB_POOL_SIZE=30`).
   - If bad release deployed: initiate deployment rollback ([Disaster Recovery: Scenario H](file:///C:/Users/MSI/Documents/tef-platform/docs/DISASTER_RECOVERY.md#scenario-h-deployment-rollback)).

---

## Runbook 2: High P95 Latency

1. Inspect slow query metrics in PostgreSQL:
   ```sql
   SELECT pid, now() - query_start AS duration, query 
   FROM pg_stat_activity 
   WHERE state = 'active' AND now() - query_start > interval '2 seconds';
   ```
2. Cancel blocking queries: `SELECT pg_cancel_backend(pid);`.
3. Verify Redis latency: `docker exec tef-prod-redis redis-cli --latency`.

---

## Runbook 3: Database Down

1. Verify container status: `docker ps -a --filter name=tef-prod-postgres`.
2. Review OOM kills: `dmesg -T | grep -i oom` or inspect Postgres log `/var/log/postgresql/`.
3. Restart: `docker start tef-prod-postgres`.
4. If unrecoverable corruption: invoke `scripts/restore_postgres.py` ([Backup & Restore Runbook](file:///C:/Users/MSI/Documents/tef-platform/docs/BACKUP_AND_RESTORE.md)).

---

## Runbook 4: Redis Down

1. Rate limiting will automatically degrade gracefully to in-memory fallback counters.
2. Restart Redis container: `docker restart tef-prod-redis`.
3. Reconnect verification: `curl -f http://localhost:8000/health/ready`.

---

## Runbook 5: Celery Queue Backlog

1. Check active worker process count: `docker exec tef-prod-celery-worker celery -A app.core.celery_app inspect active`.
2. Check for worker hangs on external AI calls (e.g., DeepSeek/OpenAI timeout).
3. Scale up worker concurrency:
   ```bash
   docker compose -f infra/compose/docker-compose.production.yml up -d --scale celery-worker=2
   ```

---

## Runbook 6: Payment Webhook Failure

1. Check webhook event audit logs in admin console: `GET /api/v1/admin/billing/webhooks`.
2. Inspect HMAC signature mismatch: confirm `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard.
3. Once corrected, trigger webhook replay from Stripe Dashboard without data loss (idempotency key protects from double credit grants).

---

## Runbook 7: Reconciliation Discrepancy

1. Access admin billing console: `/admin/billing` &rarr; Reconciliation tab.
2. Run live audit: `POST /api/v1/admin/billing/reconcile`.
3. Review specific discrepancy category:
   - `pending_orders`: Orders stuck in pending > 1 hour.
   - `negative_credits`: Credit account invariants violated.
   - `orphaned_bookings`: Paid reservations without confirmed booking rows.
4. Execute audited correction under administrative authorization.

---

## Runbook 8: Auth Brute Force Abuse

1. Check offending IP addresses: `docker logs tef-prod-api --since 10m | grep "rate_limit_exceeded"`.
2. Block offending IP at proxy level:
   ```bash
   # Add to nginx blocklist in /etc/nginx/blocklist.conf:
   deny 198.51.100.42;
   docker exec tef-prod-proxy nginx -s reload
   ```

---

## Runbook 9: Storage Failure

1. Check MinIO container health: `docker logs tef-prod-minio --tail 50`.
2. Verify credentials and disk space on storage volume: `df -h /data`.
3. Restart MinIO: `docker restart tef-prod-minio`.

---

## Runbook 10: Certificate Renewal

1. Test dry-run: `certbot renew --dry-run`.
2. Manual forced renewal:
   ```bash
   certbot renew --force-renewal
   docker exec tef-prod-proxy nginx -s reload
   ```
