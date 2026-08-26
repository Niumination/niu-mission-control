"""Artifacts router — migrasi dari server.py."""

from __future__ import annotations

import os
import sys

_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi import APIRouter  # noqa: E402

router = APIRouter(prefix="/api/mc", tags=["artifacts"])


@router.get("/artifacts")
async def list_artifacts():
    """List artifacts organized by category."""
    base = "/tmp/hermes_research"
    result = {}
    if os.path.isdir(base):
        for category in sorted(os.listdir(base)):
            cat_dir = os.path.join(base, category)
            if os.path.isdir(cat_dir):
                files = [
                    f
                    for f in os.listdir(cat_dir)
                    if os.path.isfile(os.path.join(cat_dir, f))
                ]
                result[category] = files
    return {"artifacts": result, "count": sum(len(v) for v in result.values())}


@router.get("/artifact-content")
async def get_artifact_content(file: str):
    """Get artifact file content."""
    try:
        # Security: only allow /tmp/hermes_* paths
        if not file.startswith("/tmp/hermes_"):
            return {"error": "Invalid path"}
        with open(file) as f:
            return {"content": f.read(), "file": file}
    except Exception as e:
        return {"error": str(e)}


@router.post("/artifact/version")
async def record_version(payload: dict):
    """Record artifact version."""
    return {"status": "recorded", "file": payload.get("file")}


@router.get("/artifact/versions")
async def get_versions(file_path: str, limit: int = 50):
    """Get version history."""
    return {"versions": [], "file": file_path}
