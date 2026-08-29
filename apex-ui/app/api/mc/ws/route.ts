import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // WebSocket simulation endpoint
  // In production, use a dedicated WebSocket server
  return NextResponse.json({
    status: 'simulation',
    message: 'WebSocket simulation endpoint',
    note: 'For real-time updates, use the SSE endpoint at /api/mc/ws/sse',
    clientId: request.nextUrl.searchParams.get('id') || 'anonymous',
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  
  switch (body.action) {
    case 'ping':
      return NextResponse.json({ pong: true, timestamp: new Date().toISOString() })
    
    case 'subscribe':
      return NextResponse.json({ 
        subscribed: true, 
        clientId: body.clientId || `sub_${Date.now()}` 
      })
    
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
