const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// === Treasury ===
const getPaymentMethods = async () => {
  return prisma.paymentMethod.findMany();
};

const getTreasuryTransactions = async (paymentMethodId) => {
  return prisma.treasuryTransaction.findMany({
    where: paymentMethodId ? { paymentMethodId: Number(paymentMethodId) } : {},
    include: {
      user: { select: { fullName: true } },
      paymentMethod: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100 // Limit for performance, in real app add pagination
  });
};

// === Expenses ===
const getExpenseCategories = async () => {
  return prisma.expenseCategory.findMany();
};

const createExpense = async (data, userId) => {
  const { categoryId, amount, paymentMethodId, description } = data;
  const expAmount = Number(amount);

  if (expAmount <= 0) throw new Error('مبلغ المصروف يجب أن يكون أكبر من صفر');

  return prisma.$transaction(async (tx) => {
    // 1. Check payment method
    const method = await tx.paymentMethod.findUnique({ where: { id: paymentMethodId } });
    if (!method) throw new Error('طريقة الدفع/الخزينة غير موجودة');

    // 2. Create Expense
    const expense = await tx.expense.create({
      data: {
        categoryId,
        amount: expAmount,
        paymentMethodId,
        description,
        createdBy: userId
      }
    });

    // 3. Deduct from Treasury
    await tx.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { currentBalance: Number(method.currentBalance) - expAmount }
    });

    // 4. Log Treasury Transaction
    await tx.treasuryTransaction.create({
      data: {
        paymentMethodId,
        type: 'OUT',
        amount: expAmount,
        description: `مصروفات: ${description || 'بدون تفاصيل'}`,
        referenceType: 'EXPENSE',
        referenceId: expense.id,
        createdBy: userId
      }
    });

    return expense;
  });
};

const getExpenses = async () => {
  return prisma.expense.findMany({
    include: {
      category: { select: { name: true } },
      paymentMethod: { select: { name: true } },
      user: { select: { fullName: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
};

const transferFunds = async (data, userId) => {
  const { fromMethodId, toMethodId, amount, notes } = data;
  const transferAmount = Number(amount);

  if (!fromMethodId || !toMethodId) {
    throw new Error('يجب تحديد القناة المحول منها والقناة المحول إليها');
  }

  if (Number(fromMethodId) === Number(toMethodId)) {
    throw new Error('لا يمكن التحويل إلى نفس القناة');
  }

  if (transferAmount <= 0) {
    throw new Error('مبلغ التحويل يجب أن يكون أكبر من صفر');
  }

  return prisma.$transaction(async (tx) => {
    const fromMethod = await tx.paymentMethod.findUnique({ where: { id: Number(fromMethodId) } });
    if (!fromMethod) throw new Error('القناة المحول منها غير موجودة');

    const toMethod = await tx.paymentMethod.findUnique({ where: { id: Number(toMethodId) } });
    if (!toMethod) throw new Error('القناة المحول إليها غير موجودة');

    if (Number(fromMethod.currentBalance) < transferAmount) {
      throw new Error(`رصيد (${fromMethod.name}) غير كافٍ. المتاح حالياً: ${fromMethod.currentBalance} ج.م`);
    }

    // 1. Deduct from source
    await tx.paymentMethod.update({
      where: { id: Number(fromMethodId) },
      data: { currentBalance: Number(fromMethod.currentBalance) - transferAmount }
    });

    // 2. Add to destination
    await tx.paymentMethod.update({
      where: { id: Number(toMethodId) },
      data: { currentBalance: Number(toMethod.currentBalance) + transferAmount }
    });

    // 3. Log Source Treasury Transaction (OUT)
    const outTx = await tx.treasuryTransaction.create({
      data: {
        paymentMethodId: Number(fromMethodId),
        type: 'OUT',
        amount: transferAmount,
        description: `تحويل صادر إلى (${toMethod.name}) - ${notes || 'تحويل سيولة'}`,
        referenceType: 'TRANSFER',
        createdBy: userId
      }
    });

    // 4. Log Destination Treasury Transaction (IN)
    await tx.treasuryTransaction.create({
      data: {
        paymentMethodId: Number(toMethodId),
        type: 'IN',
        amount: transferAmount,
        description: `تحويل وارد من (${fromMethod.name}) - ${notes || 'تحويل سيولة'}`,
        referenceType: 'TRANSFER',
        referenceId: outTx.id,
        createdBy: userId
      }
    });

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        action: 'TRANSFER',
        entityType: 'TREASURY',
        entityId: outTx.id,
        newValues: JSON.stringify({
          'من قناة': fromMethod.name,
          'إلى قناة': toMethod.name,
          'المبلغ': `${transferAmount} ج.م`,
          'البيان': notes || 'بدون بيان'
        }),
        userId: userId
      }
    });

    return { success: true, message: 'تم التحويل بنجاح' };
  });
};

module.exports = { 
  getPaymentMethods, 
  getTreasuryTransactions, 
  getExpenseCategories, 
  createExpense, 
  getExpenses,
  transferFunds
};
