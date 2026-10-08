import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { resolve4 } from 'node:dns/promises'
import net from 'node:net'

const source = await readFile('.env.local', 'utf8')
const values = {}
for (const line of source.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (!match) continue
  let value = match[2].trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
  values[match[1]] = value
}

const connectionString = values.SUPABASE_DATABASE_URL || values.DIRECT_URL || values.DATABASE_URL
if (!connectionString) throw new Error('Conexão PostgreSQL não configurada')
async function connectDatabase() {
  const original = new URL(connectionString)
  const candidates = await resolve4(original.hostname).catch(() => [])
  if (!candidates.length) candidates.push(null)
  let lastError
  for (const address of [...new Set(candidates)]) {
    const stream = address ? () => {
      const socket = new net.Socket()
      socket.connect = function connect(port) { return net.Socket.prototype.connect.call(this, port, address) }
      return socket
    } : undefined
    const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12_000, stream })
    try { await db.connect(); return db } catch (error) { lastError = error; await db.end().catch(() => undefined) }
  }
  throw lastError
}
const client = await connectDatabase()

try {
  const tables = (await client.query(`
    select
      to_regclass('public._avanco_migrations') is not null as migrations,
      to_regclass('public."User"') is not null as users,
      to_regclass('public.simulado_documents') is not null as documents
  `)).rows[0]
  const migrations = tables.migrations
    ? (await client.query('select name from public._avanco_migrations order by name')).rows.map((row) => row.name)
    : []
  const columns = tables.users
    ? (await client.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'User' order by ordinal_position`)).rows.map((row) => row.column_name)
    : []
  process.stdout.write(`${JSON.stringify({ tables, migrations, columns })}\n`)
} finally {
  await client.end()
}
