import { NextRequest, NextResponse } from 'next/server'

// In-memory event store for broadcasting
const listeners = new Set<() => void>()
const events: Array<{ type: string; data: any; timestamp: string }> = []

// Simulated agent state
let agentState = {
  chief: { key: 'chief', name: 'Hermes Chief', status: 'online', task: null },
  research: { key: 'research', name: 'Research', status: 'online', task: null },
  programmer: { key: 'programmer', name: 'Programmer', status: 'online', task: null },
  qa: { key: 'qa', name: 'QA Tester', status: 'online', task: null },
  creator: { key: 'creator', name: 'Kreator', status: 'online', task: null },
}

// Broadcast simulation interval
setInterval(() => {
  // Randomly update agent status
  const keys = Object.keys(agentState)
  const randomKey = keys[Math.floor(Math.random() * keys.length)]
  
  const statuses = ['online', 'busy', 'offline'] as const
  const tasks = ['Processing task', 'Running analysis', 'Generating report', 'Testing code', null]
  
  agentState[randomKey].status = statuses[Math.floor(Math.random() * statuses.length)]
  agentState[randomKey].task = tasks[Math.floor(Math.random() * tasks.length)]
  agentState[randomKey].lastUpdate = new Date().toISOString()
  
  // Notify all listeners
  const eventData = { type: 'agent_update', data: agentState, timestamp: new Date().toISOString() }
  events.push(eventData)
  if (events.length > 100) events.shift()
  
  listeners.forEach(cb => cb())
}, 3000)

export async function GET(request: NextRequest) {
  // Set up SSE headers
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  
  const encoder = new TextEncoder()
  
  const sendEvent = (data: any) => {
    const event = `event: message\ndata: ${JSON.stringify(data)}\n\n`
    writer.write(encoder.encode(event))
  }
  
  // Send initial connection event
  sendEvent({ type: 'connected', clientId: request.nextUrl.searchParams.get('id') || 'anonymous' })
  
  // Add listener
  const listener = () => {
    sendEvent({ type: 'agents:update', data: agentState })
  }
  listeners.add(listener)
  
  // Cleanup on client disconnect
  request.signal.addEventListener('abort', () => {
    listeners.delete(listener)
    writer.close()
  })
  
  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  
  switch (body.action) {
    case 'ping':
      return NextResponse.json({ pong: true, timestamp: new Date().toISOString() })
    
    case 'dispatch':
      // Update agent state to busy
      const agent = body.agent || 'chief'
      agentState[agent] = {
        ...agentState[agent],
        status: 'busy',
        task: body.task || 'New task',
        lastUpdate: new Date().toISOString(),
      }
      
      return NextResponse.json({
        dispatched: true,
        agent,
        task: body.task,
        timestamp: new Date().toISOString(),
      })
    
    case 'complete':
      // Mark agent as online again
      const compAgent = body.agent || 'chief'
      agentState[compAgent] = {
        ...agentState[compAgent],
        status: 'online',
        task: null,
        lastUpdate: new Date().toISOString(),
      }
      
      return NextResponse.json({
        completed: true,
        agent: compAgent,
        timestamp: new Date().toISOString(),
      })
    
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
