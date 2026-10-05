import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

function parseEnv(source) {
  return source.split(/\r?\n/).reduce((result, line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) return result;
    result[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    return result;
  }, {});
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
if (!env.DATABASE_URL?.startsWith('postgres')) throw new Error('DATABASE_URL PostgreSQL não configurada.');
const snapshot = JSON.parse(await readFile(path.join('.migration-data', 'sqlite-export.json'), 'utf8'));
const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
const dates = (record) => Object.fromEntries(Object.entries(record).map(([key, value]) =>
  (key.endsWith('At') || key === 'concluidoEm' || key === 'deletedAt') && value
    ? [key, new Date(value)]
    : [key, value],
));

try {
  for (const record of snapshot.users) {
    const data = dates(record);
    await prisma.user.upsert({ where: { id: record.id }, create: data, update: data });
  }
  for (const record of snapshot.simulados) {
    const data = dates(record);
    await prisma.simulado.upsert({ where: { id: record.id }, create: data, update: data });
  }
  for (const record of snapshot.tentativas) {
    const data = dates(record);
    await prisma.tentativa.upsert({ where: { id: record.id }, create: data, update: data });
  }
  const monthly = new Map();
  for (const record of snapshot.dailyUsage) {
    const monthKey = record.dateKey.slice(0, 7);
    const key = `${record.userId}:${monthKey}`;
    const current = monthly.get(key);
    monthly.set(key, current
      ? { ...current, count: current.count + record.count, updatedAt: new Date(record.updatedAt) }
      : { ...dates(record), monthKey });
  }
  for (const record of monthly.values()) {
    const { dateKey: _dateKey, ...data } = record;
    await prisma.monthlyUsage.upsert({
      where: { userId_monthKey: { userId: data.userId, monthKey: data.monthKey } },
      create: data,
      update: { count: data.count, updatedAt: data.updatedAt },
    });
  }
  for (const record of snapshot.auditLogs) {
    const data = dates(record);
    await prisma.auditLog.upsert({ where: { id: record.id }, create: data, update: data });
  }
  for (const record of snapshot.feedbacks) {
    const data = dates(record);
    await prisma.questionFeedback.upsert({ where: { id: record.id }, create: data, update: data });
  }

  const [users, simulados, tentativas, monthlyUsage, auditLogs, feedbacks] = await Promise.all([
    prisma.user.count(), prisma.simulado.count(), prisma.tentativa.count(),
    prisma.monthlyUsage.count(), prisma.auditLog.count(), prisma.questionFeedback.count(),
  ]);
  process.stdout.write(`${JSON.stringify({ users, simulados, tentativas, monthlyUsage, auditLogs, feedbacks })}\n`);
} finally {
  await prisma.$disconnect();
}
