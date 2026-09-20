# TEF Platform — Production Foundation

A production-grade preparation platform for the French **TEF (Test d'Évaluation de Français)** examination, engineered as a modular monolith adhering to the [`AGENTS.md`](./AGENTS.md) permanent engineering contract.

---

## 🏛️ Architecture & Infrastructure Baselines

| Component | Technology | Version / Image Tag | Role & Storage Pattern |
|---|---|---|---|
| **Backend API** | Python / FastAPI | Python 3.14 (`python:3.14-slim`) | Async REST API, Non-root container (`appuser:10001`) |
| **Database** | PostgreSQL | `postgres:18.0-alpine3.22` | **System of Record** (UUID PKs, asyncpg, Alembic) |
| **Cache & Queue** | Redis | `redis:7.4.2-alpine` | **Ephemeral infrastructure** (AOF, password auth) |
| **Workers** | Celery | Python 3.14 | Background task processing (AI correction, emails) |
| **Object Storage** | MinIO (S3 API) | `minio/minio:RELEASE.2025-02-18T16-25-55Z` | Binary data & audio, private-by-default, server UUID keys |
| **Bucket Init** | MinIO Client | `minio/mc:RELEASE.2025-02-21T16-00-46Z` | Automated dev bucket setup & access policy enforcement |
| **Frontend Web** | React / Vite | Node 24 LTS (`node:24-alpine`) | Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui |

---

## 📁 Repository Structure

```
tef-platform/
├── apps/
│   ├── api/                          # FastAPI modular backend
│   │   ├── app/
│   │   │   ├── core/                 # Config, DB, Redis, Celery, Storage, Middleware
│   │   │   ├── modules/              # Domain modules (auth, users, assessments, etc.)
│   │   │   ├── workers/              # Celery background tasks
│   │   │   └── main.py               # Application factory & health endpoints
│   │   ├── alembic/                  # Database migrations (asyncpg)
│   │   ├── tests/                    # Backend pytest suite (health, db, redis, celery, storage)
│   │   └── Dockerfile                # Production multi-stage minimal Dockerfile
│   └── web/                          # Vite + React frontend
│       ├── src/
│       │   ├── core/                 # Config & centralized API client
│       │   ├── providers/            # TanStack Query client & provider
│       │   ├── components/           # ErrorBoundary, LoadingState, NotFoundPage, shadcn UI
│       │   ├── routes/               # AppRoutes & HomePage
│       │   └── test/                 # Vitest & React Testing Library tests
│       └── Dockerfile                # Multi-stage nginx static runtime
├── infra/
│   ├── docker-compose.yml            # Complete development stack
│   ├── postgres/init-user-db.sh      # Dedicated DB & role setup script
│   └── minio/init-buckets.sh         # Development bucket initialization script
├── scripts/
│   └── check.ps1                     # PowerShell quality gate runner
├── .github/workflows/
│   └── ci.yml                        # GitHub Actions CI pipeline
├── Makefile                          # Task runner
├── .env.example                      # Complete environment baseline
├── AGENTS.md                         # Permanent Engineering Contract
└── README.md                         # Project documentation
```

---

## 🚀 Quick Start

### 1. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

### 2. Infrastructure & Application with Docker Compose
Start all services (PostgreSQL 18, Redis 7.4, MinIO, MinIO-Init, API, Celery Worker, Web):
```bash
# Using Makefile
make up

# Or directly with Docker Compose
docker compose -f infra/compose/docker-compose.yml up -d
```

Access services:
- **Frontend Web**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Health Liveness**: [http://localhost:8000/health/live](http://localhost:8000/health/live)
- **API Health Readiness**: [http://localhost:8000/health/ready](http://localhost:8000/health/ready)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001)

---

## 🧪 Local Development & Quality Gates

### Backend (`apps/api`)
```bash
cd apps/api
# Setup virtual environment and sync all dependencies
uv sync --all-groups

# Run tests
uv run pytest -v

# Run linters & type checkers
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run bandit -r app
uv run pip-audit
```

### Frontend (`apps/web`)
```bash
cd apps/web
# Install dependencies
pnpm install

# Run unit & component tests
pnpm test

# Run build & lint
pnpm exec tsc -b
pnpm build
pnpm lint
```

### Running All Quality Gates
```bash
# Linux / macOS
make check

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/check.ps1
```

---

## 🧠 Student Learning Loop & Intelligence System

The TEF platform incorporates an end-to-end pedagogical intelligence engine:
- **Time-Decayed Bayesian Mastery**: Deterministic, sample-calibrated rolling skill mastery calculation.
- **CEFR & Canadian NCLC Levels**: Real-time indicative level estimation with official simulation disclaimers.
- **Target Gap Analysis**: Score gap, level step distance, and exam countdown urgency classification.
- **Personalized Daily Study Plan**: Real-time 4-part practice recommendations with progress tracking.
- **Recommendation Engine V2**: Weakness remediation, target gap priority boosts (+25), and 48-hour exercise cooldown.
- **Immutable Progress Timeline**: Append-only activity and assessment snapshots guaranteeing audit integrity.

For technical deep-dives:
- [Student Assessment Experience Specification](docs/STUDENT_ASSESSMENT_EXPERIENCE.md)
- [Learning Engine & Skill Intelligence Specification](docs/LEARNING_ENGINE.md)

