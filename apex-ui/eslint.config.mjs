import nextPlugin from '@next/eslint-plugin-next'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

// Flat config untuk Next.js 16.
// `next lint` sudah DIHAPUS di Next 16 dan ESLint v9 memakai flat config,
// jadi .eslintrc.json tidak lagi dibaca. Setara dengan {"extends":"next/core-web-vitals"}
// + plugin react-hooks yang v4 sudah expose lewat flat preset.
export default [
  {
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'next-env.d.ts',
      '**/*.tsbuildinfo',
    ],
  },
]
