import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { resolve4 } from 'node:dns/promises';
import net from 'node:net';
import pg from 'pg';

const { Client } = pg;
const root = process.cwd();

function parseEnv(contents) {
  return contents.split(/\r?\n/).reduce((entries, line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[2] === '') return entries;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    (entries[match[1]] ||= []).push(value);
    return entries;
  }, {});
}

const env = parseEnv(await readFile(path.join(root, '.env.local'), 'utf8'));
const connectionString = [...(env.SUPABASE_DATABASE_URL || []), ...(env.DATABASE_URL || [])]
  .reverse()
  .find((value) => /^postgres(?:ql)?:\/\//i.test(value));

if (!connectionString) {
  throw new Error('Nenhuma URL PostgreSQL do Supabase foi encontrada em .env.local.');
}

const parsedConnection = new URL(connectionString);
const databasePassword = decodeURIComponent(parsedConnection.password);
if (!databasePassword || /password|senha|your|\[|\]/i.test(databasePassword)) {
  throw new Error('SUPABASE_DATABASE_URL ainda contém uma senha de exemplo. Copie a connection string real em Supabase > Connect.');
}

const migrationDirectory = path.join(root, 'supabase', 'migrations');
const migrations = (await readdir(migrationDirectory))
  .filter((file) => file.endsWith('.sql'))
  .sort((left, right) => left.localeCompare(right));

async function connectDatabase() {
  const original = new URL(connectionString);
  const candidates = await resolve4(original.hostname).catch(() => []);
  if (!candidates.length) candidates.push(null);
  let lastError;
  for (const address of [...new Set(candidates)]) {
    const stream = address ? () => {
      const socket = new net.Socket();
      socket.connect = function connect(port) { return net.Socket.prototype.connect.call(this, port, address); };
      return socket;
    } : undefined;
    const db = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12_000, stream });
    try {
      await db.connect();
      return db;
    } catch (error) {
      lastError = error;
      await db.end().catch(() => undefined);
    }
  }
  throw lastError;
}

const client = await connectDatabase();

try {
  await client.query(`
    create table if not exists public._avanco_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  for (const migration of migrations) {
    const applied = await client.query(
      'select 1 from public._avanco_migrations where name = $1',
      [migration],
    );
    if (applied.rowCount) {
      process.stdout.write(`Já aplicada: ${migration}\n`);
      continue;
    }
    const sql = await readFile(path.join(migrationDirectory, migration), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into public._avanco_migrations (name) values ($1)', [migration]);
      await client.query('commit');
      process.stdout.write(`Aplicada: ${migration}\n`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }

  const result = await client.query(`
    select
      to_regclass('public.simulado_documents') is not null as documents,
      to_regclass('public.simulado_batches') is not null as batches,
      to_regclass('public.simulado_chunks') is not null as chunks
  `);
  process.stdout.write(`Schema verificado: ${JSON.stringify(result.rows[0])}\n`);
} finally {
  await client.end().catch(() => undefined);
}
