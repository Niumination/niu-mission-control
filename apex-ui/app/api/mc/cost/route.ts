import { NextResponse } from 'next/server'

// Mock cost data - nanti connect ke Hermes cost tracker
const data = {
  today: { total: 0.45, agents: { chief: 0.12, research: 0.08, programmer: 0.15, qa: 0.05, creator: 0.05 } },
  week: { total: 2.34, trend: '+12%' },
  month: { total: 8.92, trend: '-5%' },
}

export async function GET() {
  return NextResponse.json(data)
}
