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
  const { categoryId, amount, paymentMethodId, description, supplierId } = data;
  const expAmount = Number(amount);

  if (expAmount <= 0) throw new Error('مبلغ المصروف يجب أن يكون أكبر من صفر');

  return prisma.$transaction(async (tx) => {
    // 1. Check payment method
    const method = await tx.paymentMethod.findUnique({ where: { id: Number(paymentMethodId) } });
    if (!method) throw new Error('طريقة الدفع/الخزينة غير موجودة');

    if (Number(method.currentBalance) < expAmount) {
      throw new Error(`رصيد (${method.name}) غير كافٍ. المتاح حالياً: ${method.currentBalance} ج.م`);
    }

    // 2. Check Category
    const category = await tx.expenseCategory.findUnique({ where: { id: Number(categoryId) } });
    if (!category) throw new Error('تصنيف المصروف غير موجود');

    let supplier = null;
    let supplierPayment = null;

    // If paying a supplier (either category is "سداد لمورد" or supplierId passed)
    if (supplierId || (category.name && category.name.includes('مورد'))) {
      if (!supplierId) {
        throw new Error('يرجى تحديد المورد المراد سداد حسابه');
      }

      supplier = await tx.supplier.findUnique({ where: { id: Number(supplierId) } });
      if (!supplier) throw new Error('المورد المحدد غير موجود');

      // Create SupplierPayment record
      supplierPayment = await tx.supplierPayment.create({
        data: {
          supplierId: supplier.id,
          amount: expAmount,
          paymentMethodId: Number(paymentMethodId),
          createdBy: userId
        }
      });

      // Distribute payment to open purchases (oldest first)
      const purchases = await tx.supplierPurchase.findMany({
        where: { supplierId: supplier.id },
        orderBy: { createdAt: 'asc' }
      });

      let remainingToApply = expAmount;
      for (const p of purchases) {
        const debtOnPurchase = Number(p.totalAmount) - Number(p.paidAmount);
        if (debtOnPurchase > 0 && remainingToApply > 0) {
          const apply = Math.min(remainingToApply, debtOnPurchase);
          const newPaid = Number(p.paidAmount) + apply;
          const newStatus = newPaid >= Number(p.totalAmount) ? 'PAID' : 'PARTIAL';
          await tx.supplierPurchase.update({
            where: { id: p.id },
            data: {
              paidAmount: newPaid,
              status: newStatus
            }
          });
          remainingToApply -= apply;
        }
      }
    }

    // 3. Create Expense
    const expenseDescription = supplier 
      ? `سداد لمورد: ${supplier.name} ${description ? `(${description})` : ''}`
      : (description || 'بدون تفاصيل');

    const expense = await tx.expense.create({
      data: {
        categoryId: Number(categoryId),
        amount: expAmount,
        paymentMethodId: Number(paymentMethodId),
        description: expenseDescription,
        createdBy: userId
      }
    });

    // 4. Deduct from Treasury
    await tx.paymentMethod.update({
      where: { id: Number(paymentMethodId) },
      data: { currentBalance: Number(method.currentBalance) - expAmount }
    });

    // 5. Log Treasury Transaction
    await tx.treasuryTransaction.create({
      data: {
        paymentMethodId: Number(paymentMethodId),
        type: 'OUT',
        amount: expAmount,
        description: `مصروفات [${category.name}]: ${expenseDescription}`,
        referenceType: supplier ? 'SUPPLIER_PAYMENT' : 'EXPENSE',
        referenceId: supplierPayment ? supplierPayment.id : expense.id,
        createdBy: userId
      }
    });

    // 6. Audit Log
    if (supplier) {
      await tx.auditLog.create({
        data: {
          action: 'PAY',
          entityType: 'SUPPLIER',
          entityId: supplier.id,
          newValues: JSON.stringify({
            'المورد': supplier.name,
            'المبلغ المسدد': `${expAmount} ج.م`,
            'القناة المالية': method.name,
            'مصدر السداد': 'سحب مصروفات',
            'البيان': description || '-'
          }),
          userId
        }
      });
    }

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

const settleDailyShift = async (data, userId) => {
  const { countedAmount, transferAmount, leaveInDrawer = 0, notes } = data;
  const numCounted = Number(countedAmount);
  const numTransfer = Number(transferAmount);

  if (isNaN(numCounted) || numCounted < 0) {
    throw new Error('يرجى إدخال مبلغ النقدية المعدودة في الدرج بشكل صحيح');
  }

  if (isNaN(numTransfer) || numTransfer <= 0) {
    throw new Error('مبلغ التوريد إلى الخزينة الرئيسية يجب أن يكون أكبر من صفر');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Find Drawer payment method
    const drawerMethod = await tx.paymentMethod.findFirst({
      where: { name: { contains: 'درج' } }
    });
    if (!drawerMethod) throw new Error('قناة نقدي (الدرج) غير موجودة بالنظام');

    // 2. Find Main Treasury payment method
    const mainTreasuryMethod = await tx.paymentMethod.findFirst({
      where: { name: { contains: 'الخزينة' } }
    });
    if (!mainTreasuryMethod) throw new Error('قناة الخزينة (الرئيسية) غير موجودة بالنظام');

    const systemDrawerBalance = Number(drawerMethod.currentBalance);

    if (numTransfer > systemDrawerBalance) {
      throw new Error(`مبلغ التوريد (${numTransfer} ج.م) أكبر من الرصيد المتوفر بالدرج في النظام (${systemDrawerBalance} ج.م)`);
    }

    const discrepancy = numCounted - systemDrawerBalance;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { fullName: true, username: true }
    });

    // 3. Close open DailyShift if exists
    const activeShift = await tx.dailyShift.findFirst({
      where: { status: 'OPEN' }
    });
    if (activeShift) {
      await tx.dailyShift.update({
        where: { id: activeShift.id },
        data: {
          status: 'CLOSED',
          actualCash: numCounted,
          expectedCash: systemDrawerBalance,
          transferredCash: numTransfer,
          remainingCash: numCounted - numTransfer,
          discrepancy,
          closedAt: new Date(),
          closedBy: userId,
          notes: notes || null
        }
      });
    }

    // 4. Deduct from Drawer
    await tx.paymentMethod.update({
      where: { id: drawerMethod.id },
      data: { currentBalance: systemDrawerBalance - numTransfer }
    });

    // 5. Add to Main Treasury
    const updatedMain = await tx.paymentMethod.update({
      where: { id: mainTreasuryMethod.id },
      data: { currentBalance: Number(mainTreasuryMethod.currentBalance) + numTransfer }
    });

    let discrepancyText = 'مطابق للنظام';
    if (discrepancy > 0) discrepancyText = `زيادة نقدية (+${discrepancy.toFixed(2)} ج.م)`;
    else if (discrepancy < 0) discrepancyText = `عجز نقدي (${discrepancy.toFixed(2)} ج.م)`;

    // 6. Drawer Out Transaction
    const outTx = await tx.treasuryTransaction.create({
      data: {
        paymentMethodId: drawerMethod.id,
        type: 'OUT',
        amount: numTransfer,
        description: `تقفيل يومية وتوريد للخزينة الرئيسية (${discrepancyText}) - ${notes || 'إغلاق وردية'}`,
        referenceType: 'DAILY_SETTLEMENT',
        referenceId: activeShift ? activeShift.id : undefined,
        createdBy: userId
      }
    });

    // 7. Main Treasury In Transaction
    await tx.treasuryTransaction.create({
      data: {
        paymentMethodId: mainTreasuryMethod.id,
        type: 'IN',
        amount: numTransfer,
        description: `توريد يومية وارد من الدرج (تقفيل وردية) - ${notes || 'إغلاق وردية'}`,
        referenceType: 'DAILY_SETTLEMENT',
        referenceId: outTx.id,
        createdBy: userId
      }
    });

    // 7. Audit Log
    await tx.auditLog.create({
      data: {
        action: 'DAILY_SETTLEMENT',
        entityType: 'TREASURY',
        entityId: outTx.id,
        newValues: JSON.stringify({
          'المسؤول': user?.fullName || user?.username,
          'رصيد الدرج بالنظام': `${systemDrawerBalance.toFixed(2)} ج.م`,
          'العد الفعلي': `${numCounted.toFixed(2)} ج.م`,
          'الفرق': discrepancyText,
          'المبلغ المورد للخزينة': `${numTransfer.toFixed(2)} ج.م`,
          'المتبقي بالدرج': `${(systemDrawerBalance - numTransfer).toFixed(2)} ج.م`,
          'ملاحظات': notes || 'بدون ملاحظات'
        }),
        userId
      }
    });

    return {
      success: true,
      message: 'تم تقفيل اليوم وتوريد النقدية إلى الخزينة بنجاح',
      settlement: {
        systemDrawerBalance,
        countedAmount: numCounted,
        discrepancy,
        discrepancyText,
        transferAmount: numTransfer,
        remainingInDrawer: systemDrawerBalance - numTransfer,
        mainTreasuryBalance: Number(updatedMain.currentBalance),
        settledBy: user?.fullName || user?.username,
        settledAt: new Date(),
        notes: notes || ''
      }
    };
  });
};

module.exports = { 
  getPaymentMethods, 
  getTreasuryTransactions, 
  getExpenseCategories, 
  createExpense, 
  getExpenses,
  transferFunds,
  settleDailyShift
};
