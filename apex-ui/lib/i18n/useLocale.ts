'use client'
import { useState, useEffect } from 'react'
import type { Locale } from './dict'

const STORAGE_KEY = 'mc:locale'

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>('id')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale
    if (saved && (saved === 'id' || saved === 'en')) {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(STORAGE_KEY, l)
    document.documentElement.lang = l
  }

  return { locale, setLocale }
}
