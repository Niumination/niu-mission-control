import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone output untuk Docker/self-hosted
  output: 'standalone',

  // Native modules
  serverExternalPackages: ['better-sqlite3', 'server-only'],

  reactStrictMode: true,
  poweredByHeader: false,

  // Turbopack config (Next 16 default) — keep empty to allow webpack fallback
  // Our custom webpack fallback still needed for client bundle (fs etc)
  turbopack: {},

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
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'fs',
        'path',
        'crypto',
        'child_process',
        'os',
        'cluster',
        'net',
        'tls',
        'dns',
        'stream',
        'util',
        'http',
        'https',
        'url',
        'zlib',
        'assert',
        'better-sqlite3',
      ]
    }
    return config
  },

  async rewrites() {
    return [
      // API v1 alias — /api/v1/mc/* → /api/mc/* (backward compat + gold standard)
      { source: '/api/v1/mc/:path*', destination: '/api/mc/:path*' },
      { source: '/api/v1/health', destination: '/api/mc/health' },
    ]
  },

  async headers() {
    return [
      {
        source: '/api/v1/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // CSP report-only (Fase 1 — pantau 2-4 minggu, lalu enforcement)
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.github.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              'report-uri /api/csp-report',
            ].join('; '),
          },
        ],
      },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.open-meteo.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
}

export default nextConfig
