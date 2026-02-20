import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify(process.env.NEXT_PUBLIC_API_BASE_URL),
    "process.env.NEXT_PUBLIC_API_KEY": JSON.stringify(process.env.NEXT_PUBLIC_API_KEY),
  },
})
