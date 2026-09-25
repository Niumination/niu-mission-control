#!/usr/bin/env node
/**
 * A11y audit via axe-core + Playwright — gold standard Niu-OSS-Dashboard pattern
 * 7 routes, tag wcag2x+22aa including target-size, serious/critical = fail
 */
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const ROUTES = ['/', '/missions', '/agents', '/live-ops', '/analytics', '/audit', '/settings']

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  // Login first
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="password"]', process.env.MC_PASSWORD || 'apex')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2000)

  let failed = 0
  for (const route of ROUTES) {
    console.log(`\n=== A11y ${route} ===`)
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    try {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()

      const serious = results.violations.filter(v => ['serious', 'critical'].includes(v.impact))
      const minor = results.violations.filter(v => !['serious', 'critical'].includes(v.impact))

      if (serious.length > 0) {
        console.log(`  ✗ ${serious.length} serious/critical violations`)
        serious.forEach(v => console.log(`    - ${v.id}: ${v.description} (${v.impact})`))
        failed++
      } else {
        console.log(`  ✓ 0 serious/critical, ${minor.length} minor warnings`)
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`)
      failed++
    }
  }

  await browser.close()
  console.log(`\n=== Result: ${ROUTES.length - failed}/${ROUTES.length} passed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
