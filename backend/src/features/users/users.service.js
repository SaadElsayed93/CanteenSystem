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

module.exports = { getAllUsers, createUser, toggleUserStatus, getRoles };
