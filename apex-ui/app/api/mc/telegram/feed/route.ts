import { NextResponse } from 'next/server'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

interface TelegramMessage {
  id: string
  chat_id: string
  message: string
  timestamp: string
  type: 'incoming' | 'outgoing'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  
  try {
    const hermesDir = process.env.HERMES_HOME || join(process.env.HOME || '', '.hermes')
    const logsDir = join(hermesDir, 'logs')
    
    if (!existsSync(logsDir)) {
      return NextResponse.json({ messages: [], total: 0 })
    }
    
    const messages: TelegramMessage[] = []
    
    const logFiles = readdirSync(logsDir)
      .filter(f => f.includes('telegram') || f.includes('gateway') || f.endsWith('.log'))
      .slice(-10)
      .reverse()
    
    for (const file of logFiles) {
      const filePath = join(logsDir, file)
      try {
        const content = readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        
        for (const line of lines) {
          const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/)
          const messageMatch = line.match(/message:\s*"([^"]+)"/)
          const chatMatch = line.match(/chat_id[:\s]+(\d+)/)
          
          if (messageMatch || timestampMatch) {
            messages.push({
              id: `${Date.now()}_${Math.random()}`,
              chat_id: chatMatch?.[1] || 'unknown',
              message: messageMatch?.[1]?.slice(0, 200) || line.slice(-150),
              timestamp: timestampMatch?.[1] || new Date().toISOString(),
              type: 'incoming',
            })
          }
        }
      } catch (e) {
        continue
      }
    }
    
    return NextResponse.json({ 
      messages: messages.slice(-limit).reverse(),
      total: messages.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read Telegram feed', details: String(error) },
      { status: 500 }
    )
  }
}
