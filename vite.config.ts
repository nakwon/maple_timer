import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages는 https://nakwon.github.io/maple_timer/ 아래에서 서빙됨
  base: '/maple_timer/',
  plugins: [react()],
})
