import { NextResponse } from 'next/server'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const hermesDir = process.env.HERMES_HOME || join(process.env.HOME || '', '.hermes')
    const skillsDir = join(hermesDir, 'skills')
    
    if (!existsSync(skillsDir)) {
      return NextResponse.json({ skills: [], total: 0 })
    }
    
    const skills = []
    const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
    
    for (const skillName of skillDirs) {
      const skillFile = join(skillsDir, skillName, 'SKILL.md')
      if (existsSync(skillFile)) {
        try {
          const content = require('fs').readFileSync(skillFile, 'utf-8')
          const descMatch = content.match(/description:\s*(.+)$/m)
          
          skills.push({
            name: skillName,
            path: skillFile,
            description: descMatch?.[1]?.trim(),
          })
        } catch (e) {
          skills.push({ name: skillName, path: skillFile })
        }
      }
    }
    
    return NextResponse.json({ skills, total: skills.length })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read Hermes skills', details: String(error) },
      { status: 500 }
    )
  }
}
