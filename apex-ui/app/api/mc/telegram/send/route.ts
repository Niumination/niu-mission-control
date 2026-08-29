import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { message, chat_id, topic = '1' } = body
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }
    
    // In production, this would call Hermes gateway
    const response = {
      sent: true,
      message_id: `msg_${Date.now()}`,
      chat_id: chat_id || topic,
      timestamp: new Date().toISOString(),
    }
    
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send message', details: String(error) },
      { status: 500 }
    )
  }
}
