const { PrismaClient } = require('@prisma/client');
const { comparePassword, generateToken } = require('../../common/utils/security');
const prisma = new PrismaClient();

const login = async (username, password) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true }
  });

  if (!user || !user.isActive) {
    throw new Error('اسم المستخدم غير صحيح أو الحساب معطل');
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error('كلمة المرور غير صحيحة');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() }
  });

  // Extract permissions
  let permissions = [];
  try {
    permissions = JSON.parse(user.role.permissions);
  } catch (e) {
    permissions = user.role.permissions || [];
  }

  const token = generateToken({ id: user.id, username: user.username, roleId: user.roleId });

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role.name,
      permissions
    },
    token
  };
};

module.exports = { login };
