'use client'

/**
 * KanbanBoard — halaman /missions. Layout 6 kolom:
 *   Inbox → Queued → Running → Review → Done → Failed
 *
 * Fitur:
 *   - Drag & drop dengan @dnd-kit/core + @dnd-kit/sortable (sortable per kolom)
 *   - Validasi transisi: hanya status yang diizinkan state-machine yang berhasil (yang lain → revert + toast error)
 *   - Optimistic update; jika server gagal (409) data otomatis revert dari SSE event
 *   - Toolbar: search, filter agent, filter priority, sort (newest/oldest/priority)
 *   - FAB "+ New Task" di kanan-bawah (modal create task)
 *   - Empty state per kolom
 *   - Header kolom: nama, count badge, collapse toggle (untuk Done/Failed)
 *   - Drop zone visual (highlight border) saat drag over
 *   - Drag overlay (kartu hantu yang mengikuti kursor)
 */

import { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCorners,
  useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Search, Inbox, Clock, Loader2, AlertTriangle, CheckCircle2, XCircle, Filter, ChevronDown, X as XIcon } from 'lucide-react'
import { useTasksStore, useAgentsStore, type TaskState } from '@/lib/client/stores'
import KanbanCard from './KanbanCard'
import TaskInspector from './TaskInspector'
import CreateTaskModal from './CreateTaskModal'
import { toast } from '../ui/Toast'
import { canTransition } from '@/lib/client/transitions'

type ColId = 'inbox' | 'queued' | 'running' | 'review' | 'done' | 'failed'

interface Column {
  id: ColId
  label: string
  color: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  accent: string
  canCollapse?: boolean
}

const COLUMNS: Column[] = [
  { id: 'inbox',    label: 'Inbox',    color: '#94a3b8', icon: Inbox,        accent: 'rgba(148,163,184,0.15)' },
  { id: 'queued',   label: 'Queued',   color: '#f5a623', icon: Clock,        accent: 'rgba(245,166,35,0.15)' },
  { id: 'running',  label: 'Running',  color: '#00e5ff', icon: Loader2,      accent: 'rgba(0,229,255,0.15)' },
  { id: 'review',   label: 'Review',   color: '#a855f7', icon: AlertTriangle, accent: 'rgba(168,85,247,0.15)' },
  { id: 'done',     label: 'Done',     color: '#34d399', icon: CheckCircle2, accent: 'rgba(52,211,153,0.12)', canCollapse: true },
  { id: 'failed',   label: 'Failed',   color: '#ef4444', icon: XCircle,      accent: 'rgba(239,68,68,0.15)',  canCollapse: true },
]

