import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { SYSTEM_NAME, SYSTEM_SHORT_NAME, APP_SLUG, BUNDLE_ID, APP_DESCRIPTION, APP_AUTHOR, APP_URL, APP_KEYWORDS } from '../shared/constants/app.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5000';
  const apiProxyTimeoutMs = Number(env.VITE_API_PROXY_TIMEOUT_MS || 120000);

  return {
  plugins: [
    react(),
    {
      name: 'html-template-replacement',
      transformIndexHtml(html) {
        return html
          .replace(/%SYSTEM_NAME%/g, SYSTEM_NAME)
          .replace(/%SYSTEM_SHORT_NAME%/g, SYSTEM_SHORT_NAME)
          .replace(/%APP_SLUG%/g, APP_SLUG)
          .replace(/%BUNDLE_ID%/g, BUNDLE_ID)
          .replace(/%APP_DESCRIPTION%/g, APP_DESCRIPTION)
          .replace(/%APP_AUTHOR%/g, APP_AUTHOR)
          .replace(/%APP_URL%/g, APP_URL)
          .replace(/%APP_KEYWORDS%/g, APP_KEYWORDS.join(', '));
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
    dedupe: ['axios', 'react', 'react-dom'],
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        timeout: apiProxyTimeoutMs,
        proxyTimeout: apiProxyTimeoutMs,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router-dom')) return 'router';
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('leaflet') || id.includes('react-leaflet') || id.includes('supercluster')) return 'maps';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('framer-motion') || id.includes('lucide-react')) return 'ui-motion';
          return 'vendor';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@radix-ui/react-checkbox', '@radix-ui/react-switch', 'lucide-react', 'axios'],
  },
  };
})
