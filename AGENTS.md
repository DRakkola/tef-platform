# AGENTS.md

Instructions and architectural guidelines for AI coding agents operating on `tef-platform`.

## 1. System Overview & Tech Baseline

- **Python Baseline**: Python 3.14
  - Backend framework: FastAPI
  - Data validation: Pydantic v2
  - ORM / Database layer: SQLAlchemy 2.0 (asyncio) + asyncpg + Alembic
- **Node Baseline**: Node 24 LTS
  - Package manager: pnpm
  - Frontend framework: Vite + React 19 + TypeScript
  - UI & Styling: Tailwind CSS + shadcn/ui
- **Database Baseline**: PostgreSQL 18
  - Deployed locally via Docker Compose (`infra/docker-compose.yml`)

---

## 2. Monorepo Organization

```
tef-platform/
├── apps/
│   ├── api/                  # Python 3.14 FastAPI backend
│   └── web/                  # Vite + React + shadcn frontend
├── infra/                    # Docker, cloud, and DB manifests
├── scripts/                  # Utility and setup automation scripts
├── docs/                     # Architecture Decision Records (ADRs) and specifications
├── .github/workflows/        # CI/CD workflows
├── .env.example              # Canonical reference for all environment variables
├── AGENTS.md                 # Agent guidelines and design system contracts
└── README.md                 # Project entry point and documentation
```

---

## 3. Engineering Conventions

### Backend (`apps/api`)
- Keep FastAPI routers clean and modular under `apps/api/routers/`.
- Use Pydantic schemas for request validation and response contracts under `apps/api/schemas/`.
- Maintain async-first database queries with SQLAlchemy AsyncSession.
- Target Python 3.14 features where applicable; avoid legacy Python 2/3.8 constructs.

### Frontend (`apps/web`)
- Utilize shadcn/ui components (`@/components/ui/*`). Add components using `pnpm dlx shadcn add <component>`.
- Use TypeScript with strict typing. Avoid `any`.
- Keep business logic in custom hooks or utility services; keep components clean and modular.
- Path aliases: `@/` points to `apps/web/src/`.

### Configuration & Secrets
- Never commit `.env` files with production secrets.
- Always keep `.env.example` up to date whenever new environment variables are introduced.

### Commits & Pull Requests
- Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` new feature
  - `fix:` bug fix
  - `chore:` maintenance / setup
  - `refactor:` code improvements without behavior changes
  - `docs:` documentation updates
