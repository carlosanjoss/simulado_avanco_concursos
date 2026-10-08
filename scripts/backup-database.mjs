import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

const connectionString = process.env.DIRECT_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error('Configure DIRECT_URL, SUPABASE_DATABASE_URL ou DATABASE_URL.')
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const directory = path.resolve(process.env.BACKUP_DIRECTORY || 'backups')
await mkdir(directory, { recursive: true })
const output = path.join(directory, `avanco_${stamp}.dump`)

await new Promise((resolve, reject) => {
  const child = spawn(process.env.PG_DUMP_PATH || 'pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', output, connectionString], { stdio: 'inherit', windowsHide: true })
  child.on('error', (error) => reject(new Error(`Não foi possível executar pg_dump: ${error.message}`)))
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_dump terminou com código ${code}`)))
})
process.stdout.write(`Backup criado em ${output}\n`)
