# TEF Platform — Engineering Contract

## Mission

Build a production-grade TEF preparation platform.

The platform provides:

- TEF-style reading assessments
- TEF-style listening assessments
- timed exam simulations
- writing exam simulations
- human and AI writing correction
- human and AI speaking practice
- student-to-student speaking practice
- teacher profiles and availability
- teacher booking
- adaptive exercise recommendations
- student skill tracking
- historical performance and improvement measurement
- subscriptions, credits and future marketplace functionality

## Architecture

Use a modular monolith architecture.

Backend:
- Python
- FastAPI
- SQLAlchemy 2
- PostgreSQL
- Alembic
- Redis
- Celery

Frontend:
- React
- TypeScript
- Vite
- shadcn/ui
- Tailwind
- TanStack Query
- React Hook Form
- Zod

Storage:
- MinIO using S3-compatible APIs

Realtime:
- WebSocket for application signaling/events
- WebRTC for live audio

Infrastructure:
- Docker
- Docker Compose

## Core principle

PostgreSQL is the system of record.

Redis is ephemeral infrastructure.

MinIO stores binary/object data.

Never store large audio/files directly in PostgreSQL unless there is a very specific reason.

Never use Redis as the authoritative source of persistent business data.

## Backend organization

Organize backend code by business domain:

app/
  core/
  modules/
    auth/
    users/
    assessments/
    learning/
    exercises/
    writing/
    speaking/
    teachers/
    bookings/
    practice_pool/
    notifications/
    billing/
    admin/
  workers/
  integrations/

Do not create a microservice architecture.

## Security requirements

Security is mandatory, not a future task.

Never:
- hard-code secrets
- commit .env files
- expose database credentials
- expose MinIO credentials
- trust client-side authorization
- trust client-side exam timers
- use localStorage for long-lived authentication secrets
- expose private object storage publicly
- construct SQL using string interpolation
- return internal exception details to clients
- log passwords, tokens, secrets or private student content

Authentication must use:
- strong password hashing
- short-lived access authentication
- secure refresh/session handling
- HttpOnly cookies where appropriate
- Secure cookies in production
- SameSite policy
- CSRF protection for cookie-authenticated state-changing requests
- server-side authorization checks

Use RBAC:
- student
- teacher
- admin

Every protected resource must verify ownership/authorization on the server.

## Validation

Validate all external input with Pydantic/Zod.

Do not trust:
- request bodies
- query params
- headers
- cookies
- WebSocket messages
- uploaded filenames
- MIME types
- object-storage paths

File uploads must:
- validate size
- validate content type
- sanitize filenames
- generate server-side object keys
- never trust the client-provided path
- use private buckets
- use presigned URLs where needed

## Exam timing

The browser timer is display-only.

The authoritative exam state is stored server-side.

Each timed attempt must have:
- started_at
- expires_at
- status

The backend must reject answers/actions after expiration.

Refreshing a page must not reset the timer.

Automatic expiration/submission must be handled server-side.

## Database

Use:
- UUID primary keys
- timezone-aware timestamps
- foreign keys
- explicit indexes
- unique constraints
- check constraints where useful
- database transactions for business-critical operations

Teacher bookings must protect against double booking using transactional/database guarantees.

Do not rely on frontend checks or Redis alone to prevent duplicate bookings.

## Migrations

All schema changes use Alembic.

Never modify production schema manually.

Every migration must:
- be reversible when practical
- have a clear name
- be tested

## API

API prefix:

/api/v1/

Use consistent response/error structures.

Never expose ORM objects directly.

Use explicit Pydantic request/response schemas.

Pagination must be implemented for collection endpoints.

Do not return unbounded datasets.

## Error handling

Use centralized exception handling.

Client responses must contain safe, useful errors.

Internal stack traces belong in logs only.

Use structured logging.

Include request/correlation IDs.

## Observability

Log:
- request ID
- user ID when available
- route
- status
- latency
- background job ID
- important domain events

Never log:
- passwords
- access tokens
- refresh tokens
- cookies
- secrets
- private student writing
- private audio content

## Background processing

Use Celery for:
- AI correction
- transcription
- audio processing
- recommendation recalculation
- email
- notification jobs
- other expensive operations

HTTP endpoints must not block on expensive AI/audio operations.

Jobs must be:
- retryable
- idempotent where possible
- observable
- safely recoverable

## Storage

Use an S3-compatible abstraction.

Implement MinIO first.

Application code must depend on the storage interface, not directly on MinIO implementation details.

Objects are private by default.

Use server-generated object keys.

## Realtime

Use:
- WebSockets for signaling/events
- WebRTC for live audio

Do NOT pipe live audio through FastAPI HTTP endpoints.

Authenticate WebSocket connections.

A user may only join rooms they are authorized to join.

## Student skill model

Do not model performance only as test scores.

Support:
- skills
- subskills
- student skill estimates
- confidence
- assessment history
- mistakes
- exercises
- recommendations

The learning loop is:

ASSESS
→ ANALYZE
→ IDENTIFY WEAKNESS
→ RECOMMEND
→ PRACTICE
→ REASSESS
→ MEASURE IMPROVEMENT

## Assessment architecture

Reading and listening must use a reusable assessment engine.

Do not implement separate duplicated assessment logic for every test.

Assessment:
- test
- sections
- questions
- answers/options
- metadata
- duration
- scoring rules

Attempt:
- started
- answers
- submission
- score
- skill analysis

Questions may be tagged with:
- CEFR level
- difficulty
- skill
- subskill
- question type

## Writing

Writing workflow:

draft
→ submitted
→ queued
→ processing
→ corrected
→ returned

Correction providers:
- AI
- teacher
- AI + teacher verification

Keep provider information and correction provenance.

## Speaking

Support:
- AI session
- teacher session

Default live session duration:
25 minutes

Speaking evaluations should produce structured skill data.

Do not claim an official TEF score unless the scoring methodology has been explicitly validated and licensed/defined.

Use terms such as estimated level/performance where appropriate.

## Practice Pool

Students are matched based on compatible criteria.

Anonymous by default.

No camera in MVP.

Audio-only.

Students must not receive each other's private identity/contact information unless explicitly designed.

Use Redis for ephemeral presence/matching state.

Persist actual sessions in PostgreSQL.

## Frontend

Use feature-based organization.

Never create one enormous App.tsx.

Server state:
TanStack Query.

Client-only ephemeral state:
React state/Zustand only when required.

Forms:
React Hook Form + Zod.

Use shadcn components rather than creating custom versions of existing primitives.

## Testing

Every meaningful business feature requires tests.

Backend:
- unit tests
- service tests
- repository/integration tests
- API tests

Frontend:
- component tests
- form validation tests
- critical interaction tests

End-to-end:
- Playwright

Critical flows must have E2E coverage:
- registration/login
- assessment start
- timed assessment
- submission
- results
- writing submission
- booking
- teacher workflow

## Quality gates

Before declaring work complete, run:

- ruff
- mypy
- pytest
- bandit
- pip-audit
- frontend lint
- TypeScript check
- Vitest
- Playwright where applicable
- Docker build

Do not declare success if tests fail.

Do not silently weaken tests to make CI pass.

## Definition of done

A feature is complete only when:

1. Database schema exists.
2. Alembic migration exists.
3. API contracts exist.
4. Authorization is implemented.
5. Validation is implemented.
6. Tests exist.
7. Error handling exists.
8. Logging exists where appropriate.
9. Documentation exists.
10. Docker environment works.
11. CI passes.
12. No secrets are committed.

Prefer boring, explicit, reliable engineering over clever abstractions.
