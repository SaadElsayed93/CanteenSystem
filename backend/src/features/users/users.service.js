const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../../common/utils/security');
const prisma = new PrismaClient();

const getAllUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      isActive: true,
      lastLogin: true,
      role: { select: { id: true, name: true } }
    }
  });
};

const createUser = async (data) => {
  const { username, password, fullName, roleId } = data;
  
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new Error('اسم المستخدم موجود بالفعل');

  const passwordHash = await hashPassword(password);
  
  return prisma.user.create({
    data: {
      username,
      passwordHash,
      fullName,
      roleId
    },
    select: { id: true, username: true, fullName: true }
  });
};

const updateUser = async (id, data, adminId) => {
  const userId = Number(id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('المستخدم غير موجود');

  const { username, fullName, roleId, isActive } = data;

  if (username && username !== user.username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw new Error('اسم المستخدم مستخدم بالفعل');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      username: username !== undefined ? username : user.username,
      fullName: fullName !== undefined ? fullName : user.fullName,
      roleId: roleId !== undefined ? Number(roleId) : user.roleId,
      isActive: isActive !== undefined ? Boolean(isActive) : user.isActive
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      isActive: true,
      role: { select: { id: true, name: true } }
    }
  });

  if (adminId) {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'USER',
          entityId: userId,
          newValues: JSON.stringify({
            'الاسم': updated.fullName,
            'اسم الدخول': updated.username,
            'الوظيفة': updated.role?.name,
            'الحالة': updated.isActive ? 'نشط' : 'معطل'
          }),
          userId: adminId
        }
      });
    } catch (e) {
      console.error('AuditLog error in updateUser:', e);
    }
  }

  return updated;
};

const resetPassword = async (id, newPassword, adminId) => {
  const userId = Number(id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('المستخدم غير موجود');

  if (!newPassword || newPassword.length < 6) {
    throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  if (adminId) {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'RESET_PASSWORD',
          entityType: 'USER',
          entityId: userId,
          newValues: JSON.stringify({
            'البيان': `إعادة تعيين كلمة المرور للمستخدم (${user.fullName || user.username})`
          }),
          userId: adminId
        }
      });
    } catch (e) {
      console.error('AuditLog error in resetPassword:', e);
    }
  }

  return { id: userId, username: user.username, message: 'تم تغيير كلمة المرور بنجاح' };
};

const toggleUserStatus = async (id, isActive) => {
  return prisma.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, username: true, isActive: true }
  });
};

const getRoles = async () => {
  return prisma.role.findMany();
};

module.exports = { getAllUsers, createUser, updateUser, resetPassword, toggleUserStatus, getRoles };
