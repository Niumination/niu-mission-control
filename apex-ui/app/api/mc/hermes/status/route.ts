import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const status = {
      hermes_home: process.env.HERMES_HOME || process.env.HOME + '/.hermes',
      uptime: process.uptime(),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
      features: {
        gateway: 'running',
        skills: 'enabled',
        sessions: 'active',
        cron: 'enabled',
      },
    }
    
    return NextResponse.json(status)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get status', details: String(error) },
      { status: 500 }
    )
  }
}
