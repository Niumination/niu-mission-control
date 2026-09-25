'use client';

/**
 * TaskPanel — slide-in drawer kanan untuk membuat task & melihat queue.
 * v2: subscribe ke Zustand stores (SSE-realtime) ketimbang polling fetch manual.
 */

import { useState, useEffect } from 'react';
import { X, Plus, Play, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useTasksStore, useAgentsStore, useHealthStore, type TaskState, type AgentState } from '@/lib/client/stores';

const ACCENT = '#00e5ff';
const GOLD = '#f5a623';
const GREEN = '#34d399';
const RED = '#ef4444';
const BG_DARK = '#04080f';
const BG_CARD = 'rgba(15, 23, 42, 0.8)';
const BORDER = 'rgba(240, 237, 232, 0.15)';
const TEXT = '#f0ede8';
const TEXT_MUTED = '#94a3b8';

type Agent = AgentState;
type Task = TaskState;

interface Health {
  status: string;
  worker_last_tick: string | null;
  connected: boolean;
  reconnectCount: number;
}

export default function TaskPanel({ isOpen, onClose, onTaskCreated }: { isOpen: boolean; onClose: () => void; onTaskCreated?: () => void }) {
  // Subscribe ke stores — otomatis update realtime via SSE
  const agents = useAgentsStore(s => Object.values(s.agents));
  const allTasks = useTasksStore(s => Object.values(s.tasks));
  const healthStore = useHealthStore();
  const health: Health = {
    status: healthStore.status,
    worker_last_tick: healthStore.worker_last_tick,
    connected: healthStore.connected,
    reconnectCount: healthStore.reconnectCount,
  };

  const [newTask, setNewTask] = useState({ title: '', agent: 'chief', priority: 'medium' });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Snapshot bootstraps dengan sendirinya saat SSE connect;
  // jadi kita hanya perlu menunda spinner sampai data awal masuk.
  useEffect(() => {
    if (isOpen && agents.length > 0) setLoading(false);
    const t = setTimeout(() => setLoading(false), 2000); // fallback
    return () => clearTimeout(t);
  }, [isOpen, agents.length]);

  // Urut dan kelompokkan tasks
  const statusOrder = ['running', 'queued', 'review', 'inbox', 'done', 'failed'] as const;
  const tasks = [...allTasks].sort((a, b) => {
    const sa = statusOrder.indexOf(a.status as any);
    const sb = statusOrder.indexOf(b.status as any);
    if (sa !== sb) return sa - sb;
    return (b.created_at || '').localeCompare(a.created_at || '');
  }).slice(0, 100); // batasi 100 task terbaru

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    setCreating(true);
    try {
      // Dispatch via /api/mc/dispatch (shortcut yang langsung enqueue ke chief/specialist)
      const res = await fetch('/api/mc/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask.title,
          instruction: newTask.title,
          agent: newTask.agent,
          priority: newTask.priority,
        })
      });
      const data = await res.json();
      if (data.id) {
        setNewTask({ ...newTask, title: '' });
        onTaskCreated?.();
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      // Map nama status UI → internal
      const mapped = newStatus === 'completed' ? 'done' : newStatus;
      await fetch(`/api/mc/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: mapped }),
      });
      // Tidak perlu refetch manual — SSE akan mengirim event update ke store
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'queued' || t.status === 'inbox');
  const runningTasks = tasks.filter(t => t.status === 'running');
  const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'review');
  const failedTasks = tasks.filter(t => t.status === 'failed');

  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return RED;
      case 'medium': return GOLD;
      case 'low': return GREEN;
      default: return TEXT_MUTED;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'inbox':
      case 'queued': return GOLD;
      case 'running': return ACCENT;
      case 'review': return '#a855f7';
      case 'done':
      case 'completed': return GREEN;
      case 'failed': return RED;
      case 'cancelled': return TEXT_MUTED;
      default: return TEXT_MUTED;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(4, 8, 15, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 150,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Slide-in Panel from Right - Full Height */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 100vw)',
          background: 'rgba(4, 8, 15, 0.97)',
          borderLeft: `1px solid ${BORDER}`,
          boxShadow: `-20px 0 60px rgba(0, 0, 0, 0.5), inset 1px 0 0 ${ACCENT}20`,
          backdropFilter: 'blur(24px)',
          zIndex: 160,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.12), transparent)',
            borderBottom: `1px solid ${BORDER}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: health?.connected ? GREEN : RED,
                boxShadow: `0 0 12px ${health?.connected ? GREEN : RED}`,
              }}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT }}>
              Task Queue
            </span>
            <span style={{ fontSize: '0.75rem', color: TEXT_MUTED, padding: '3px 10px', background: 'rgba(240,237,232,0.08)', borderRadius: 6 }}>
              {tasks.length}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: `1px solid ${BORDER}`,
              background: 'rgba(15, 23, 42, 0.5)',
              color: TEXT_MUTED,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MUTED; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Stats Bar */}
        <div style={{ display: 'flex', gap: '10px', padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <StatPill label="PENDING" value={pendingTasks.length} color={GOLD} />
          <StatPill label="RUNNING" value={runningTasks.length} color={ACCENT} />
          <StatPill label="DONE" value={completedTasks.length} color={GREEN} />
          <StatPill label="FAILED" value={failedTasks.length} color={RED} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          {/* Create Task Form */}
          <form onSubmit={handleCreateTask} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                style={{
                  padding: '12px 14px',
                  background: BG_CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  color: TEXT,
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = `0 0 0 2px ${ACCENT}30`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  value={newTask.agent}
                  onChange={(e) => setNewTask({ ...newTask, agent: e.target.value })}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    background: BG_CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    color: TEXT,
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                    outline: 'none',
                    appearance: 'none',
                  }}
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id} style={{ background: BG_DARK }}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  style={{
                    width: 110,
                    padding: '12px 14px',
                    background: BG_CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    color: TEXT,
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                    outline: 'none',
                    appearance: 'none',
                  }}
                >
                  <option value="high" style={{ background: BG_DARK }}>HIGH</option>
                  <option value="medium" style={{ background: BG_DARK }}>MEDIUM</option>
                  <option value="low" style={{ background: BG_DARK }}>LOW</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creating || !newTask.title.trim()}
                style={{
                  padding: '12px 18px',
                  background: creating ? 'rgba(245, 166, 35, 0.3)' : `linear-gradient(90deg, ${ACCENT}, ${GOLD})`,
                  border: 'none',
                  borderRadius: 10,
                  color: '#04080f',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.7 : 1,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {creating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
                {creating ? 'QUEUING...' : 'ADD TASK'}
              </button>
            </div>
          </form>

          {/* Tasks List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: TEXT_MUTED, fontSize: '0.9rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.3 }}>○</div>
                No tasks in queue
              </div>
            ) : (
              tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  priorityColor={priorityColor(task.priority)}
                  statusColor={statusColor(task.status)}
                  onStatusChange={handleStatusChange}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      flex: 1,
      padding: '10px 12px',
      background: 'rgba(240, 237, 232, 0.03)',
      border: `1px solid ${color}30`,
      borderRadius: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}>
      <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>
        {label}
      </span>
      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: TEXT }}>{value}</span>
    </div>
  );
}

function TaskCard({ task, priorityColor, statusColor, onStatusChange }: { task: Task; priorityColor: string; statusColor: string; onStatusChange: (id: string, status: string) => void }) {
  return (
    <div style={{
      background: BG_CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: '14px',
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              padding: '3px 8px',
              background: `${priorityColor}25`,
              color: priorityColor,
              borderRadius: 4,
              border: `1px solid ${priorityColor}40`,
            }}>
              {task.priority.toUpperCase()}
            </span>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              padding: '3px 8px',
              background: `${statusColor}25`,
              color: statusColor,
              borderRadius: 4,
              border: `1px solid ${statusColor}40`,
            }}>
              {task.status.toUpperCase()}
            </span>
          </div>
          <div style={{ fontWeight: 500, fontSize: '0.9rem', color: TEXT, wordBreak: 'break-word' }}>
            {task.title}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: TEXT_MUTED }}>
        <span>👤 {task.agent_name || 'Unassigned'}</span>
        <span>🕐 {task.created_at ? new Date(task.created_at).toLocaleString() : '—'}</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
        {(task.status === 'queued' || task.status === 'inbox') && (
          <button
            onClick={() => onStatusChange(task.id, 'running')}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: `rgba(0, 229, 255, 0.15)`,
              border: `1px solid ${ACCENT}40`,
              borderRadius: 8,
              color: ACCENT,
              fontFamily: 'inherit',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.color = BG_DARK; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(0, 229, 255, 0.15)`; e.currentTarget.style.color = ACCENT; }}
          >
            <Play size={14} />
            START
          </button>
        )}
        {task.status === 'running' && (
          <button
            onClick={() => onStatusChange(task.id, 'completed')}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: `rgba(52, 211, 153, 0.15)`,
              border: `1px solid ${GREEN}40`,
              borderRadius: 8,
              color: GREEN,
              fontFamily: 'inherit',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = GREEN; e.currentTarget.style.color = BG_DARK; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(52, 211, 153, 0.15)`; e.currentTarget.style.color = GREEN; }}
          >
            <CheckCircle size={14} />
            COMPLETE
          </button>
        )}
        <button
          onClick={() => onStatusChange(task.id, 'failed')}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: `rgba(239, 68, 68, 0.15)`,
            border: `1px solid ${RED}40`,
            borderRadius: 8,
            color: RED,
            fontFamily: 'inherit',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = RED; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(239, 68, 68, 0.15)`; e.currentTarget.style.color = RED; }}
        >
          <AlertTriangle size={14} />
          FAIL
        </button>
      </div>
    </div>
  );
}