"""
Telegram Topic Router — Plugin Niu-MissionControl
===================================================

Plugin ini mengelola routing pesan Telegram berdasarkan Topic ID
(message_thread_id) ke agent persona yang sesuai.

CARA KERJA:
Plugin ini TIDAK menggunakan hook lifecycle Hermes (karena Hermes gateway
sudah memiliki built-in channel_prompts, allowed_topics, dan
channel_skill_bindings). Sebagai gantinya, plugin ini:

1. Menyediakan konfigurasi mapping Topic ID → Agent Persona
2. Validasi struktur config sebelum dipakai
3. Utility functions untuk mengelola routing

KONFIGURASI:
Semua routing dikonfigurasi di Hermes config.yaml → telegram:

```yaml
telegram:
  channel_prompts:
    '1': |
      Kamu adalah General / Command Center...
    '236': |
      Kamu adalah Builder...
    '235': |
      Kamu adalah Pengawas...
    '230': |
      Kamu adalah Arsitek...
    '231': |
      Kamu adalah Penjaga...
    '232': |
      Kamu adalah Scribe...
    '233': |
      Kamu adalah Reach...
  allowed_chats: '-1004204696417'
  require_mention: false
  free_response_chats: '-1004204696417'
  allowed_topics: 1,230,231,232,233,235,236
  extra:
    channel_skill_bindings:
    - id: '235'
      skills: [ponytail, requesting-code-review]
    - id: '236'
      skills: [codebase-audit]
    - id: '230'
      skills: [project-foundation, writing-plans]
    - id: '231'
      skills: [kanban-orchestrator]
    - id: '232'
      skills: [project-foundation, writing-plans]
    - id: '233'
      skills: [xurl, youtube-content, gif-search]
```
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger("telegram_router")

# ── Mapping Persona: topic_id → nama agent ─────────────────────────────────────
# Nilai default sebelum topic ID sebenarnya didapat dari Telegram.
# Angka 1-7 = urutan topic (General, Dev, Audit, Plan, Ops, Docs, Social)

# ── Mapping Persona: topic_id (Telegram message_thread_id) → nama agent ──────
# ID asli dari Niu-MissionControl group.
# Topic 1 = #general (default), topic lain punya ID numerik unik.
PERSONA_MAP: dict[str, str] = {
    "1": "general",      # #general — urusan umum / orchestrator
    "236": "builder",    # #dev — coding, implementasi
    "235": "pengawas",   # #audit — review, keamanan
    "230": "arsitek",    # #plan — arsitektur, riset
    "231": "penjaga",    # #ops — operasi, monitoring
    "232": "scribe",     # #docs — dokumentasi
    "233": "reach",      # #social — outreach
}

PERSONA_NAMES: dict[str, str] = {
    "1": "General / Command Center",
    "236": "Dev / Builder",
    "235": "Audit / Pengawas",
    "230": "Plan / Arsitek",
    "231": "Ops / Penjaga",
    "232": "Docs / Scribe",
    "233": "Social / Reach",
}

# ── Validasi ────────────────────────────────────────────────────────────────────


def validate_config(extra: dict[str, Any]) -> list[str]:
    """Validasi struktur config Telegram extra untuk topic routing.

    Args:
        extra: Isi dari config.extra telegram section

    Returns:
        List of warning/error messages (kosong = valid)
    """
    issues: list[str] = []

    # Cek allowed_topics
    allowed = extra.get("allowed_topics", [])
    if not allowed:
        issues.append("allowed_topics kosong — bot tidak akan merespon di topic mana pun")
    elif not isinstance(allowed, (list, str)):
        issues.append("allowed_topics harus list atau string comma-separated")

    # Cek channel_prompts
    prompts = extra.get("channel_prompts", {})
    if not prompts:
        issues.append("channel_prompts kosong — tidak ada persona yang dikonfigurasi")
    elif not isinstance(prompts, dict):
        issues.append("channel_prompts harus dict dengan key = topic_id")

    # Cek channel_skill_bindings (di dalam extra)
    bindings = extra.get("extra", {}).get("channel_skill_bindings", [])
    if bindings and isinstance(bindings, list):
        for b in bindings:
            if not isinstance(b, dict) or "id" not in b:
                issues.append(f"channel_skill_bindings entry invalid: {b}")

    # Cek require_mention — harus false untuk free-response di topic
    if extra.get("require_mention", True):
        issues.append(
            "require_mention: true akan membuat bot hanya respon saat @mention — "
            "set false untuk free-response di topic"
        )

    return issues


def persona_for_topic(topic_id: str) -> Optional[str]:
    """Dapatkan nama persona untuk topic ID tertentu.

    Args:
        topic_id: message_thread_id sebagai string

    Returns:
        Nama persona atau None jika tidak dikenal
    """
    return PERSONA_MAP.get(topic_id)


def persona_name(topic_id: str) -> Optional[str]:
    """Dapatkan nama human-readable untuk topic ID.

    Args:
        topic_id: message_thread_id sebagai string

    Returns:
        Nama topic atau None jika tidak dikenal
    """
    return PERSONA_NAMES.get(topic_id)


# ── Hook Plugin Hermes ──────────────────────────────────────────────────────────


def register(ctx) -> None:
    """Daftarkan plugin ini ke Hermes agent.

    Plugin ini hanya menyediakan validasi — routing actual dilakukan
    oleh Hermes gateway melalui channel_prompts + allowed_topics.
    """
    # Validasi config telegram saat session start
    def _on_session_start(**kwargs):
        # Coba baca config telegram
        hermes_home = os.environ.get("HERMES_HOME", "")
        if not hermes_home:
            return

        config_path = os.path.join(hermes_home, "config.yaml")
        if not os.path.exists(config_path):
            return

        # Baca telegram extra config
        try:
            import yaml
            with open(config_path, "r") as f:
                cfg = yaml.safe_load(f)
            telegram_cfg = (cfg or {}).get("telegram", {})
            if telegram_cfg:
                issues = validate_config(telegram_cfg)
                if issues:
                    logger.warning(
                        "[telegram_router] Config issues ditemukan:\n  - %s",
                        "\n  - ".join(issues),
                    )
        except Exception:
            pass

    ctx.register_hook("on_session_start", _on_session_start)