export default function KanbanBoard() {
  const tasks = useTasksStore(s => s.tasks)
  const agents = useAgentsStore(s => s.agents)
  const upsertTask = useTasksStore(s => s.upsertTask)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)        // id kolom / kartu tempat hover
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest')
  const [collapsed, setCollapsed] = useState<Record<ColId, boolean>>({} as any)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  // Kelompokkan task per kolom dengan filter + sort
  const columns = useMemo(() => {
    const all = Object.values(tasks)
    const q = search.trim().toLowerCase()
    const filtered = all.filter(t => {
      if (agentFilter !== 'all' && t.assigned_agent !== agentFilter) return false
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (q) {
        const hay = (t.title + ' ' + (t.description || '') + ' ' + t.id).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const priOrder = { high: 0, medium: 1, low: 2 } as const
    const groups: Record<ColId, TaskState[]> = { inbox: [], queued: [], running: [], review: [], done: [], failed: [] }
    for (const t of filtered) {
      const col = t.status as ColId
      if (groups[col]) groups[col].push(t)
    }
    for (const col of Object.keys(groups) as ColId[]) {
      groups[col].sort((a, b) => {
        if (sortBy === 'priority') {
          const pa = priOrder[a.priority as keyof typeof priOrder] ?? 1
          const pb = priOrder[b.priority as keyof typeof priOrder] ?? 1
          if (pa !== pb) return pa - pb
        }
        const da = a.created_at || '', db = b.created_at || ''
        return sortBy === 'oldest' ? da.localeCompare(db) : db.localeCompare(da)
      })
    }
    return groups
  }, [tasks, search, agentFilter, priorityFilter, sortBy])

  const activeTask = activeId ? tasks[activeId] : null

  // Temukan kolom dari id (bisa id kartu atau id kolom)
  const findColumnOf = (id: string | null): ColId | null => {
    if (!id) return null
    if ((COLUMNS as any[]).find(c => c.id === id)) return id as ColId
    const t = tasks[id]
    return t ? (t.status as ColId) : null
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragOver = (e: DragOverEvent) => {
    setOverId(e.over ? String(e.over.id) : null)
  }

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null)
    setOverId(null)
    const { active, over } = e
    if (!over) return
    const fromCol = findColumnOf(String(active.id))
    const toCol = findColumnOf(String(over.id))
    if (!fromCol || !toCol || fromCol === toCol) return

    const taskId = String(active.id)
    const t = tasks[taskId]
    if (!t) return

    // Validasi legal transition di sisi client
    if (!canTransition(fromCol, toCol)) {
      toast.error(`Tidak dapat memindahkan dari ${fromCol} → ${toCol}`)
      return
    }

    // Optimistic update (akan di-revert oleh SSE jika server tolak)
    // upsertTask tidak merubah apa yang server kirim balik — jadi saat event 'task.updated'
    // datang via SSE, store akan ter-update dengan data canonical dari server.
    // Tapi untuk UX drag yang smooth, kita set dulu.
    upsertTask({ id: taskId, status: toCol } as any)

    try {
      const res = await fetch(`/api/mc/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toCol }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || `Transisi ${fromCol} → ${toCol} ditolak`)
        // Server akan broadcast status asli via SSE, jadi UI akan revert otomatis
      } else {
        toast.success(`Task → ${toCol}`, { duration: 2000 })
      }
    } catch {
      toast.error('Network error')
    }
  }

  const overColumn = findColumnOf(overId)

  const totalCount = Object.values(tasks).length
  const doneCount = columns.done.length
  const activeCount = columns.running.length + columns.queued.length + columns.review.length + columns.inbox.length

  return (
    <div style={{
      height: 'calc(100vh - 52px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"JetBrains Mono", monospace',
      background: '#04080f',
      color: '#f0ede8',
    }}>
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={{
        padding: '14px 22px',
        borderBottom: '1px solid rgba(240,237,232,0.07)',
        display: 'flex', alignItems: 'center', gap: 12,
        flexWrap: 'wrap',
        background: 'rgba(4,8,15,0.6)',
        backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: activeCount > 0 ? '#00e5ff' : '#34d399',
            boxShadow: `0 0 8px ${activeCount > 0 ? '#00e5ff' : '#34d399'}`,
          }} />
          Mission Kanban
        </h1>
        <span style={{ fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em' }}>
          {activeCount} active · {doneCount} done · {totalCount} total
        </span>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 8,
          background: 'rgba(240,237,232,0.04)',
          border: '1px solid rgba(240,237,232,0.1)',
          minWidth: 220,
        }}>
          <Search size={14} color="#64748b" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#f0ede8', fontSize: '0.75rem', fontFamily: 'inherit',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>
              <XIcon size={12} />
            </button>
          )}
        </div>

        {/* Filter button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setFilterOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', borderRadius: 8,
              background: (agentFilter !== 'all' || priorityFilter !== 'all') ? 'rgba(245,166,35,0.15)' : 'rgba(240,237,232,0.04)',
              border: `1px solid ${(agentFilter !== 'all' || priorityFilter !== 'all') ? 'rgba(245,166,35,0.4)' : 'rgba(240,237,232,0.1)'}`,
              color: (agentFilter !== 'all' || priorityFilter !== 'all') ? '#f5a623' : '#94a3b8',
              cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit',
              letterSpacing: '0.05em',
            }}
          >
            <Filter size={13} />
            Filter
            <ChevronDown size={12} style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {filterOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 30,
              background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(240,237,232,0.12)',
              borderRadius: 10, padding: 12, minWidth: 200,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.72rem',
            }}>
              <FilterSelect label="Agent" value={agentFilter} onChange={setAgentFilter}
                options={[{ id: 'all', label: 'All agents' }, ...Object.values(agents).map(a => ({ id: a.id, label: a.name }))]} />
              <FilterSelect label="Priority" value={priorityFilter} onChange={setPriorityFilter}
                options={[
                  { id: 'all', label: 'All priorities' },
                  { id: 'high', label: 'High' },
                  { id: 'medium', label: 'Medium' },
                  { id: 'low', label: 'Low' },
                ]} />
              <FilterSelect label="Sort by" value={sortBy} onChange={(v) => setSortBy(v as any)}
                options={[
                  { id: 'newest', label: 'Newest first' },
                  { id: 'oldest', label: 'Oldest first' },
                  { id: 'priority', label: 'Priority' },
                ]} />
              {(agentFilter !== 'all' || priorityFilter !== 'all' || search) && (
                <button onClick={() => { setAgentFilter('all'); setPriorityFilter('all'); setSearch(''); setFilterOpen(false) }}
                  style={{ marginTop: 4, padding: '6px 10px', background: 'transparent', border: '1px solid rgba(240,237,232,0.15)', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* + New Task */}
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 14px', borderRadius: 8,
            background: 'linear-gradient(90deg, #00e5ff, #f5a623)',
            border: 'none', color: '#04080f', cursor: 'pointer',
            fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            boxShadow: '0 4px 16px rgba(0,229,255,0.2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,229,255,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,229,255,0.2)' }}
        >
          <Plus size={14} /> New Task
        </button>
      </div>

      {/* ── Columns ────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => { setActiveId(null); setOverId(null) }}
      >
        <div style={{
          flex: 1, overflowX: 'auto', overflowY: 'hidden',
          padding: '16px 20px',
          display: 'flex', gap: 14,
          alignItems: 'flex-start',
        }}>
          {COLUMNS.map(col => {
            if (collapsed[col.id] && col.canCollapse) {
              return <CollapsedColumn key={col.id} col={col} count={columns[col.id].length} onExpand={() => setCollapsed(c => ({ ...c, [col.id]: false }))} />
            }
            return (
              <KanbanColumn
                key={col.id}
                col={col}
                tasks={columns[col.id]}
                isOver={overColumn === col.id}
                onOpen={setOpenTaskId}
                onCollapse={col.canCollapse ? () => setCollapsed(c => ({ ...c, [col.id]: true })) : undefined}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeTask ? <KanbanCard task={activeTask} onOpen={() => {}} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Inspector + Create modal */}
      <TaskInspector taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Click-outside filter */}
      {filterOpen && <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 25 }} />}
    </div>
  )
}

// ── Column component ──────────────────────────────────────

function KanbanColumn({ col, tasks, isOver, onOpen, onCollapse }: {
  col: Column
  tasks: TaskState[]
  isOver: boolean
  onOpen: (id: string) => void
  onCollapse?: () => void
}) {
  const { setNodeRef, isOver: droppableOver } = useDroppable({ id: col.id, data: { type: 'column', columnId: col.id } })
  const I = col.icon
  const activeOver = isOver || droppableOver
  return (
    <div ref={setNodeRef} style={{
      width: 290, flexShrink: 0,
      maxHeight: '100%',
      display: 'flex', flexDirection: 'column',
      background: activeOver ? col.accent : 'rgba(240,237,232,0.02)',
      border: `1px solid ${activeOver ? col.color + '80' : 'rgba(240,237,232,0.07)'}`,
      borderRadius: 12,
      padding: 10,
      transition: 'background 0.2s, border-color 0.2s',
      boxShadow: activeOver ? `0 0 20px ${col.color}30` : 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 6px 10px', marginBottom: 4,
        borderBottom: `1px solid ${col.accent}`,
      }}>
        <I size={14} color={col.color} />
        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: col.color }}>
          {col.label}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.7rem', fontWeight: 700, color: col.color,
          background: col.accent,
          padding: '1px 7px', borderRadius: 10,
          minWidth: 22, textAlign: 'center',
        }}>{tasks.length}</span>
        {onCollapse && (
          <button onClick={onCollapse} aria-label="Collapse" style={{
            background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2,
          }}><ChevronDown size={12} /></button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2, minHeight: 80 }}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '24px 10px',
              color: '#3b4a5a', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase',
              border: `1px dashed ${col.accent}`, borderRadius: 8,
            }}>
              Drop tasks here
            </div>
          ) : tasks.map(t => <SortableCard key={t.id} task={t} onOpen={onOpen} />)}
        </SortableContext>
      </div>
    </div>
  )
}

function SortableCard({ task, onOpen }: { task: TaskState; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard task={task} onOpen={onOpen} isDragging={isDragging} />
    </div>
  )
}

function CollapsedColumn({ col, count, onExpand }: { col: Column; count: number; onExpand: () => void }) {
  const I = col.icon
  return (
    <button onClick={onExpand} title={`${col.label} (${count})`} style={{
      width: 44, flexShrink: 0,
      minHeight: 200, maxHeight: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '12px 4px', borderRadius: 12,
      background: 'rgba(240,237,232,0.02)', border: '1px solid rgba(240,237,232,0.07)',
      cursor: 'pointer', color: col.color, fontFamily: 'inherit',
    }}>
      <I size={16} color={col.color} />
      <span style={{
        writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
      }}>{col.label}</span>
      <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{count}</span>
    </button>
  )
}

// ── Small components ──────────────────────────────────────

function FilterSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ id: string; label: string }>
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.15)',
          color: '#f0ede8', padding: '6px 8px', borderRadius: 6, fontSize: '0.7rem',
          fontFamily: 'inherit', cursor: 'pointer',
        }}>
        {options.map(o => <option key={o.id} value={o.id} style={{ background: '#0f172a' }}>{o.label}</option>)}
      </select>
    </label>
  )
}
