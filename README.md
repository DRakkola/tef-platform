# TEF Platform

A modern platform monorepo engineered with:
- **Backend API**: Python 3.14 (FastAPI, SQLAlchemy Async, Pydantic v2)
- **Frontend Web**: Node 24 LTS (Vite, React 19, TypeScript, Tailwind CSS, shadcn/ui)
- **Database & Infrastructure**: PostgreSQL 18 (Docker Compose)

---

## 📁 Repository Structure

```
tef-platform/
├── apps/
│   ├── api/                  # Python 3.14 FastAPI backend
│   └── web/                  # Node 24 LTS Vite + React + shadcn/ui frontend
├── infra/                    # Infrastructure definitions (Docker Compose, PostgreSQL 18)
├── scripts/                  # Development and automation scripts
├── docs/                     # Architectural and operational documentation
├── .github/
│   └── workflows/            # GitHub Actions CI/CD workflows
├── .env.example              # Baseline environment configuration
├── AGENTS.md                 # Agent guidelines and architectural standards
└── README.md                 # Project documentation
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.14** (or `uv` package manager)
- **Node.js 24 LTS** & **pnpm**
- **Docker** (for PostgreSQL 18 service)

### 2. Infrastructure
Start the PostgreSQL 18 container:
```bash
docker compose -f infra/docker-compose.yml up -d
```

### 3. Backend (API)
```bash
cd apps/api
# Setup virtual environment and dependencies
uv venv
uv pip install -e .
# Start development server
uvicorn main:app --reload --port 8000
```

### 4. Frontend (Web)
```bash
cd apps/web
pnpm install
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
