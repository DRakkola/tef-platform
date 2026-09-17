# TEF Platform — Operational Runbook & Production Guide

This document outlines the standard operating procedures, architectural topology, zero-downtime deployment, database migrations, backup/restore, disaster recovery, incident response, and secret rotation protocols for the TEF Preparation Platform.

---

## 1. System Architecture & Topology

```
                         [ Cloudflare / Load Balancer ]
                                      │ (HTTPS / WSS)
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │            Web Tier (Nginx / React SPA)          │
             │           Port 80 (Internal Docker Network)      │
             └────────────────────────┬─────────────────────────┘
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │           API Tier (FastAPI / Uvicorn)           │
             │           Port 8000 (Stateless, Scalable)        │
             └───────┬────────────────┬─────────────────┬───────┘
                     │                │                 │
         (PostgreSQL │        (Redis  │         (MinIO  │
         Connection) │        Broker) │         S3 API) │
                     ▼                ▼                 ▼
          ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
          │   PostgreSQL   │ │     Redis      │ │     MinIO      │
          │   Version 18   │ │  Version 7.4   │ │   S3 Storage   │
          │(System of Rec) │ │ (Cache/Queue)  │ │(Private Bucket)│
          └────────────────┘ └───────┬────────┘ └────────────────┘
                                     │
                                     ▼
                     ┌────────────────────────────────┐
                     │   Worker Tier (Celery Async)   │
                     │ (Late Ack, Worker Lost Reject) │
                     └────────────────────────────────┘
```

### Core Components
1. **API Tier (`apps/api`)**: Python 3.14 with FastAPI. Stateless, horizontally scalable. Enforces universal authentication, RBAC, ownership checks, 5MB body limits, timing-safe auth, and JWT JTI revocation.
2. **Web Tier (`apps/web`)**: React 19 SPA served via unprivileged Nginx (UID 101). Communicates with API over `/api/v1` and WebSockets (`/api/v1/speaking/ws/{room}`, `/api/v1/practice-pool/ws/{room}`).
3. **Database Tier (`PostgreSQL 18`)**: Primary system of record. Uses strict foreign key constraints, composite indexes, and row-level pessimistic locking (`with_for_update`) for concurrent transactions (exam completion, teacher bookings).
4. **Cache & Queue Tier (`Redis 7.4`)**: Ephemeral store for rate limiting counters, account lockout trackers, revoked token JTI blocklist, matchmaking queues, and Celery broker/backend. Configured with AOF persistence.
5. **Storage Tier (`MinIO`)**: S3-compatible private object store for writing submissions and audio practice recordings. All objects are private and accessed exclusively via server-generated presigned URLs capped at 3600s.
6. **Async Worker Tier (`Celery 5.6`)**: Background task processor configured with `task_acks_late=True` and `task_reject_on_worker_lost=True` to guarantee zero task drops on container restart.

---

## 2. Production Deployment Runbook

### 2.1 Pre-Flight Environment Checks
Before starting a deployment, verify that all required environment variables are set and non-default:
- `ENVIRONMENT=production`
- `SECRET_KEY`: High-entropy random string (at least 32 characters, preferably 64 hex characters generated via `openssl rand -hex 32`).
- `DATABASE_URL`: Production PostgreSQL connection string with SSL enabled (`sslmode=require`).
- `REDIS_PASSWORD`: High-entropy Redis password.
- `STORAGE_ACCESS_KEY` and `STORAGE_SECRET_KEY`: Non-default MinIO credentials.
- `CORS_ORIGINS`: Comma-separated list of production domain origins (no `localhost` or wildcards).

> [!CAUTION]
> The API application enforces fail-fast validation in `app/core/config.py`. If `ENVIRONMENT=production` and default credentials or a weak secret key are detected, the container will immediately exit with a `ValidationError`.

### 2.2 Zero-Downtime Deployment Steps
1. **Pull Images**: Pre-pull or build production container images on target nodes:
   ```bash
   docker compose -f infra/docker-compose.yml pull
   ```
2. **Execute Database Migrations**: Run Alembic migrations prior to traffic cutover:
   ```bash
   docker compose -f infra/docker-compose.yml run --rm api alembic upgrade head
   ```
3. **Rolling Update of Workers**:
   ```bash
   docker compose -f infra/docker-compose.yml up -d --no-deps celery-worker
   ```
