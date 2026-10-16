const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get current shift status and live metrics
 */
const getCurrentShift = async () => {
  const currentShift = await prisma.dailyShift.findFirst({
    where: { status: 'OPEN' },
    include: {
      userOpened: { select: { id: true, fullName: true, username: true } }
    }
  });

  const drawerMethod = await prisma.paymentMethod.findFirst({
    where: { name: { contains: 'درج' } }
  });
  const drawerId = drawerMethod ? drawerMethod.id : 1;
  const currentDrawerBalance = drawerMethod ? Number(drawerMethod.currentBalance) : 0;

  if (!currentShift) {
    const lastShift = await prisma.dailyShift.findFirst({
      where: { status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      include: {
        userOpened: { select: { id: true, fullName: true } },
        userClosed: { select: { id: true, fullName: true } }
      }
    });

    return {
      isOpen: false,
      currentShift: null,
      lastShift,
      currentDrawerBalance
    };
  }

  // Calculate live shift numbers from currentShift.openedAt to now
  const openedAt = currentShift.openedAt;

  // 1. Cash Sales
  const salesAgg = await prisma.invoice.aggregate({
    where: {
      createdAt: { gte: openedAt },
      status: 'COMPLETED'
    },
    _sum: { cashAmount: true, totalAmount: true },
    _count: { id: true }
  });
  const cashSales = Number(salesAgg._sum.cashAmount || 0);
  const totalSales = Number(salesAgg._sum.totalAmount || 0);
  const invoicesCount = Number(salesAgg._count.id || 0);

  // 2. Patient Deposits entering the drawer
  const depositsAgg = await prisma.treasuryTransaction.aggregate({
    where: {
      createdAt: { gte: openedAt },
      paymentMethodId: drawerId,
      type: 'IN',
      referenceType: 'PATIENT_TX'
    },
    _sum: { amount: true }
  });
  const deposits = Number(depositsAgg._sum.amount || 0);

  // 3. Cash Outflows from Drawer (Operating Expenses + Supplier Payments + Patient Refunds)
  const expensesAgg = await prisma.expense.aggregate({
    where: {
      createdAt: { gte: openedAt },
      paymentMethodId: drawerId
    },
    _sum: { amount: true }
  });
  const expenses = Number(expensesAgg._sum.amount || 0);

  // 4. Cash Transfers & Settlements out of the Drawer
  const transfersAgg = await prisma.treasuryTransaction.aggregate({
    where: {
      createdAt: { gte: openedAt },
      paymentMethodId: drawerId,
      type: 'OUT',
      referenceType: { in: ['TRANSFER', 'DAILY_SETTLEMENT'] }
    },
    _sum: { amount: true }
  });
  const transfers = Number(transfersAgg._sum.amount || 0);

  // Expected Cash in Drawer right now
  const startingCash = Number(currentShift.startingCash);
  const expectedCash = currentDrawerBalance;

  return {
    isOpen: true,
    currentShift: {
      id: currentShift.id,
      shiftNumber: currentShift.shiftNumber,
      status: currentShift.status,
      openedAt: currentShift.openedAt,
      openedBy: currentShift.userOpened.fullName,
      startingCash,
      cashSales,
      totalSales,
      invoicesCount,
      deposits,
      expenses,
      transfers,
      expectedCash,
      currentDrawerBalance,
      notes: currentShift.notes
    }
  };
};

/**
 * Open a new shift
 */
const openShift = async (data, userId) => {
  const { startingCash, notes } = data;

  const existing = await prisma.dailyShift.findFirst({
    where: { status: 'OPEN' }
  });
  if (existing) {
    throw new Error(`توجد وردية مفتوحة بالفعل حالياً برقم #${existing.shiftNumber}`);
  }

  const drawerMethod = await prisma.paymentMethod.findFirst({
    where: { name: { contains: 'درج' } }
  });
  const currentDrawer = drawerMethod ? Number(drawerMethod.currentBalance) : 0;

  // If user provides startingCash, we use it, otherwise default to current drawer balance
  const initialCash = (startingCash !== undefined && startingCash !== null && !isNaN(Number(startingCash)))
    ? Number(startingCash)
    : currentDrawer;

  // Determine shift number
  const lastShift = await prisma.dailyShift.findFirst({
    orderBy: { id: 'desc' }
  });
  const shiftNumber = lastShift ? lastShift.shiftNumber + 1 : 1;

  return prisma.$transaction(async (tx) => {
    // If entered startingCash differs from system drawer balance, adjust drawer to match
    if (drawerMethod && initialCash !== currentDrawer) {
      await tx.paymentMethod.update({
        where: { id: drawerMethod.id },
        data: { currentBalance: initialCash }
      });
      await tx.treasuryTransaction.create({
        data: {
          paymentMethodId: drawerMethod.id,
          type: initialCash > currentDrawer ? 'IN' : 'OUT',
          amount: Math.abs(initialCash - currentDrawer),
          description: `تسوية عهدة افتتاح وردية #${shiftNumber}`,
          referenceType: 'SHIFT_START',
          createdBy: userId
        }
      });
    }

    const shift = await tx.dailyShift.create({
      data: {
        shiftNumber,
        status: 'OPEN',
        startingCash: initialCash,
        notes: notes || null,
        openedBy: userId,
        openedAt: new Date()
      },
      include: {
        userOpened: { select: { id: true, fullName: true } }
      }
    });

    await tx.auditLog.create({
      data: {
        action: 'OPEN_SHIFT',
        entityType: 'SHIFT',
        entityId: shift.id,
        newValues: JSON.stringify({
          'رقم الوردية': `#${shiftNumber}`,
          'عهدة البداية': `${initialCash} ج.م`,
          'فتح بواسطة': shift.userOpened.fullName
        }),
        userId
      }
    });

    return shift;
  });
};

/**
 * Close current shift and perform settlement / transfer to main treasury
 */
const closeShift = async (data, userId) => {
  const { countedAmount, transferAmount = 0, notes } = data;
  const numCounted = Number(countedAmount);
  const numTransfer = Number(transferAmount);

  if (isNaN(numCounted) || numCounted < 0) {
    throw new Error('يرجى إدخال مبلغ النقدية المعدودة بالدرج بشكل صحيح');
  }

  const activeShift = await prisma.dailyShift.findFirst({
    where: { status: 'OPEN' },
    include: { userOpened: { select: { fullName: true } } }
  });

  if (!activeShift) {
    throw new Error('لا توجد وردية مفتوحة حالياً لتقفيلها!');
  }

  return prisma.$transaction(async (tx) => {
    const drawerMethod = await tx.paymentMethod.findFirst({
      where: { name: { contains: 'درج' } }
    });
    if (!drawerMethod) throw new Error('قناة نقدي (الدرج) غير موجودة بالنظام');

    const mainTreasuryMethod = await tx.paymentMethod.findFirst({
      where: { name: { contains: 'الخزينة' } }
    });
    if (!mainTreasuryMethod) throw new Error('قناة الخزينة (الرئيسية) غير موجودة بالنظام');

    const systemDrawerBalance = Number(drawerMethod.currentBalance);
    const discrepancy = numCounted - systemDrawerBalance;

    if (numTransfer > numCounted) {
      throw new Error(`مبلغ التوريد للخزينة (${numTransfer} ج.م) لا يمكن أن يتجاوز المبلغ المعدود بالدرج (${numCounted} ج.م)`);
    }

    const remainingCash = numCounted - numTransfer;

    // Transfer cash from drawer to Main Treasury if transferAmount > 0
    if (numTransfer > 0) {
      await tx.paymentMethod.update({
        where: { id: drawerMethod.id },
        data: { currentBalance: remainingCash }
      });

      await tx.paymentMethod.update({
        where: { id: mainTreasuryMethod.id },
        data: { currentBalance: Number(mainTreasuryMethod.currentBalance) + numTransfer }
      });

      // OUT transaction from drawer
      const outTx = await tx.treasuryTransaction.create({
        data: {
          paymentMethodId: drawerMethod.id,
          type: 'OUT',
          amount: numTransfer,
          description: `تقفيل وردية #${activeShift.shiftNumber} وتوريد للخزينة الرئيسية - ${notes || 'إغلاق وردية'}`,
          referenceType: 'DAILY_SETTLEMENT',
          referenceId: activeShift.id,
          createdBy: userId
        }
      });

      // IN transaction to Main Treasury
      await tx.treasuryTransaction.create({
        data: {
          paymentMethodId: mainTreasuryMethod.id,
          type: 'IN',
          amount: numTransfer,
          description: `توريد وردية #${activeShift.shiftNumber} وارد من الدرج - ${notes || 'إغلاق وردية'}`,
          referenceType: 'DAILY_SETTLEMENT',
          referenceId: outTx.id,
          createdBy: userId
        }
      });
    } else {
      // If no transfer, drawer balance becomes the counted amount
      await tx.paymentMethod.update({
        where: { id: drawerMethod.id },
        data: { currentBalance: remainingCash }
      });
    }

    // Close Shift record
    const closedShift = await tx.dailyShift.update({
      where: { id: activeShift.id },
      data: {
        status: 'CLOSED',
        actualCash: numCounted,
        expectedCash: systemDrawerBalance,
        transferredCash: numTransfer,
        remainingCash,
        discrepancy,
        closedAt: new Date(),
        closedBy: userId,
        notes: notes || null
      },
      include: {
        userOpened: { select: { fullName: true } },
        userClosed: { select: { fullName: true } }
      }
    });

    let discrepancyText = 'مطابق للنظام';
    if (discrepancy > 0) discrepancyText = `زيادة نقدية (+${discrepancy.toFixed(2)} ج.م)`;
    else if (discrepancy < 0) discrepancyText = `عجز نقدي (${discrepancy.toFixed(2)} ج.م)`;

    await tx.auditLog.create({
      data: {
        action: 'CLOSE_SHIFT',
        entityType: 'SHIFT',
        entityId: closedShift.id,
        newValues: JSON.stringify({
          'رقم الوردية': `#${closedShift.shiftNumber}`,
          'المبلغ المعدود': `${numCounted} ج.م`,
          'المبلغ المتوقع': `${systemDrawerBalance} ج.م`,
          'الفارق': discrepancyText,
          'المورد للخزينة': `${numTransfer} ج.م`,
          'المتبقي بالدرج': `${remainingCash} ج.م`
        }),
        userId
      }
    });

    return {
      success: true,
      shift: closedShift,
      receipt: {
        shiftNumber: closedShift.shiftNumber,
        openedAt: closedShift.openedAt,
        closedAt: closedShift.closedAt,
        settledAt: closedShift.closedAt,
        openedBy: closedShift.userOpened.fullName,
        closedBy: closedShift.userClosed ? closedShift.userClosed.fullName : 'الكاشير',
        settledBy: closedShift.userClosed ? closedShift.userClosed.fullName : 'الكاشير',
        startingCash: Number(closedShift.startingCash),
        expectedCash: systemDrawerBalance,
        systemDrawerBalance,
        countedAmount: numCounted,
        discrepancy,
        discrepancyText,
        transferredCash: numTransfer,
        transferAmount: numTransfer,
        remainingCash,
        remainingInDrawer: remainingCash,
        mainTreasuryBalance: Number(mainTreasuryMethod.currentBalance) + numTransfer,
        mainTreasuryNewBalance: Number(mainTreasuryMethod.currentBalance) + numTransfer,
        notes: closedShift.notes
      }
    };
  });
};

/**
 * Get shift history list
 */
const getShiftsHistory = async (limit = 50) => {
  return prisma.dailyShift.findMany({
    take: limit,
    orderBy: { id: 'desc' },
    include: {
      userOpened: { select: { fullName: true } },
      userClosed: { select: { fullName: true } }
    }
  });
};

module.exports = {
  getCurrentShift,
  openShift,
  closeShift,
  getShiftsHistory
};
