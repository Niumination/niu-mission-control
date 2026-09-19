#!/usr/bin/env python3
"""
Mission Control Database Manager
Manages SQLite database for tasks, agents, and cost tracking.
"""

import sqlite3
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from typing import List, Dict, Optional, Union
import sys

DB_PATH = os.environ.get(
    'MC_DB_PATH',
    str(Path(__file__).parent / 'data' / 'swarm_state.db')
)


def get_connection():
    """Get database connection with WAL mode."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def init_db():
    """Initialize database from init.sql."""
    conn = get_connection()
    sql_path = Path(__file__).parent / 'data' / 'init.sql'
    if sql_path.exists():
        with open(sql_path) as f:
            conn.executescript(f.read())
    conn.close()


def get_agents():
    """Get all agents with stats."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.*, 
               COUNT(t.id) as total_tasks,
               SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
               SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM agents a
        LEFT JOIN tasks t ON a.id = t.agent_id
        GROUP BY a.id
        ORDER BY a.id
    ''')
    agents = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return agents


def get_tasks(status=None):
    """Get tasks with optional status filter."""
    conn = get_connection()
    cursor = conn.cursor()
    
    if status:
        cursor.execute('''
            SELECT t.*, a.name as agent_name
            FROM tasks t
            LEFT JOIN agents a ON t.agent_id = a.id
            WHERE t.status = ?
            ORDER BY t.created_at DESC
        ''', (status,))
    else:
        cursor.execute('''
            SELECT t.*, a.name as agent_name
            FROM tasks t
            LEFT JOIN agents a ON t.agent_id = a.id
            ORDER BY t.created_at DESC
        ''')
    
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return tasks


def get_task_groups():
    """Get tasks grouped by status."""
    tasks = get_tasks()
    groups = {'pending': [], 'running': [], 'completed': [], 'failed': []}
    for task in tasks:
        status = task['status']
        if status in groups:
            groups[status].append(task)
    return groups


def create_task(title: str, agent_id: Optional[str] = None, priority: str = 'medium', description: Optional[str] = None) -> str:
    """Create a new task."""
    conn = get_connection()
    cursor = conn.cursor()
    # Generate unique ID with microseconds to avoid collision
    now = datetime.now()
    task_id = f"t{int(now.timestamp())}{now.microsecond:06d}"
    try:
        cursor.execute('''
            INSERT INTO tasks (id, title, description, agent_id, status, priority)
            VALUES (?, ?, ?, ?, 'pending', ?)
        ''', (task_id, title, description, agent_id, priority))
        conn.commit()
    except sqlite3.IntegrityError:
        # Fallback if collision occurs
        task_id = f"t{int(now.timestamp())}{now.microsecond:06d}_2"
        cursor.execute('''
            INSERT INTO tasks (id, title, description, agent_id, status, priority)
            VALUES (?, ?, ?, ?, 'pending', ?)
        ''', (task_id, title, description, agent_id, priority))
        conn.commit()
    finally:
        conn.close()
    return task_id


def update_task_status(task_id: str, status: str, result: Optional[str] = None) -> bool:
    """Update task status and timestamp."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    if status == 'completed':
        cursor.execute('''
            UPDATE tasks SET status = ?, updated_at = ?, completed_at = ?, result = ?
            WHERE id = ?
        ''', (status, now, now, result, task_id))
    elif status == 'failed':
        cursor.execute('''
            UPDATE tasks SET status = ?, updated_at = ?, failed_at = ?, result = ?
            WHERE id = ?
        ''', (status, now, now, result, task_id))
    elif status == 'running':
        cursor.execute('''
            UPDATE tasks SET status = ?, updated_at = ?
            WHERE id = ?
        ''', (status, now, task_id))
    else:
        cursor.execute('''
            UPDATE tasks SET status = ?, updated_at = ?
            WHERE id = ?
        ''', (status, now, task_id))

    conn.commit()
    conn.close()
    return True


def record_cost(session_id, model, provider, input_tokens, output_tokens, cost_usd):
    """Record cost usage."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO cost_tracking (session_id, model, provider, input_tokens, output_tokens, cost_usd)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (session_id, model, provider, input_tokens, output_tokens, cost_usd))
    conn.commit()
    conn.close()
    return True


def get_cost_summary(days=30):
    """Get cost summary for recent days."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT 
            model,
            provider,
            SUM(input_tokens) as total_input,
            SUM(output_tokens) as total_output,
            SUM(cost_usd) as total_cost
        FROM cost_tracking
        WHERE created_at > datetime('now', '-{0} days')
        GROUP BY model, provider
        ORDER BY total_cost DESC
    '''.format(days))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def log_event(level, message, source=None):
    """Log system event."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO system_logs (level, message, source)
        VALUES (?, ?, ?)
    ''', (level, message, source))
    conn.commit()
    conn.close()
    return True


def test_db():
    """Test if database is accessible."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        conn.close()
        return True
    except:
        return False


# ── Dispatch Operations ─────────────────────────────────────

def add_dispatch(target_topic: str, message: str, source_agent: str = 'general') -> dict:
    """Create a new dispatch record."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    dispatch_id = f"d{uuid.uuid4().hex[:12]}"
    cursor.execute('''
        INSERT INTO dispatches (id, target_topic, message, source_agent, status)
        VALUES (?, ?, ?, ?, 'pending')
    ''', (dispatch_id, target_topic, message, source_agent))
    conn.commit()
    cursor.execute('SELECT * FROM dispatches WHERE id = ?', (dispatch_id,))
    row = dict(cursor.fetchone())
    conn.close()
    return row


def update_dispatch_status(dispatch_id: str, status: str, error: Optional[str] = None) -> bool:
    """Update dispatch status."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE dispatches SET status = ?, error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (status, error, dispatch_id))
    conn.commit()
    conn.close()
    return True


def get_dispatches(limit: int = 20) -> list:
    """Get recent dispatches."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM dispatches ORDER BY created_at DESC LIMIT ?
    ''', (limit,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        query = sys.argv[1]
        params = []
        for p in sys.argv[2:]:
            try:
                params.append(json.loads(p))
            except:
                params.append(p)
        
        if query == 'test_db':
            print(json.dumps(test_db()))
        elif query == 'get_agents':
            print(json.dumps(get_agents()))
        elif query == 'get_tasks':
            print(json.dumps(get_tasks(*params)))
        elif query == 'get_task_groups':
            print(json.dumps(get_task_groups()))
        elif query == 'create_task':
            print(json.dumps(create_task(*params)))
        elif query == 'update_task_status':
            print(json.dumps(update_task_status(*params)))
        elif query == 'get_cost_summary':
            print(json.dumps(get_cost_summary(*params)))
        elif query == 'add_dispatch':
            print(json.dumps(add_dispatch(*params)))
        elif query == 'update_dispatch_status':
            print(json.dumps(update_dispatch_status(*params)))
        elif query == 'get_dispatches':
            print(json.dumps(get_dispatches(*params)))
        else:
            print(json.dumps({'error': f'Unknown query: {query}'}))
    else:
        init_db()
        print(f"Database initialized at {DB_PATH}")
        print(f"Agents: {len(get_agents())}")
        print(f"Tasks: {len(get_tasks())}")
