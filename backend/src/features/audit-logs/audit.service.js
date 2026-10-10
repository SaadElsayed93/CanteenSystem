const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAuditLogs = async (page = 1, limit = 50) => {
  const skip = (page - 1) * limit;
  
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: {
        user: {
          select: { fullName: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.auditLog.count()
  ]);

  return {
    data: logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};
