"""deploy router — skeleton."""

from __future__ import annotations
from fastapi import APIRouter

router = APIRouter(prefix="/api/mc", tags=["deploy"])
# TODO: Migrate from server.py
