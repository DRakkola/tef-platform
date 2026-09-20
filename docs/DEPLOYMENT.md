# Production & Staging Deployment Guide

This operational runbook governs the deployment, migration, zero-downtime rolling update, and emergency rollback procedures for the TEF Platform across staging and production environments.

---

## 1. Environment Topology

```text
                                Internet
                                   │
                      [ Cloudflare / DNS / WAF ]
                                   │ HTTPS :443
                        ┌──────────┴──────────┐
                        │ Nginx Reverse Proxy │ (tef-public-net)
                        └──────────┬──────────┘
           ┌───────────────────────┼───────────────────────┐
           │ HTTP                  │ WebSocket /ws/        │ HTTP Static
     ┌─────▼─────┐           ┌─────▼─────┐           ┌─────▼─────┐
     │  tef-api  │           │  tef-api  │           │  tef-web  │
     └─────┬─────┘           └─────┬─────┘           └───────────┘
           │ (tef-internal-net)    │
     ┌─────┴───────────┬───────────┴───────────┐
┌────▼───────┐   ┌─────▼─────┐           ┌─────▼─────┐
│ PostgreSQL │   │   Redis   │           │   MinIO   │
│   (v18)    │   │  (v7.4)   │           │ (Storage) │
└────────────┘   └───────────┘           └───────────┘
```

- **Staging URL**: `https://staging.tef-prep.example.com`
- **Production URL**: `https://app.tef-prep.example.com`
- **Isolation Rule**: Zero internal ports (`5432`, `6379`, `9000`, `9001`) are exposed to the host network in staging or production. All private traffic travels through `tef-internal-net`.

---

## 2. Pre-Deployment Staging Checklist

Before triggering a production deployment:

1. [ ] **CI Pipeline Green**: All unit tests, integration tests, lint checks, and Gitleaks secret scanners pass.
2. [ ] **Curriculum Validation**: Run `python scripts/validate_content.py` to ensure zero broken questions or missing audio.
3. [ ] **Staging Dry Run**: Deploy current release tag to staging environment first.
4. [ ] **Staging Smoke Test**: Run `python scripts/smoke_test.py https://staging.tef-prep.example.com`.
5. [ ] **Database Backup**: Execute `python scripts/backup_postgres.py` prior to running migrations.

---

## 3. Step-by-Step Production Deployment Sequence

### Step 1: Secret & Environment Configuration
Verify that `.env.production` is populated with high-entropy cryptographic secrets and valid domain names:
```bash
# Verify environment is set to production
grep "ENVIRONMENT=production" .env.production
```

### Step 2: Pre-Deployment Backup
Create an immutable snapshot of PostgreSQL and MinIO prior to updating code or applying database migrations:
```bash
python scripts/backup_postgres.py
python scripts/backup_minio.py
```

### Step 3: Container Image Pull & Build
Pull the pinned production base images and compile the release artifacts:
```bash
docker compose -f infra/compose/docker-compose.production.yml pull
docker compose -f infra/compose/docker-compose.production.yml build
```

### Step 4: Database Schema Migration
Execute Alembic migrations forward within an ephemeral container attached to `tef-internal-net`:
```bash
docker compose -f infra/compose/docker-compose.production.yml run --rm \
  tef-api alembic upgrade head
```

### Step 5: Rolling Container Restart (Zero-Downtime)
Update the API containers with graceful SIGTERM termination, allowing in-flight requests 30 seconds to finish:
```bash
docker compose -f infra/compose/docker-compose.production.yml up -d --no-deps --scale tef-api=2 tef-api
# Wait for health checks to report healthy
sleep 15
# Prune old container instances
docker compose -f infra/compose/docker-compose.production.yml up -d --no-deps --scale tef-api=1 tef-api
```

### Step 6: Reload Nginx Reverse Proxy
Reload Nginx configuration without dropping active TLS or WebSocket connections:
```bash
docker compose -f infra/compose/docker-compose.production.yml exec tef-proxy nginx -s reload
```

### Step 7: Post-Deployment Smoke Verification
Execute the automated smoke test against the live production URL:
```bash
python scripts/smoke_test.py https://app.tef-prep.example.com
```

---

## 4. Rollback Runbook

If fatal errors, severe regressions, or elevated 5xx rates (> 1%) occur post-deployment:

### Immediate Mitigation: Enable Maintenance Mode
Instantly freeze write operations while debugging:
```bash
curl -X PATCH https://app.tef-prep.example.com/api/v1/admin/system/flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flag_name": "maintenance_mode", "enabled": true, "reason": "Investigating post-deployment regression"}'
```

### Container Rollback
Revert to the previous verified release tag:
```bash
export RELEASE_TAG=v0.1.0-beta.previous
docker compose -f infra/compose/docker-compose.production.yml up -d
```

### Database Migration Downgrade (If Necessary)
If schema migrations were executed that are incompatible with the previous container:
```bash
docker compose -f infra/compose/docker-compose.production.yml run --rm \
  tef-api alembic downgrade -1
```

If data corruption occurred, restore from the pre-deployment snapshot:
```bash
python scripts/restore_postgres.py /var/backups/tef/postgres/tef_backup_TIMESTAMP.dump
```

---

## 5. TLS Certificate Provisioning (Let's Encrypt / Certbot)

For production domain setup on Ubuntu/Debian host:

```bash
# 1. Install certbot
sudo apt-get update && sudo apt-get install -y certbot

# 2. Generate certificates using Webroot or standalone
sudo certbot certonly --webroot -w /var/www/certbot \
  -d app.tef-prep.example.com \
  --email security@tef-prep.example.com \
  --agree-tos --no-eff-email

# 3. Mount certificate paths into Nginx compose configuration
# /etc/letsencrypt/live/app.tef-prep.example.com/fullchain.pem
# /etc/letsencrypt/live/app.tef-prep.example.com/privkey.pem
```
Auto-renewal is verified with `sudo certbot renew --dry-run`.
