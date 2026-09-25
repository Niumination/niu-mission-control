'use client'

/**
 * (app) group layout — wraps semua halaman terproteksi (setelah login) dengan AppShell.
 * - Memasang ToastViewport di root shell
 * - Menyalakan SSE event stream sekali di sini (bukan per-page), sehingga Zustand stores
 *   ter-populate dari mana saja user bernavigasi
 * - ErrorBoundary per shell untuk tangkap error tanpa crash seluruh app
 */

import AppShell from '@/components/shell/AppShell'
import { ToastViewport } from '@/components/ui/Toast'
import { useEventStream } from '@/lib/client/sse'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // SSE lifecycle terhubung sekali di shell — stores available ke semua page
  useEventStream()

  return (
    <ErrorBoundary>
      <AppShell>{children}</AppShell>
      <ToastViewport />
    </ErrorBoundary>
  )
}
