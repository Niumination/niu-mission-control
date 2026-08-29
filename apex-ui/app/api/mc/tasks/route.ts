import { NextResponse } from 'next/server'

// Mock tasks - nanti connect ke Hermes task system
const tasks = {
  pending: [
    { id: 't1', title: 'Review PR #10', agent: 'qa', priority: 'high', created: '2026-08-29T10:00:00Z' },
    { id: 't2', title: 'Update docs', agent: 'creator', priority: 'medium', created: '2026-08-29T09:30:00Z' },
  ],
  running: [
    { id: 't3', title: 'Refactor MC v3', agent: 'programmer', priority: 'high', created: '2026-08-29T08:00:00Z', progress: 75 },
  ],
  completed: [
    { id: 't4', title: 'Deploy LaunchAgent', agent: 'programmer', priority: 'medium', completed: '2026-08-29T07:00:00Z' },
  ],
  failed: [],
}

export async function GET() {
  return NextResponse.json(tasks)
}
