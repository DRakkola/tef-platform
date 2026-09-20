"""Prometheus-compatible in-memory application metrics collector."""

import threading
import time
from collections import defaultdict
from typing import Any


class MetricsCollector:
    """Thread-safe collector for application performance and business metrics."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counters: dict[str, dict[tuple[tuple[str, str], ...], float]] = defaultdict(
            lambda: defaultdict(float)
        )
        self._gauges: dict[str, dict[tuple[tuple[str, str], ...], float]] = defaultdict(
            lambda: defaultdict(float)
        )

    def inc(self, name: str, value: float = 1.0, labels: dict[str, str] | None = None) -> None:
        """Increment a counter metric."""
        label_key = tuple(sorted((labels or {}).items()))
        with self._lock:
            self._counters[name][label_key] += value

    def set_gauge(self, name: str, value: float, labels: dict[str, str] | None = None) -> None:
        """Set an instantaneous gauge value."""
        label_key = tuple(sorted((labels or {}).items()))
        with self._lock:
            self._gauges[name][label_key] = value

    def render_prometheus(self) -> str:
        """Render all registered counters and gauges into standard Prometheus exposition format."""
        lines: list[str] = []
        with self._lock:
            # Counters
            for name, items in self._counters.items():
                lines.append(f"# TYPE {name} counter")
                for labels, val in items.items():
                    if labels:
                        label_str = ",".join(f'{k}="{v}"' for k, v in labels)
                        lines.append(f"{name}{{{label_str}}} {val}")
                    else:
                        lines.append(f"{name} {val}")

            # Gauges
            for name, items in self._gauges.items():
                lines.append(f"# TYPE {name} gauge")
                for labels, val in items.items():
                    if labels:
                        label_str = ",".join(f'{k}="{v}"' for k, v in labels)
                        lines.append(f"{name}{{{label_str}}} {val}")
                    else:
                        lines.append(f"{name} {val}")

        return "\n".join(lines) + "\n"


# Global metrics collector singleton
metrics = MetricsCollector()
