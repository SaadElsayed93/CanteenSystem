const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const usersService = require('../src/features/users/users.service');
const { comparePassword } = require('../src/common/utils/security');

async function runStage2Tests() {
  console.log('🧪 Starting Stage 2 Automated Tests (User Security, Password Reset & Audit)...');

  try {
    // 1. Find an existing user or create a temporary one
    let testUser = await prisma.user.findFirst({ where: { username: 'test_sec_user' } });
    const admin = await prisma.user.findFirst();
    const adminId = admin?.id || 1;
    const role = await prisma.role.findFirst();

    if (!testUser) {
      testUser = await usersService.createUser({
        username: 'test_sec_user',
        password: 'initialPassword123',
        fullName: 'مستخدم تجريبي للاختبار',
        roleId: role.id
      });
      console.log('✅ Created test user:', testUser.username);
    }

    // 2. Test User Update
    const updated = await usersService.updateUser(testUser.id, {
      fullName: 'مستخدم معدل للاختبار',
      username: 'test_sec_user_updated',
      roleId: role.id
    }, adminId);

    if (updated.fullName !== 'مستخدم معدل للاختبار' || updated.username !== 'test_sec_user_updated') {
      throw new Error('User update verification failed');
    }
    console.log('✅ User update verified successfully');

    // 3. Test Password Reset
    const newPass = 'newStrongPassword456';
    const resetResult = await usersService.resetPassword(testUser.id, newPass, adminId);
    console.log('✅ Password reset executed:', resetResult.message);

    // Verify hash matches new password
    const userInDb = await prisma.user.findUnique({ where: { id: testUser.id } });
    const isMatch = await comparePassword(newPass, userInDb.passwordHash);
    if (!isMatch) {
      throw new Error('New password does not match hash!');
    }
    console.log('✅ New password hash verified with bcrypt compare');

    // 4. Verify Audit Log
    const recentAudit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'USER',
        entityId: testUser.id,
        action: 'RESET_PASSWORD'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!recentAudit) {
      throw new Error('Audit log for RESET_PASSWORD was not recorded!');
    }
    console.log('✅ Audit log recorded successfully:', recentAudit.action, recentAudit.newValues);

    // Clean up test user
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('🧹 Test user cleaned up');

    console.log('\n🎉 ALL STAGE 2 TESTS PASSED 100%!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runStage2Tests();
