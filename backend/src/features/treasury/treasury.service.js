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

module.exports = { 
  getPaymentMethods, 
  getTreasuryTransactions, 
  getExpenseCategories, 
  createExpense, 
  getExpenses 
};
