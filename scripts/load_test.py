"""Private Beta Concurrency and Load Testing Tool.

Simulates target private beta traffic profile:
- 100 Concurrent Students (catalog browsing, assessment taking, system health polling)
- 50 Practice Pool requests (matching queue status, topic retrieval)
- 20 Teacher requests (availability rules, profile discovery)

Measures p50, p95, p99 latencies, throughput (requests/sec), and verifies zero 5xx server errors.
"""

import asyncio
import math
import os
import sys
import time
from pathlib import Path
from typing import Any

# Ensure apps/api is in sys.path
root_dir = Path(__file__).resolve().parent.parent
api_dir = root_dir / "apps" / "api"
sys.path.insert(0, str(api_dir))

import httpx
from httpx import ASGITransport

from app.main import app

DEFAULT_BASE_URL = os.environ.get("API_BASE_URL", "")


class LoadTestRunner:
    """Orchestrates asynchronous concurrent load test scenarios."""

    def __init__(self, use_asgi: bool = True, base_url: str = "http://testserver") -> None:
        self.use_asgi = use_asgi
        self.base_url = base_url
        self.latencies: list[float] = []
        self.status_codes: dict[int, int] = {}
        self.errors: list[str] = []

    async def _make_request(self, client: httpx.AsyncClient, method: str, path: str) -> None:
        start_ts = time.perf_counter()
        try:
            resp = await client.request(method, path)
            latency_ms = (time.perf_counter() - start_ts) * 1000
            self.latencies.append(latency_ms)
            code = resp.status_code
            self.status_codes[code] = self.status_codes.get(code, 0) + 1
        except Exception as exc:
            latency_ms = (time.perf_counter() - start_ts) * 1000
            self.latencies.append(latency_ms)
            self.errors.append(str(exc))

    async def _simulate_student_worker(self, client: httpx.AsyncClient, worker_id: int, iterations: int = 5) -> None:
        """Simulate student user journey."""
        paths = [
            "/health/live",
            "/api/v1/status",
            "/api/v1/system/flags",
            "/api/v1/assessments",
            "/health/ready",
        ]
        for _ in range(iterations):
            for p in paths:
                await self._make_request(client, "GET", p)
                await asyncio.sleep(0.01)

    async def _simulate_practice_pool_worker(self, client: httpx.AsyncClient, worker_id: int, iterations: int = 5) -> None:
        """Simulate practice pool matching polling."""
        paths = [
            "/api/v1/system/flags",
            "/api/v1/practice-pool/topics",
            "/api/v1/status",
        ]
        for _ in range(iterations):
            for p in paths:
                await self._make_request(client, "GET", p)
                await asyncio.sleep(0.01)

    async def _simulate_teacher_worker(self, client: httpx.AsyncClient, worker_id: int, iterations: int = 5) -> None:
        """Simulate teacher discovery and availability polling."""
        paths = [
            "/api/v1/teachers",
            "/api/v1/system/flags",
            "/health/ready",
        ]
        for _ in range(iterations):
            for p in paths:
                await self._make_request(client, "GET", p)
                await asyncio.sleep(0.01)

    async def run_benchmark(
        self,
        student_count: int = 100,
        practice_count: int = 50,
        teacher_count: int = 20,
        iterations_per_worker: int = 5,
    ) -> dict[str, Any]:
        """Execute concurrent worker tasks and compute latency statistics."""
        transport = ASGITransport(app=app) if self.use_asgi else None
        limits = httpx.Limits(max_connections=300, max_keepalive_connections=100)

        print(f"Launching Private Beta Load Test:")
        print(f"  - {student_count} Concurrent Students")
        print(f"  - {practice_count} Concurrent Practice Pool Workers")
        print(f"  - {teacher_count} Concurrent Teachers")
        print(f"  - Mode: {'ASGI In-Memory' if self.use_asgi else 'External HTTP (' + self.base_url + ')'}")
        print("-" * 72)

        start_wall_clock = time.perf_counter()

        async with httpx.AsyncClient(
            transport=transport,
            base_url=self.base_url,
            limits=limits,
            timeout=30.0,
        ) as client:
            tasks = []
            # Spawn student workers
            for i in range(student_count):
                tasks.append(self._simulate_student_worker(client, i, iterations=iterations_per_worker))
            # Spawn practice pool workers
            for i in range(practice_count):
                tasks.append(self._simulate_practice_pool_worker(client, i, iterations=iterations_per_worker))
            # Spawn teacher workers
            for i in range(teacher_count):
                tasks.append(self._simulate_teacher_worker(client, i, iterations=iterations_per_worker))

            await asyncio.gather(*tasks)

        total_duration = time.perf_counter() - start_wall_clock

        # Calculate metrics
        sorted_latencies = sorted(self.latencies)
        total_reqs = len(sorted_latencies)
        if total_reqs == 0:
            return {"error": "No requests recorded"}

        def percentile(p: float) -> float:
            k = (len(sorted_latencies) - 1) * (p / 100.0)
            f = math.floor(k)
            c = math.ceil(k)
            if f == c:
                return sorted_latencies[int(k)]
            d0 = sorted_latencies[int(f)] * (c - k)
            d1 = sorted_latencies[int(c)] * (k - f)
            return d0 + d1

        p50 = percentile(50.0)
        p95 = percentile(95.0)
        p99 = percentile(99.0)
        p99_9 = percentile(99.9)
        avg_lat = sum(sorted_latencies) / total_reqs
        min_lat = sorted_latencies[0]
        max_lat = sorted_latencies[-1]
        rps = total_reqs / total_duration if total_duration > 0 else 0

        server_errors = sum(v for k, v in self.status_codes.items() if k >= 500)

        results = {
            "total_requests": total_reqs,
            "duration_seconds": total_duration,
            "requests_per_second": rps,
            "latency_min_ms": min_lat,
            "latency_avg_ms": avg_lat,
            "latency_p50_ms": p50,
            "latency_p95_ms": p95,
            "latency_p99_ms": p99,
            "latency_p99_9_ms": p99_9,
            "latency_max_ms": max_lat,
            "status_distribution": self.status_codes,
            "server_errors": server_errors,
            "network_errors": len(self.errors),
        }

        self._print_results(results)
        return results

    def _print_results(self, res: dict[str, Any]) -> None:
        print("=" * 72)
        print("          TEF PLATFORM PRIVATE BETA LOAD TEST RESULTS          ")
        print("=" * 72)
        print(f"Total Requests Executed:  {res['total_requests']}")
        print(f"Benchmark Duration:       {res['duration_seconds']:.2f} seconds")
        print(f"Throughput (RPS):         {res['requests_per_second']:.1f} req/sec")
        print("-" * 72)
        print("Latency Percentiles:")
        print(f"  Min:                    {res['latency_min_ms']:.2f} ms")
        print(f"  Average:                {res['latency_avg_ms']:.2f} ms")
        print(f"  Median (p50):           {res['latency_p50_ms']:.2f} ms")
        print(f"  95th Percentile (p95):  {res['latency_p95_ms']:.2f} ms")
        print(f"  99th Percentile (p99):  {res['latency_p99_ms']:.2f} ms")
        print(f"  Max:                    {res['latency_max_ms']:.2f} ms")
        print("-" * 72)
        print(f"Status Code Distribution: {res['status_distribution']}")
        print(f"Server Errors (5xx):      {res['server_errors']}")
        print(f"Network / Client Errors:  {res['network_errors']}")
        print("=" * 72)

        if res["server_errors"] == 0 and res["latency_p95_ms"] < 250.0:
            print("[PASS] Benchmark satisfied Private Beta SLO targets (< 250ms p95, zero 5xx).")
        else:
            print("[WARN] Benchmark failed to satisfy SLO targets.")


if __name__ == "__main__":
    use_asgi_mode = True
    target_url = "http://testserver"

    if len(sys.argv) > 1 and sys.argv[1].startswith("http"):
        use_asgi_mode = False
        target_url = sys.argv[1]

    runner = LoadTestRunner(use_asgi=use_asgi_mode, base_url=target_url)
    asyncio.run(runner.run_benchmark(student_count=100, practice_count=50, teacher_count=20, iterations_per_worker=5))
