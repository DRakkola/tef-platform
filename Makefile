.PHONY: help up down restart logs ps test lint format typecheck audit check

help:
	@echo "TEF Platform — Development Task Runner"
	@echo ""
	@echo "Infrastructure Commands:"
	@echo "  make up          - Start all docker services (infra + apps)"
	@echo "  make down        - Stop and remove all docker containers"
	@echo "  make restart     - Restart all docker containers"
	@echo "  make logs        - Follow docker logs"
	@echo "  make ps          - List running docker containers"
	@echo ""
	@echo "Quality Gate Commands:"
	@echo "  make lint        - Run ruff on backend and oxlint on frontend"
	@echo "  make format      - Auto-format codebases"
	@echo "  make typecheck   - Run mypy and tsc"
	@echo "  make test        - Run backend pytest and frontend vitest"
	@echo "  make audit       - Run bandit and pip-audit security scans"
	@echo "  make check       - Run ALL quality gates (test, lint, typecheck, audit)"

up:
	docker compose -f infra/compose/docker-compose.yml up -d

down:
	docker compose -f infra/compose/docker-compose.yml down

restart:
	docker compose -f infra/compose/docker-compose.yml restart

logs:
	docker compose -f infra/compose/docker-compose.yml logs -f

ps:
	docker compose -f infra/compose/docker-compose.yml ps

lint:
	cd apps/api && uv run ruff check .
	cd apps/web && pnpm lint

format:
	cd apps/api && uv run ruff format .
	cd apps/web && pnpm exec prettier --write "src/**/*.{ts,tsx,css}"

typecheck:
	cd apps/api && uv run mypy app
	cd apps/web && pnpm exec tsc -b

test:
	cd apps/api && uv run pytest
	cd apps/web && pnpm test

audit:
	cd apps/api && uv run bandit -r app
	cd apps/api && uv run pip-audit

check: lint typecheck test audit
	@echo "All quality gates passed successfully!"
