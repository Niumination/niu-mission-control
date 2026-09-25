/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output untuk Docker/self-hosted (lebih kecil, mudah dideploy)
  output: 'standalone',

  // Package native/Node-only yang tidak perlu di-bundle oleh webpack
  // untuk edge/client runtime.
  serverExternalPackages: [
    'better-sqlite3',
    'server-only',
  ],

  // Webpack config.
  // Di Next.js, instrumentation.ts di-kompilasi oleh webpack untuk BEBERAPA
  // target sekaligus (server, edge, client). Kita harus memberitahu webpack
  // untuk TIDAK me-resolve Node.js native modules di chunk yang bukan server.
  // Pola yang bekerja: tambahkan native modules ke config.externals untuk
  // build non-server, dan pasang fallback = false.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        child_process: false,
        net: false,
        tls: false,
        dns: false,
        cluster: false,
        os: false,
        stream: false,
        util: false,
        http: false,
        https: false,
        url: false,
        zlib: false,
        assert: false,
        buffer: false,
        process: false,
        worker_threads: false,
        perf_hooks: false,
        module: false,
      }
      // Tandai modul native sebagai external agar require() di-runtime
      // tidak error bila tidak sengaja masuk ke client bundle (tidak akan
      // dieksekusi karena runtime guard).
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'fs', 'path', 'crypto', 'child_process', 'os', 'cluster', 'net', 'tls',
        'dns', 'stream', 'util', 'http', 'https', 'url', 'zlib', 'assert',
        'better-sqlite3',
      ]
    }
    return config
  },

  // Strict React mode untuk dev (menangkap double-effect bug)
  reactStrictMode: true,

  // Keamanan: headers dasar
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ]
  },

  // ESLint: tetap izinkan build jika ada warning (sebelumnya hanya ReasoningWeb)
  // agar tidak block M1 — akan dibersihkan bertahap.
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // Gambar: hanya izinkan domain yang kita pakai
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.open-meteo.com' },
    ],
  },
}

export default nextConfig
