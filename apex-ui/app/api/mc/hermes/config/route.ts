import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const hermesDir = process.env.HERMES_HOME || join(process.env.HOME || '', '.hermes')
    const configFile = join(hermesDir, 'config.yaml')
    
    if (!existsSync(configFile)) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }
    
    const content = readFileSync(configFile, 'utf-8')
    
    // Simple YAML parsing
    const config: Record<string, any> = {}
    const lines = content.split('\n')
    let currentSection = ''
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      
      if (line.startsWith('  ') && !line.startsWith('    ')) {
        const [key, ...valueParts] = trimmed.split(':')
        if (key && valueParts.length) {
          config[`${currentSection}.${key.trim()}`] = valueParts.join(':').trim()
        }
      } else if (!line.startsWith(' ') && trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':')
        currentSection = key.trim()
        if (valueParts.length) {
          config[currentSection] = valueParts.join(':').trim()
        }
      }
    }
    
    return NextResponse.json({ config, source: configFile })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read config', details: String(error) },
      { status: 500 }
    )
  }
}
