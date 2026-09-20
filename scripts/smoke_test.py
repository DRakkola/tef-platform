"""Production Smoke Test Suite.

Non-destructive post-deployment validation verifying that all critical public API
and infrastructure endpoints are responsive and healthy in staging or production.
"""

import os
import sys
import time
import urllib.error
import urllib.request
import json
from typing import Any

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")


def http_get(path: str, expected_status: int = 200) -> tuple[bool, int, float, Any]:
    """Execute non-destructive HTTP GET request measuring latency and validating response."""
    url = f"{BASE_URL}{path}"
    start_ts = time.perf_counter()
    req = urllib.request.Request(url, headers={"User-Agent": "TEF-SmokeTest/1.0"})

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            latency_ms = (time.perf_counter() - start_ts) * 1000
            status_code = resp.status
            content = resp.read().decode("utf-8")
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = content
            passed = status_code == expected_status
            return passed, status_code, latency_ms, parsed
    except urllib.error.HTTPError as exc:
        latency_ms = (time.perf_counter() - start_ts) * 1000
        return exc.code == expected_status, exc.code, latency_ms, str(exc)
    except Exception as exc:
        latency_ms = (time.perf_counter() - start_ts) * 1000
        return False, 0, latency_ms, str(exc)


def run_smoke_tests() -> bool:
    """Run all smoke test checks in sequence."""
    checks = [
        ("Liveness Probe", "/health/live", 200),
        ("Readiness Probe", "/health/ready", 200),
        ("Prometheus Metrics", "/metrics", 200),
        ("Platform Status", "/api/v1/status", 200),
        ("System Version", "/api/v1/system/version", 200),
        ("System Feature Flags", "/api/v1/system/flags", 200),
    ]

    print("=" * 72)
    print(f"       TEF PLATFORM PRODUCTION SMOKE TEST SUITE       ")
    print(f"       Target: {BASE_URL}")
    print("=" * 72)
    print(f"{'Check Name':<28} | {'Path':<24} | {'Status':<6} | {'Latency':<8} | {'Result'}")
    print("-" * 72)

    all_passed = True
    for name, path, expected in checks:
        passed, status, latency, data = http_get(path, expected)
        result_tag = "[PASS]" if passed else "[FAIL]"
        if not passed:
            all_passed = False
        print(f"{name:<28} | {path:<24} | {status:<6} | {latency:>6.1f}ms | {result_tag}")

    print("=" * 72)
    if all_passed:
        print("[SUCCESS] All post-deployment smoke tests passed successfully.")
    else:
        print("[FAILURE] One or more smoke tests failed. Verify deployment and container logs.")
    return all_passed


if __name__ == "__main__":
    if len(sys.argv) > 1:
        BASE_URL = sys.argv[1].rstrip("/")
    success = run_smoke_tests()
    sys.exit(0 if success else 1)
