import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CRITICAL: Allows app to run in subfolders on NAS/Localhost
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})