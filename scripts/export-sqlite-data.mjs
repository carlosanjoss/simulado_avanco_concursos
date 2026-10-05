import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: `file:${path.join(process.cwd(), 'prisma', 'dev.db').replaceAll('\\', '/')}`,
});
const outputDirectory = path.join(process.cwd(), '.migration-data');
await mkdir(outputDirectory, { recursive: true });

try {
  const [users, simulados, tentativas, dailyUsage, auditLogs, feedbacks] = await Promise.all([
    prisma.user.findMany(),
    prisma.simulado.findMany(),
    prisma.tentativa.findMany(),
    prisma.dailyUsage.findMany(),
    prisma.auditLog.findMany(),
    prisma.questionFeedback.findMany(),
  ]);
  const outputPath = path.join(outputDirectory, 'sqlite-export.json');
  await writeFile(outputPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    users,
    simulados,
    tentativas,
    dailyUsage,
    auditLogs,
    feedbacks,
  }, null, 2));
  process.stdout.write(`${JSON.stringify({
    outputPath,
    users: users.length,
    simulados: simulados.length,
    tentativas: tentativas.length,
    dailyUsage: dailyUsage.length,
    auditLogs: auditLogs.length,
    feedbacks: feedbacks.length,
  })}\n`);
} finally {
  await prisma.$disconnect();
}
