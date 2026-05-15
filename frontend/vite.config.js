import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function resolveManualChunk(id) {
  if (!id.includes('node_modules')) {
    return undefined
  }

  if (
    id.includes('/react/') ||
    id.includes('\\react\\') ||
    id.includes('react-dom') ||
    id.includes('scheduler')
  ) {
    return 'react-vendor'
  }

  if (
    id.includes('@rainbow-me') ||
    id.includes('wagmi') ||
    id.includes('viem') ||
    id.includes('@walletconnect') ||
    id.includes('@coinbase') ||
    id.includes('@base-org') ||
    id.includes('@reown') ||
    id.includes('/ox/') ||
    id.includes('\\ox\\') ||
    id.includes('qrcode') ||
    id.includes('valtio') ||
    id.includes('@tanstack')
  ) {
    return 'wallet-vendor'
  }

  if (id.includes('framer-motion')) {
    return 'motion-vendor'
  }

  if (id.includes('react-icons') || id.includes('lucide-react')) {
    return 'icon-vendor'
  }

  if (id.includes('graphql-request') || id.includes('/graphql/') || id.includes('\\graphql\\')) {
    return 'graphql-vendor'
  }

  return 'vendor'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_PROXY || 'http://localhost:5000',
          changeOrigin: true
        }
      }
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: resolveManualChunk
        }
      }
    }
  }
})
