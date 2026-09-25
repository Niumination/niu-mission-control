/**
 * Next.js Instrumentation Hook.
 *
 * Pola yang bekerja dengan webpack tree-shaking Next.js:
 * - Branch `if (process.env.NEXT_RUNTIME === 'nodejs')` akan dipertahankan
 *   HANYA di server bundle. Di edge/client bundle, webpack akan
 *   menghapus seluruh isi branch ini (dead-code elimination), sehingga
 *   static import ke lib/server/bootstrap (yang menarik fs/crypto/...)
 *   TIDAK akan muncul di bundle edge/client.
 *
 * Ini adalah pola resmi Next.js untuk instrumentation dengan Node-only code.
 */

export const runtime = 'nodejs'

export async function register() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Branch ini hanya akan di-bundle untuk server Node.js.
    // webpack TIDAK akan memasukkan ini ke edge/client karena
    // process.env.NEXT_RUNTIME diganti menjadi konstanta saat compile.
    const { register: registerBootstrap } = await import('./lib/server/bootstrap.node')
    await registerBootstrap()
  }
}
