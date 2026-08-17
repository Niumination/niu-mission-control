"""Structured logging — JSON format with correlation IDs."""
from __future__ import annotations

import logging
import uuid
from contextvars import ContextVar
from datetime import datetime

# ── Correlation ID (per-request) ──────────────────────────
correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")

REQUEST_ID = correlation_id


class CorrelationFilter(logging.Filter):
    def filter(self, record):
        record.correlation_id = correlation_id.get("-")
        return True


class JSONFormatter(logging.Formatter):
    def format(self, record):
        log = {
            "ts": datetime.now().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", "-"),
        }
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        return str(log)


def setup_logging(debug: bool = False):
    """Configure structured logging."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if debug else logging.INFO)

    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    handler.addFilter(CorrelationFilter())

    root.handlers.clear()
    root.addHandler(handler)

    # Quiet noisy libs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)
