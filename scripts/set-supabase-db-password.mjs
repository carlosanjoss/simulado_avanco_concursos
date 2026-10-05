import { readFile, writeFile } from 'node:fs/promises';

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) throw new Error('Defina SUPABASE_DB_PASSWORD somente durante esta execução.');

const envPath = '.env.local';
const lines = (await readFile(envPath, 'utf8')).split(/\r?\n/);
const postgresLines = lines.filter((line) => /^(?:DATABASE_URL|SUPABASE_DATABASE_URL)=/.test(line))
  .map((line) => line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''))
  .filter((value) => value && /^postgres(?:ql)?:\/\//i.test(value));
const template = postgresLines.at(-1);
if (!template) throw new Error('Connection string PostgreSQL não encontrada.');

const credentialsStart = template.indexOf('://') + 3;
const passwordStart = template.indexOf(':', credentialsStart);
const credentialsEnd = template.lastIndexOf('@');
if (passwordStart < credentialsStart || credentialsEnd < passwordStart) {
  throw new Error('Formato da connection string não reconhecido.');
}
const withPassword = `${template.slice(0, passwordStart + 1)}${encodeURIComponent(password)}${template.slice(credentialsEnd)}`;

const retained = lines.filter((line) => {
  if (/^SUPABASE_DATABASE_URL=/.test(line)) return false;
  if (!/^DATABASE_URL=/.test(line)) return true;
  const value = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  return !value || !/^postgres(?:ql)?:\/\//i.test(value);
});
const sqliteIndex = retained.findIndex((line) => /^DATABASE_URL=/.test(line));
const insertAt = sqliteIndex >= 0 ? sqliteIndex + 1 : retained.length;
retained.splice(insertAt, 0, `SUPABASE_DATABASE_URL="${withPassword}"`);
await writeFile(envPath, retained.join('\n'), 'utf8');
process.stdout.write('SUPABASE_DATABASE_URL atualizada sem alterar o DATABASE_URL do Prisma.\n');