4. **Rolling Update of API Service**:
   ```bash
   docker compose -f infra/docker-compose.yml up -d --no-deps --build api
   ```
5. **Update Web Frontend**:
   ```bash
   docker compose -f infra/docker-compose.yml up -d --no-deps --build web
   ```
6. **Health Verification**:
   Query the API liveness and readiness endpoints:
   ```bash
   curl -f http://localhost:8000/api/v1/health
   curl -f http://localhost:8000/api/v1/health/ready
   ```

---

## 3. Database Migration Runbook

### 3.1 Applying Migrations (Zero-to-Head)
To initialize a fresh database from zero to the latest schema:
```bash
cd apps/api
uv run alembic upgrade head
```
All 8 migration scripts will execute sequentially:
- `0001_initial_baseline`
- `0002_auth_and_users`
- `0003_assessment_engine`
- `0004_learning_intelligence`
- `0005_writing_assessment`
- `0006_teacher_booking`
- `0007_speaking_sessions`
- `0008_practice_pool`

### 3.2 Backward-Compatible Schema Updates
To maintain zero-downtime during forward migrations:
1. **Phase 1 (Expand)**: Add new nullable columns or tables. Deploy new migrations and API code that writes to both old and new fields.
2. **Phase 2 (Migrate Data)**: Backfill data in background batches.
3. **Phase 3 (Contract)**: Add non-null constraints if needed, deprecate old columns, and remove legacy code paths.

### 3.3 Rollback Protocol
If a migration fails during deployment:
```bash
# Inspect current database revision
uv run alembic current

# Downgrade by 1 step if necessary
uv run alembic downgrade -1

# Or downgrade to specific revision
uv run alembic downgrade <revision_id>
```

---

## 4. Backup and Restore Procedures

### 4.1 PostgreSQL Backup (Automated & Manual)

#### Automated Continuous Archiving (WAL)
PostgreSQL should be configured with `archive_mode = on` and `archive_command` streaming WAL segments to secure offsite object storage (e.g., AWS S3 via `pgBackRest` or `wal-g`).

#### Point-In-Time Daily Snapshot (Logical Backup)
Run daily compressed dumps using `pg_dump`:
```bash
docker exec -t tef-postgres pg_dump \
  -U tef_admin \
  -d tef_platform \
  -F c \
  -b \
  -v \
  -f /tmp/tef_platform_$(date +%Y%m%d_%H%M%S).dump

# Encrypt and copy offsite
gzip -9 /tmp/tef_platform_*.dump
aws s3 cp /tmp/tef_platform_*.dump.gz s3://tef-backups-secure/postgres/
```

#### PostgreSQL Full Restore Procedure
1. Drop and recreate the target database:
   ```bash
   docker exec -i tef-postgres psql -U tef_admin -c "DROP DATABASE IF EXISTS tef_platform;"
   docker exec -i tef-postgres psql -U tef_admin -c "CREATE DATABASE tef_platform OWNER tef_app;"
   ```
2. Restore from custom-format dump:
   ```bash
   docker exec -i tef-postgres pg_restore \
     -U tef_admin \
     -d tef_platform \
     --no-owner \
     --role=tef_app \
     -v /tmp/tef_platform_backup.dump
   ```
3. Re-index and vacuum analyze:
   ```bash
   docker exec -i tef-postgres psql -U tef_admin -d tef_platform -c "VACUUM ANALYZE;"
   ```

### 4.2 MinIO / S3 Object Storage Backup
1. **Continuous Bucket Replication**: Configure MinIO site-to-site replication or bucket-to-bucket replication (`mc replicate add local/tef-private remote/tef-private-backup`).
2. **Periodic Sync via MinIO Client (`mc`)**:
   ```bash
   mc mirror --overwrite --remove local/tef-private backup-s3/tef-private-backup
   ```
3. **Restore**:
   ```bash
   mc mirror --overwrite backup-s3/tef-private-backup local/tef-private
   ```

### 4.3 Redis Backup & Ephemeral Recovery
Redis uses Append-Only File (`appendonly yes`) stored in `/data/appendonlydir`.
- Snapshots are created via `BGSAVE`.
- If Redis data is lost, Redis restarts empty. User sessions will require re-login, but core data (assessments, attempts, submissions, bookings, matches) resides permanently in PostgreSQL and remains unaffected.

---

## 5. Disaster Recovery (DR) Plan

