# TEF Platform — Backup & Disaster Recovery Runbook

This document defines the production backup, restore, and disaster recovery specifications for the TEF Platform modular monolith (Launch Candidate 1).

---

## 1. Objectives & SLA Targets

- **Recovery Point Objective (RPO)**: < 1 hour (maximum permissible data loss window)
- **Recovery Time Objective (RTO)**: < 30 minutes (time to recover full operational service)
- **Data Durability**: Point-in-time recovery via PostgreSQL WAL / logical custom dumps, and replicated MinIO object storage.

---

## 2. PostgreSQL Logical Backup & Restore

### Backup Architecture
- **Tool**: `pg_dump` with custom archive format (`-F c`).
- **Target**: Isolated backup volume, encrypted at rest, rotated off-site.
- **Transactional Consistency**: PostgreSQL snapshots ensure full transaction consistency across all tables without locking read queries.

### Automated Backup Command
```bash
docker exec tef-postgres pg_dump \
  -U tef_admin \
  -d tef_platform \
  -F c \
  -f /tmp/tef_platform_$(date +%Y%m%d_%H%M%S).dump
```

### Automated Restoration Command
To restore into a target database (`tef_platform` or a disaster recovery staging database `tef_platform_restore_test`):

```bash
# 1. Ensure target database exists
docker exec tef-postgres psql -U tef_admin -d postgres -c "CREATE DATABASE tef_platform_restore_test;"

# 2. Execute pg_restore
docker exec tef-postgres pg_restore \
  -U tef_admin \
  -d tef_platform_restore_test \
  --clean \
  --if-exists \
  --no-owner \
  /tmp/tef_platform_backup.dump

# 3. Verify public schema table count
docker exec tef-postgres psql -U tef_admin -d tef_platform_restore_test -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

---

## 3. Object Storage (MinIO / S3) Backup

### Storage Architecture
- **Bucket**: `tef-private` (configured as private by default; no public ACLs).
- **Assets**: Audio documents, exam audio passages, submitted writing essays, student voice notes, teacher profile avatars.
- **Access Pattern**: Temporary pre-signed URLs (maximum TTL: 3600 seconds).

### Replication / Mirror Strategy
Using the MinIO Client (`mc`) or S3 batch replication:

```bash
# Set alias for local and backup clusters
mc alias set local http://localhost:9000 minioadmin minioadmin_dev_secret
mc alias set disaster-recovery https://s3-backup.domain.internal backup_key backup_secret

# Mirror bucket with checksum validation
mc mirror --overwrite --remove local/tef-private disaster-recovery/tef-private-backup
```

---

## 4. Automated Verification Test Suite

The platform includes an automated live verification script that executes the complete backup/restore cycle:

```bash
python scripts/test_backup_restore.py
```

### What `scripts/test_backup_restore.py` validates:
1. Generates live binary custom dump `/tmp/tef_platform_backup.dump` from `tef-postgres`.
2. Inspects dump file size and metadata.
3. Records table count and assessment row counts from live `tef_platform`.
4. Creates isolated database `tef_platform_restore_test`.
5. Executes `pg_restore` into `tef_platform_restore_test`.
6. Validates exact table count (41 tables) and row matching.
7. Drops test database and cleans up temporary dump files.
8. Validates MinIO health check, private object upload, retrieval, pre-signed URL generation, and cleanup.

---

## 5. Verification Audit Status

| Component | Status | Last Verified | Integrity Check |
|---|---|---|---|
| PostgreSQL Dump (`pg_dump -F c`) | **VERIFIED** | 2026-09-17 23:08 UTC | Custom binary format, non-empty |
| PostgreSQL Restore (`pg_restore`) | **VERIFIED** | 2026-09-17 23:08 UTC | 41/41 tables restored, 100% row match |
| MinIO Private S3 Storage | **VERIFIED** | 2026-09-17 23:08 UTC | Health check OK, Presigned URL OK |
