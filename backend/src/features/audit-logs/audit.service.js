const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAuditLogs = async () => {
  const logs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: { fullName: true, username: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100 // Last 100 actions
  });
  return logs;
};
