import { readFile, writeFile } from 'node:fs/promises';

const envPath = '.env.local';
const lines = (await readFile(envPath, 'utf8')).split(/\r?\n/);
const sourceLine = lines.findLast((line) => /^SUPABASE_DATABASE_URL=/.test(line));
if (!sourceLine) throw new Error('SUPABASE_DATABASE_URL não encontrada.');
const connection = sourceLine.slice(sourceLine.indexOf('=') + 1).trim();
const unquotedConnection = connection.replace(/^(["'])(.*)\1$/, '$2');
const runtimeUrl = new URL(unquotedConnection);
runtimeUrl.searchParams.set('pgbouncer', 'true');
runtimeUrl.searchParams.set('connection_limit', '1');
const quote = connection.startsWith('"') ? '"' : connection.startsWith("'") ? "'" : '';
const runtimeConnection = `${quote}${runtimeUrl.toString()}${quote}`;
const retained = lines.filter((line) => !/^(DATABASE_URL|DIRECT_URL)=/.test(line));
const sourceIndex = retained.findIndex((line) => /^SUPABASE_DATABASE_URL=/.test(line));
retained.splice(sourceIndex + 1, 0, `DIRECT_URL=${connection}`, `DATABASE_URL=${runtimeConnection}`);
await writeFile(envPath, retained.join('\n'), 'utf8');
process.stdout.write('Prisma configurado para PostgreSQL/Supabase.\n');
