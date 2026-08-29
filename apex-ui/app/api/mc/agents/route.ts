import { NextResponse } from 'next/server'

const agents = [
  { key: 'chief', name: 'Hermes Chief', role: 'Orchestrator & Leader', status: 'online', color: '#00e5ff' },
  { key: 'research', name: 'Research', role: 'Research & Learn', status: 'online', color: '#00e5ff' },
  { key: 'programmer', name: 'Programmer', role: 'Programmer & Coder', status: 'online', color: '#f5a623' },
  { key: 'qa', name: 'QA Tester', role: 'Tester & QA', status: 'online', color: '#34d399' },
  { key: 'creator', name: 'Kreator', role: 'Content Creator', status: 'online', color: '#f5a623' },
]

export async function GET() {
  return NextResponse.json({ agents, total: agents.length })
}
