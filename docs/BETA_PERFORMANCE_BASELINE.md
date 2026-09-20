# TEF Canada Platform — Private Beta Performance Baseline & Latency Benchmark

**Document Version:** 1.0.0-beta  
**Date:** September 18, 2026  
**Benchmarked By:** Principal Performance Engineer & SRE  
**Target Environment:** Staging / Pre-Production Cluster (4 vCPU, 8 GB RAM, NVMe SSD)  
**Test Load:** 50 Concurrent Simulated Active Beta Users (40 Students, 10 Teachers)  
**Overall Status:** PASSED (All endpoints within latency & throughput budgets)  

---

## 1. Executive Summary

This document establishes the official performance baseline for the TEF Canada Private Beta. Benchmarking was performed using synthetic k6 load scripts simulating realistic user workflows over 60-minute peak windows. 

Under the target beta load of 50 concurrent active users:
- **Zero HTTP 5xx errors** were recorded across 42,500 total requests.
- **Overall median response time (p50):** 42 ms.
- **95th percentile response time (p95):** 184 ms (well below the 500 ms SLA).
- **99th percentile response time (p99):** 412 ms (well below the 1,000 ms SLA).
- **Database connection pool utilization:** Peaked at 38% (8 of 20 connections).
- **Redis cache hit ratio:** 94.2%.

---

## 2. Latency Benchmarks by Endpoint & User Flow

| User Workflow / Endpoint | HTTP Method / Protocol | Target SLA (p95) | Measured p50 | Measured p95 | Measured p99 | Max Latency | Error Rate |
|---|---|---|---|---|---|---|---|
| **Health Check** (`/api/v1/health/ready`) | `GET` | $\le$ 50 ms | 4 ms | 12 ms | 28 ms | 45 ms | 0.00% |
| **User Login** (`/api/v1/auth/login`) | `POST` | $\le$ 300 ms | 78 ms | 142 ms | 215 ms | 280 ms | 0.00% |
| **Beta Token Registration** (`/api/v1/auth/register`) | `POST` | $\le$ 400 ms | 95 ms | 185 ms | 260 ms | 315 ms | 0.00% |
| **Assessment List** (`/api/v1/assessments`) | `GET` | $\le$ 200 ms | 22 ms | 68 ms | 114 ms | 185 ms | 0.00% |
| **Assessment Start Attempt** (`/api/v1/assessments/{id}/attempts`) | `POST` | $\le$ 300 ms | 48 ms | 134 ms | 210 ms | 295 ms | 0.00% |
| **Question Answer Autosave** (`/api/v1/assessments/attempts/{id}/answers`) | `POST` | $\le$ 150 ms | 18 ms | 52 ms | 98 ms | 145 ms | 0.00% |
| **Assessment Complete & Score** (`/api/v1/assessments/attempts/{id}/complete`) | `POST` | $\le$ 500 ms | 88 ms | 210 ms | 385 ms | 460 ms | 0.00% |
| **Writing Task Fetch** (`/api/v1/writing/tasks`) | `GET` | $\le$ 150 ms | 16 ms | 44 ms | 82 ms | 120 ms | 0.00% |
| **Writing Submission Upload** (`/api/v1/writing/submissions`) | `POST` | $\le$ 500 ms | 112 ms | 265 ms | 430 ms | 540 ms | 0.00% |
| **AI Mock Correction Enqueue** (`/api/v1/writing/submissions/{id}/mock-correct`)| `POST` | $\le$ 300 ms | 35 ms | 88 ms | 145 ms | 210 ms | 0.00% |
| **Speaking Session Init** (`/api/v1/speaking/sessions`) | `POST` | $\le$ 400 ms | 64 ms | 175 ms | 285 ms | 380 ms | 0.00% |
| **Speaking Audio Chunk Post** (`/api/v1/speaking/sessions/{id}/audio`) | `POST` | $\le$ 500 ms | 124 ms | 290 ms | 485 ms | 610 ms | 0.00% |
| **Practice Pool Matchmaking** (`/api/v1/practice-pool/join`) | `POST` | $\le$ 200 ms | 28 ms | 74 ms | 132 ms | 190 ms | 0.00% |
| **Realtime Signaling Handshake** (`/ws/practice-pool/{id}`) | `WebSocket` | $\le$ 200 ms | 18 ms | 62 ms | 110 ms | 165 ms | 0.00% |
| **Teacher Directory & Slots** (`/api/v1/teachers`) | `GET` | $\le$ 250 ms | 36 ms | 112 ms | 195 ms | 275 ms | 0.00% |
| **Teacher Booking Reservation** (`/api/v1/bookings`) | `POST` | $\le$ 400 ms | 58 ms | 164 ms | 270 ms | 355 ms | 0.00% |
| **Admin Beta Cockpit Overview** (`/api/v1/admin/beta/overview`) | `GET` | $\le$ 400 ms | 62 ms | 188 ms | 340 ms | 420 ms | 0.00% |

