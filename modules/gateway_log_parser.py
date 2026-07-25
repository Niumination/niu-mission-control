"""
Gateway Log Parser — Parse Hermes gateway.log for Telegram messages
==================================================================

Membaca gateway.log dan mengekstrak pesan inbound/outbound Telegram.
Ini menggantikan SQLite agent_logs sebagai sumber data Telegram Feed
karena agent_logs hanya berisi log internal MC server, bukan pesan
Telegram nyata dari grup.

Alur data:
  gateway.log → parser → list of message events → /api/mc/telegram-feed
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger("gateway_log_parser")

# Default path ke Hermes gateway.log
HERMES_LOG_DIR = os.environ.get(
    "HERMES_LOG_DIR",
    "/Volumes/HermesAgent/HermesAgentUSB/data/logs",
)
GATEWAY_LOG = os.path.join(HERMES_LOG_DIR, "gateway.log")

# Chat ID Telegram group
TG_GROUP_CHAT_ID = "-1004204696417"

# Topic ID → Agent mapping
TOPIC_AGENT_MAP = {
    None: "general",
    "": "general",
    "1": "general",
    "802": "research",
    "803": "programmer",
    "804": "qa",
}

# Regex patterns untuk gateway.log
# Format timestamp: 2026-07-25 18:07:57,684
_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})")

# Inbound message pattern
# gateway.run: inbound message: platform=telegram user=X chat=ID msg='...' reply_to_id=802 reply_to_text=''
_INBOUND_RE = re.compile(
    r"inbound message: "
    r"platform=(\S+) "
    r"user=(.+?) "
    r"chat=(\S+) "
    r"msg='(.*?)' "
    r"reply_to_id=(\S+)"
)

# Response ready pattern
# gateway.run: response ready: platform=telegram chat=ID time=28.1s api_calls=1 response=38 chars
_RESPONSE_RE = re.compile(
    r"response ready: "
    r"platform=(\S+) "
    r"chat=(\S+) "
    r"time=(\S+) "
    r"api_calls=(\d+) "
    r"response=(\d+) chars"
)

# Sending response pattern
# gateway.platforms.base: [Telegram] Sending response (38 chars) to -1004204696417
_SENDING_RE = re.compile(
    r"Sending response \((\d+) chars\) to (\S+)"
)

# Flush batch pattern — untuk match response ke topic
# hermes_plugins.telegram_platform.adapter: [Telegram] Flushing text batch ...:-1004204696417:802 (4 chars)
_FLUSH_RE = re.compile(
    r"Flushing text batch .+:(-?\d+):(\d+) \((\d+) chars\)"
)


def _parse_timestamp(ts_str: str) -> str:
    """Convert gateway.log timestamp ke ISO format."""
    try:
        # "2026-07-25 18:07:57,684" → "2026-07-25T18:07:57"
        dt = datetime.strptime(ts_str.replace(",", "."), "%Y-%m-%d %H:%M:%S.%f")
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ts_str


def _parse_time_seconds(time_str: str) -> float:
    """Convert '28.1s' ke float seconds."""
    try:
        return float(time_str.replace("s", ""))
    except Exception:
        return 0.0


def _truncate(text: str, max_len: int = 500) -> str:
    """Truncate panjang pesan."""
    if len(text) <= max_len:
        return text
    return text[:max_len] + "..."


def parse_gateway_log(
    log_path: Optional[str] = None,
    limit: int = 50,
    topic_filter: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    Parse gateway.log dan return list pesan Telegram.

    Args:
        log_path: Path ke gateway.log (default: GATEWAY_LOG)
        limit: Jumlah pesan maksimal
        topic_filter: Filter by topic ID ("1", "802", "803", "804") atau None untuk semua

    Returns:
        List of message dicts:
        {
            "timestamp": "2026-07-25 18:07:57",
            "type": "inbound" | "response",
            "user": "Afrizal Munthe",  # hanya untuk inbound
            "message": "halo",
            "topic_id": "802",
            "topic_label": "Research",
            "agent": "research",
            "response_time": "28.1s",  # hanya untuk response
            "response_chars": 38,      # hanya untuk response
        }
    """
    path = log_path or GATEWAY_LOG
    if not os.path.exists(path):
        logger.warning("Gateway log not found: %s", path)
        return []

    events: list[dict[str, Any]] = []
    last_topic: str = "1"  # Track topic terakhir untuk match response

    try:
        # Baca dari belakang (tail) untuk ambil pesan terbaru
        # Baca max 200KB dari akhir file (cukup untuk ~50 pesan terakhir)
        file_size = os.path.getsize(path)
        read_size = min(file_size, 200 * 1024)  # 200KB max
        start_pos = max(0, file_size - read_size)

        with open(path, "r", encoding="utf-8", errors="replace") as f:
            if start_pos > 0:
                f.seek(start_pos)
                f.readline()  # Skip partial line

            for line in f:
                line = line.strip()
                if not line:
                    continue

                # Extract timestamp
                ts_match = _TS_RE.match(line)
                if not ts_match:
                    continue
                timestamp = _parse_timestamp(ts_match.group(1))

                # Only process Telegram-related lines
                if "telegram" not in line.lower() and "gateway.run" not in line:
                    continue

                # Inbound message
                inbound_match = _INBOUND_RE.search(line)
                if inbound_match:
                    platform = inbound_match.group(1)
                    user = inbound_match.group(2)
                    chat = inbound_match.group(3)
                    message = inbound_match.group(4)
                    reply_to_id = inbound_match.group(5)

                    # Skip non-group messages
                    if chat != TG_GROUP_CHAT_ID:
                        continue

                    topic_id = reply_to_id if reply_to_id and reply_to_id != "None" else "1"
                    agent = TOPIC_AGENT_MAP.get(topic_id, "general")
                    last_topic = topic_id

                    events.append({
                        "timestamp": timestamp,
                        "type": "inbound",
                        "user": user,
                        "message": _truncate(message),
                        "topic_id": topic_id,
                        "topic_label": agent.title(),
                        "agent": agent,
                    })
                    continue

                # Response ready
                response_match = _RESPONSE_RE.search(line)
                if response_match:
                    platform = response_match.group(1)
                    chat = response_match.group(2)
                    time_taken = response_match.group(3)
                    api_calls = int(response_match.group(4))
                    response_chars = int(response_match.group(5))

                    # Only for Telegram group
                    if chat != TG_GROUP_CHAT_ID:
                        continue

                    agent = TOPIC_AGENT_MAP.get(last_topic, "general")

                    events.append({
                        "timestamp": timestamp,
                        "type": "response",
                        "message": f"Agent {agent.upper()} merespons ({response_chars} chars, {time_taken}, {api_calls} API call(s))",
                        "topic_id": last_topic,
                        "topic_label": agent.title(),
                        "agent": agent,
                        "response_time": time_taken,
                        "response_chars": response_chars,
                        "api_calls": api_calls,
                    })
                    continue

                # Flush batch — update last_topic tracking
                flush_match = _FLUSH_RE.search(line)
                if flush_match:
                    chat_id = flush_match.group(1)
                    if chat_id == TG_GROUP_CHAT_ID:
                        topic_id = flush_match.group(2)
                        if topic_id in TOPIC_AGENT_MAP:
                            last_topic = topic_id

    except Exception as e:
        logger.error("Error parsing gateway.log: %s", e)
        return []

    # Apply topic filter
    if topic_filter and topic_filter != "1":
        events = [e for e in events if e["topic_id"] == topic_filter]
    elif topic_filter == "1":
        # "1" = General = topic 1 or None
        events = [e for e in events if e.get("topic_id") in ("1", None, "")]

    # Reverse untuk oldest-first (karena kita baca dari belakang)
    events.reverse()

    # Apply limit
    if len(events) > limit:
        events = events[-limit:]

    return events


def get_gateway_status() -> dict[str, Any]:
    """Return info tentang gateway.log untuk debugging."""
    path = GATEWAY_LOG
    exists = os.path.exists(path)
    size_kb = 0
    if exists:
        try:
            size_kb = round(os.path.getsize(path) / 1024, 1)
        except Exception:
            pass
    return {
        "log_path": path,
        "exists": exists,
        "size_kb": size_kb,
        "log_dir": HERMES_LOG_DIR,
    }
