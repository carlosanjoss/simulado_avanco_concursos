import { stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

const input = process.argv[2]
if (!input) throw new Error('Uso: npm run db:backup:verify -- backups/arquivo.dump')
const absolute = path.resolve(input)
const info = await stat(absolute)
if (!info.isFile() || info.size < 1024) throw new Error('Arquivo de backup ausente ou pequeno demais.')
await new Promise((resolve, reject) => {
  const child = spawn(process.env.PG_RESTORE_PATH || 'pg_restore', ['--list', absolute], { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true })
  child.on('error', (error) => reject(new Error(`Não foi possível executar pg_restore: ${error.message}`)))
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_restore terminou com código ${code}`)))
})
process.stdout.write(`Backup válido: ${absolute} (${info.size} bytes)\n`)