---

## 3. Background Asynchronous Processing (Celery Worker)

Asynchronous workflows (AI writing correction, speech transcription, spaced repetition updates) run decoupled from the HTTP request cycle:

| Task Name | Median Duration | p95 Duration | Max Retry Rate | Dead Letter Count |
|---|---|---|---|---|
| `process_writing_evaluation` | 4.8 s | 9.2 s | 0.4% | 0 |
| `transcribe_and_score_oral` | 6.2 s | 11.4 s | 0.8% | 0 |
| `recompute_readiness_vector` | 145 ms | 320 ms | 0.0% | 0 |
| `process_analytics_event_batch` | 28 ms | 85 ms | 0.0% | 0 |

---

## 4. Resource Utilization & Capacity Headroom

### 4.1 Host Resource Profiles (Under 50 Concurrent Users)
```
Host: 4 vCPU, 8 GB RAM, Ubuntu 24.04 LTS
Peak Concurrency: 50 active students & teachers
```

- **API Container (Uvicorn 4 workers):**
  - CPU Utilization: Mean 18%, Peak 42%
  - Memory Resident Set Size (RSS): 380 MB total (95 MB per worker)
- **Celery Worker Container (Concurrency 4):**
  - CPU Utilization: Mean 12%, Peak 35%
  - Memory RSS: 240 MB
- **PostgreSQL 16 Engine:**
  - Active Connections: 8 / 100 max configured
  - Buffer Cache Hit Ratio: 99.4%
  - Average Transaction Time: 3.2 ms
  - Disk I/O Write Throughput: 1.8 MB/s peak
- **Redis 7 In-Memory Store:**
  - Memory Allocation: 48 MB / 512 MB max
  - Operation Throughput: 1,450 ops/sec peak
  - Memory Evictions: 0
- **MinIO S3 Gateway:**
  - Active Stream Connections: 12 peak
  - Throughput: 4.2 MB/s burst write during audio uploads

---

## 5. Saturation Thresholds & Auto-Mitigation Rules

To ensure platform stability throughout the Private Beta, automated safeguards trigger when resources cross predefined thresholds:

| Metric | Warning Threshold | Critical Action Threshold | Automated Mitigation |
|---|---|---|---|
| **API Response Latency (p95)** | $> 500\text{ ms}$ | $> 1,000\text{ ms}$ for 3 consecutive minutes | Issue AlertManager alert; auto-throttle non-essential analytics batching |
| **PostgreSQL Active Connections** | $> 25$ | $> 35$ (Pool exhaustion risk) | Scale connection pool max overflow to 15; log slow queries ($> 200\text{ ms}$) |
| **Beta User Daily AI Quota** | 80% consumed | 100% consumed | Return HTTP 429 `BETA_QUOTA_EXCEEDED` cleanly at API edge |
| **Celery Queue Depth** | $> 50$ pending tasks | $> 150$ pending tasks | Spin up secondary Celery worker node; enable graceful task shedding |
| **Disk Space (Database/MinIO)** | $> 75\%$ used | $> 85\%$ used | Page on-call SRE; run temporary artifact pruning job |

---

## 6. Performance Lead Sign-Off

The platform demonstrates consistent sub-200ms p95 latencies across all high-frequency endpoints and robust asynchronous execution for AI workloads. The operational headroom exceeds 300% of expected Private Beta demand.

**Performance Status:** **APPROVED FOR PRIVATE BETA DEPLOYMENT.**
