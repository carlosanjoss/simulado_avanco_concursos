import { defineConfig } from 'vite'
import path from 'node:path'

// Config usada só para rodar scripts de servidor (src/lib/*) fora do Next.
// O pacote "server-only" só existe no bundle do Next, então é substituído por um stub.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^server-only$/,
        replacement: path.resolve(process.cwd(), 'scripts/server-only-stub.ts'),
      },
    ],
  },
})
