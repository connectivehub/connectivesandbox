import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL ?? ''

  // The session cookie is SameSite=Strict, so the browser must call the Edge
  // Functions same-origin: the dev/preview server proxies /functions to the
  // Supabase project (production uses an equivalent same-origin rewrite; see
  // AGENTS.md).
  const functionsProxy = supabaseUrl
    ? { '/functions': { target: supabaseUrl, changeOrigin: true, secure: true } }
    : undefined

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: functionsProxy ? { proxy: functionsProxy } : {},
    preview: functionsProxy ? { proxy: functionsProxy } : {},
  }
})
