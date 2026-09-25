'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/lib/i18n/useLocale'
import { dict } from '@/lib/i18n/dict'

const titleMap: Record<string, keyof typeof dict.id> = {
  '/': 'title_overview',
  '/missions': 'title_missions',
  '/agents': 'title_agents',
  '/live-ops': 'title_liveops',
  '/analytics': 'title_analytics',
  '/audit': 'title_audit',
  '/settings': 'title_settings',
  '/login': 'title_login',
}

export default function TitleSync() {
  const pathname = usePathname()
  const { locale } = useLocale()

  useEffect(() => {
    const key = titleMap[pathname] || 'title_overview'
    const title = dict[locale][key] || dict.en[key]
    document.title = title
  }, [pathname, locale])

  return null
}
