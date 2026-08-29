import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const hermesDir = process.env.HERMES_HOME || join(process.env.HOME || '', '.hermes')
    const socketPath = join(hermesDir, 'gateway.sock')
    const pidPath = join(hermesDir, 'gateway.pid')
    
    const isConnected = existsSync(socketPath)
    const isRunning = existsSync(pidPath)
    
    return NextResponse.json({
      connected: isConnected,
      running: isRunning,
      socket_exists: isConnected,
      pid_exists: isRunning,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get Telegram status', details: String(error) },
      { status: 500 }
    )
  }
}