| Metric | Target | Rationale |
|---|---|---|
| **Recovery Point Objective (RPO)** | **< 1 hour** | Continuous WAL archiving + MinIO replication ensures minimal data loss. |
| **Recovery Time Objective (RTO)** | **< 2 hours** | Infrastructure provisioned via Docker/IaC; automated database and storage restore pipelines. |

### DR Scenarios & Playbooks

#### Scenario A: PostgreSQL Primary Node Failure
1. Verify host/disk health on primary node.
2. If unrecoverable, promote hot-standby replica to primary:
   ```bash
   pg_ctl promote -D /var/lib/postgresql/data
   ```
3. Update `DATABASE_URL` DNS record or environment variable to point to the new primary.
4. Restart API and Celery worker services:
   ```bash
   docker compose restart api celery-worker
   ```

#### Scenario B: Redis Node Failure
1. Restart Redis container:
   ```bash
   docker compose restart redis
   ```
2. Verify Redis accepts connections:
   ```bash
   docker exec tef-redis redis-cli -a "$REDIS_PASSWORD" ping
   ```
3. The API and Celery workers will automatically reconnect due to `broker_connection_retry_on_startup=True` and connection pool retries.

#### Scenario C: MinIO Object Storage Loss
1. Provision new MinIO instance or S3 bucket.
2. Restore objects from replication target using `mc mirror`.
3. Update `STORAGE_ENDPOINT` / credentials and restart API workers.

---

## 6. Incident Response Playbook

### Incident Severity Levels
- **P1 (Critical Outage)**: Core API unreachable, database down, exams unable to submit. Response: Immediate (< 15 mins).
- **P2 (Degraded)**: Background tasks delayed, teacher calendar sync slow, isolated 500 errors. Response: < 1 hour.
- **P3 (Minor)**: UI glitch, non-critical telemetry issue. Response: Next business day.

### Playbook 1: Credential or `SECRET_KEY` Compromise
1. **Rotate Secret Key**:
   - Generate new 64-character secret key: `openssl rand -hex 32`.
   - Update `SECRET_KEY` in production environment / secret manager.
   - Restart all API and worker instances.
   - *Impact*: All existing JWT access tokens are immediately invalidated, forcing active users to re-authenticate.
2. **Rotate Database Password**:
   - Update password in PostgreSQL: `ALTER USER tef_app WITH PASSWORD 'new_password';`.
   - Update `DATABASE_URL` in container environment and perform rolling restart.
3. **Invalidate Active Sessions in Redis**:
   - Flush Redis DB 0: `redis-cli -n 0 FLUSHDB`.

### Playbook 2: Database Connection Exhaustion
1. Check active connections:
   ```sql
   SELECT count(*), state, client_addr FROM pg_stat_activity GROUP BY state, client_addr;
   ```
2. Identify and terminate long-running transactions:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < now() - interval '5 minutes';
   ```
3. Scale up PgBouncer pool limits or optimize connection pool size in `app/core/database.py`.

### Playbook 3: DDoS or Brute Force Attack
1. Check IP rate-limiting telemetry in Redis (`rate_limit:*`).
2. Identify offending IP addresses or ranges.
3. Apply Cloudflare WAF block rule or iptables drop rule:
   ```bash
   sudo iptables -A INPUT -s <OFFENDING_IP> -j DROP
   ```
4. Verify account lockout counters (`login_attempts:{email}`) prevent password guessing.

---

## 7. Storage Lifecycle & Orphan Detection

### 7.1 Orphan Detection Script
Writing submissions and speaking recordings generate objects in MinIO. In the event of network dropouts or abandoned drafts, an object may exist in MinIO without a corresponding database row.

Run weekly orphan detection:
```python
# scripts/detect_orphan_objects.py
import asyncio
from app.core.database import async_session_factory
from app.core.storage import get_storage
from app.modules.writing.models import WritingSubmission
from sqlalchemy import select

async def find_orphans():
    storage = get_storage()
    # List all objects in bucket
    # Cross-reference with WritingSubmission.object_key
    # Flag or quarantine unreferenced keys older than 7 days
```

### 7.2 Storage Retention Guidelines
- Writing submissions: Retained for student review for the duration of the account lifecycle.
- Speaking evaluation audio: Retained for 90 days after session completion for review, then archived or deleted based on student data retention preferences.
- Deleted student accounts: Hard delete student profile; purge corresponding MinIO files via Celery deletion job.
