import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
