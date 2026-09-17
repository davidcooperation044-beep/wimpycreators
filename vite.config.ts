import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { apiMiddleware } from './vite-api-middleware.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), { name: 'wimpycreators-api', configureServer: (server) => { server.middlewares.use(apiMiddleware()) } }],
  }
})
