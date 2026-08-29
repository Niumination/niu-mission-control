import { NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

interface HermesSession {
  id: string
  name: string
  created_at: string
  updated_at: string
  message_count: number
  agent?: string
  provider?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '20')
  
  try {
    const hermesDir = process.env.HERMES_HOME || join(process.env.HOME || '', '.hermes')
    const sessionsDir = join(hermesDir, 'sessions')
    
    if (!existsSync(sessionsDir)) {
      return NextResponse.json({ 
        error: 'Hermes sessions directory not found',
        path: sessionsDir
      }, { status: 404 })
    }
    
    const files = readdirSync(sessionsDir)
      .filter(f => f.endsWith('.json'))
      .slice(-limit)
      .reverse()
    
    const sessions: HermesSession[] = []
    
    for (const file of files) {
      try {
        const filePath = join(sessionsDir, file)
        const data = JSON.parse(readFileSync(filePath, 'utf-8'))
        
        sessions.push({
          id: data.session_id || file.replace('.json', ''),
          name: data.session_name || file,
          created_at: data.timestamp || new Date().toISOString(),
          updated_at: data.timestamp || new Date().toISOString(),
          message_count: data.messages?.length || 0,
          agent: data.metadata?.agent,
          provider: data.metadata?.provider,
        })
      } catch (e) {
        continue
      }
    }
    
    return NextResponse.json({ sessions, total: sessions.length })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read Hermes sessions', details: String(error) },
      { status: 500 }
    )
  }
}
