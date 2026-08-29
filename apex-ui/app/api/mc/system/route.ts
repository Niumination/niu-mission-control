import { NextResponse } from 'next/server'

export async function GET() {
  // Mock data - nanti ganti dengan real system metrics
  const data = {
    uptime: process.uptime(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    cpu: {
      loadavg: process.cpuUsage(),
    },
    platform: process.platform,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  }
  
  return NextResponse.json(data)
}
