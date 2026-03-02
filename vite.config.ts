import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'

export default defineConfig({
  server: {
    host: '127.0.0.1',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    electron({
      main: {
        entry: 'src/main/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
          },
        },
      },
      preload: {
        input: 'src/preload/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
          },
        },
      },
    }),
    renderer(),
  ],
})
