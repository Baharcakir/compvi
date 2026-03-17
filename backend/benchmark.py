"""Rolling-window latency tracker for inference benchmarking."""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class BenchmarkTracker:
    """Tracks inference latency over a rolling window of frames."""

    window_size: int = 30
    _times_ms: deque[float] = field(default_factory=lambda: deque(maxlen=30))
    _start: float = 0.0

    def __post_init__(self) -> None:
        self._times_ms = deque(maxlen=self.window_size)

    # -- context-manager style ------------------------------------------------

    def start(self) -> None:
        self._start = time.perf_counter()

    def stop(self) -> float:
        """Stop the timer, record the sample, and return elapsed ms."""
        elapsed_ms = (time.perf_counter() - self._start) * 1000.0
        self._times_ms.append(elapsed_ms)
        return elapsed_ms

    # -- stats ----------------------------------------------------------------

    def _sorted(self) -> list[float]:
        return sorted(self._times_ms)

    @property
    def count(self) -> int:
        return len(self._times_ms)

    @property
    def avg_ms(self) -> float:
        if not self._times_ms:
            return 0.0
        return sum(self._times_ms) / len(self._times_ms)

    @property
    def p95_ms(self) -> float:
        return self._percentile(0.95)

    @property
    def p99_ms(self) -> float:
        return self._percentile(0.99)

    def _percentile(self, pct: float) -> float:
        s = self._sorted()
        if not s:
            return 0.0
        idx = int(pct * (len(s) - 1))
        return s[idx]

    def stats_dict(self) -> dict:
        """Return a JSON-friendly dict of current rolling-window stats."""
        return {
            "avg_ms": round(self.avg_ms, 2),
            "p95_ms": round(self.p95_ms, 2),
            "p99_ms": round(self.p99_ms, 2),
            "frames": self.count,
        }
