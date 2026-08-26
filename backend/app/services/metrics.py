"""Metrics collector — simple in-memory metrics for /metrics endpoint."""

from __future__ import annotations

import time
from collections import defaultdict


class Metrics:
    """Collect and expose runtime metrics."""

    def __init__(self):
        self.counters: dict[str, int] = defaultdict(int)
        self.gauges: dict[str, float] = {}
        self.histograms: dict[str, list[float]] = defaultdict(list)
        self.start_time = time.time()

    def inc(self, name: str, value: int = 1):
        self.counters[name] += value

    def gauge(self, name: str, value: float):
        self.gauges[name] = value

    def histogram(self, name: str, value: float):
        self.histograms[name].append(value)
        if len(self.histograms[name]) > 1000:
            self.histograms[name] = self.histograms[name][-500:]

    def get_all(self) -> dict:
        uptime = time.time() - self.start_time
        return {
            "uptime_seconds": round(uptime, 1),
            "counters": dict(self.counters),
            "gauges": dict(self.gauges),
            "histograms": {
                k: {
                    "count": len(v),
                    "avg": round(sum(v) / len(v), 3) if v else 0,
                    "p95": round(
                        sorted(v)[int(len(v) * 0.95)]
                        if len(v) > 1
                        else (v[0] if v else 0),
                        3,
                    ),
                }
                for k, v in self.histograms.items()
            },
        }


# ── Singleton ──────────────────────────────────────────────
_metrics: Metrics | None = None


def get_metrics() -> Metrics:
    global _metrics
    if _metrics is None:
        _metrics = Metrics()
    return _metrics
