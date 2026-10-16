const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDashboardMetrics = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Today's Sales
  const todaySales = await prisma.invoice.aggregate({
    where: { createdAt: { gte: today }, status: 'COMPLETED' },
    _sum: { totalAmount: true }
  });

  // Month's Sales
  const monthSales = await prisma.invoice.aggregate({
    where: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
    _sum: { totalAmount: true }
  });

  // Today's Profits (Sales - Cost)
  const todayInvoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: today }, status: 'COMPLETED' },
    include: { items: { include: { product: true } } }
  });

  let todayCost = 0;
  todayInvoices.forEach(inv => {
    inv.items.forEach(item => {
      todayCost += Number(item.quantity) * Number(item.product?.purchasePrice || 0);
    });
  });
  const todayRevenue = Number(todaySales._sum.totalAmount || 0);
  const todayProfit = todayRevenue - todayCost;

  // Today's Expenses
  const todayExpensesAgg = await prisma.expense.aggregate({
    where: { createdAt: { gte: today } },
    _sum: { amount: true }
  });
  const todayExpenses = Number(todayExpensesAgg._sum.amount || 0);

  // Patient Debts (Total - Active Patients Only)
  const patientDebts = await prisma.patient.aggregate({
    where: { isActive: true, currentDebt: { lt: 0 } },
    _sum: { currentDebt: true }
  });

  // Patient Deposits (Total - Active Patients Only)
  const patientDeposits = await prisma.patient.aggregate({
    where: { isActive: true, currentDebt: { gt: 0 } }, 
    _sum: { currentDebt: true }
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { batches: true }
  });
  
  let lowStockCount = 0;
  let inventoryValue = 0;
  const lowStockItems = [];

  products.forEach(p => {
    const totalQty = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    inventoryValue += totalQty * Number(p.purchasePrice);
    if (totalQty <= Number(p.alertThreshold) || totalQty === 0) {
      lowStockCount++;
      lowStockItems.push({
        id: p.id,
        name: p.name,
        quantity: totalQty,
        alertThreshold: p.alertThreshold,
        unit: p.unit
      });
    }
  });

  return {
    todaySales: todayRevenue,
    todayProfit,
    todayExpenses,
    monthSales: Number(monthSales._sum.totalAmount || 0),
    totalPatientDebt: Math.abs(Number(patientDebts._sum.currentDebt || 0)),
    totalPatientDeposits: Number(patientDeposits._sum.currentDebt || 0),
    lowStockCount,
    lowStockItems,
    inventoryValue
  };
};

const getSalesChartData = async (days = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: startDate }, status: 'COMPLETED' },
    select: { createdAt: true, totalAmount: true }
  });

  const dailyData = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    dailyData[dateStr] = 0;
  }

  invoices.forEach(inv => {
    const dateStr = inv.createdAt.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    if (dailyData[dateStr] !== undefined) {
      dailyData[dateStr] += Number(inv.totalAmount);
    }
  });

  return Object.entries(dailyData).map(([date, amount]) => ({
    date,
    المبيعات: amount
  }));
};

const getTopProducts = async () => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const items = await prisma.invoiceItem.findMany({
    where: { invoice: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' } },
    include: { product: true }
  });

  const productSales = {};
  items.forEach(item => {
    if (!productSales[item.productId]) {
      productSales[item.productId] = {
        name: item.product?.name || item.productName || 'صنف',
        quantity: 0,
        revenue: 0
      };
    }
    productSales[item.productId].quantity += Number(item.quantity);
    productSales[item.productId].revenue += Number(item.subtotal);
  });

  return Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
};

const getDetailedReport = async (type, startDateStr, endDateStr) => {
  // Parse dates and set boundaries (start of day to end of day)
  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate);
  endDate.setHours(23, 59, 59, 999);

  // ================= 1. DAILY COMPREHENSIVE FINANCIAL REPORT =================
  if (type === 'DAILY_FINANCIAL') {
    // A. Invoices
    const invoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' },
      include: {
        items: { include: { product: true } },
        user: { select: { fullName: true } },
        patient: { select: { fullName: true, fileNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    let cashSales = 0;
    let creditSales = 0;
    let totalSales = 0;
    let costOfGoodsSold = 0;
    const productMap = {};

    invoices.forEach(inv => {
      const invTotal = Number(inv.totalAmount);
      totalSales += invTotal;
      if (inv.paymentType === 'CASH') cashSales += invTotal;
      else creditSales += invTotal;

      inv.items.forEach(item => {
        const qty = Number(item.quantity);
        const rev = Number(item.subtotal);
        const cost = qty * Number(item.product?.purchasePrice || 0);
        costOfGoodsSold += cost;

        const pid = item.productId;
        if (!productMap[pid]) {
          productMap[pid] = {
            id: pid,
            name: item.product?.name || item.productName || 'صنف',
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0
          };
        }
        productMap[pid].quantity += qty;
        productMap[pid].revenue += rev;
        productMap[pid].cost += cost;
        productMap[pid].profit += (rev - cost);
      });
    });

    const grossProfit = totalSales - costOfGoodsSold;

    // B. Daily Expenses
    const expenses = await prisma.expense.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { category: true, paymentMethod: true, user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' }
    });

    let totalExpenses = 0;
    let supplierPayments = 0;
    let patientRefunds = 0;
    let operationalExpenses = 0;

    const expensesList = expenses.map(exp => {
      const amt = Number(exp.amount);
      totalExpenses += amt;
      const catName = exp.category?.name || '';
      if (catName.includes('مورد')) supplierPayments += amt;
      else if (catName.includes('أمانات') || catName.includes('مريض')) patientRefunds += amt;
      else operationalExpenses += amt;

      return {
        id: exp.id,
        date: exp.createdAt,
        category: catName,
        amount: amt,
        description: exp.description || '-',
        paymentMethod: exp.paymentMethod?.name || 'نقدي (الدرج)',
        user: exp.user?.fullName || 'النظام'
      };
    });

    const netProfit = grossProfit - operationalExpenses;

    // C. Patient Transactions
    const patientTxs = await prisma.patientTransaction.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { patient: { select: { fullName: true, fileNumber: true } } },
      orderBy: { createdAt: 'desc' }
    });

    let patientDeposits = 0;
    let patientWithdrawals = 0;
    patientTxs.forEach(tx => {
      const amt = Number(tx.amount);
      if (tx.type === 'DEPOSIT') patientDeposits += amt;
      else if (tx.type === 'WITHDRAWAL') patientWithdrawals += amt;
    });

    // D. Daily Shifts
    const shifts = await prisma.dailyShift.findMany({
      where: { openedAt: { gte: startDate, lte: endDate } },
      include: {
        userOpened: { select: { fullName: true } },
        userClosed: { select: { fullName: true } }
      },
      orderBy: { shiftNumber: 'asc' }
    });

    const shiftsList = shifts.map(s => {
      const start = Number(s.startingCash || 0);
      const actual = s.actualBalance !== null ? Number(s.actualBalance) : null;
      const system = s.systemBalance !== null ? Number(s.systemBalance) : null;
      const disc = s.discrepancy !== null ? Number(s.discrepancy) : 0;
      const transferred = Number(s.transferredCash || 0);
      const remaining = Number(s.remainingCash || 0);

      let statusArabic = s.status === 'OPEN' ? 'وردية مفتوحة حالياً' : 'مغلقة ومقفلة';
      let discrepancyArabic = 'مطابق للنظام';
      if (disc > 0) discrepancyArabic = `زيادة (+${disc.toFixed(2)} ج.م)`;
      else if (disc < 0) discrepancyArabic = `عجز (${disc.toFixed(2)} ج.م)`;

      return {
        id: s.shiftNumber,
        shiftNumber: `#${s.shiftNumber}`,
        status: statusArabic,
        openedBy: s.userOpened?.fullName || '-',
        openedAt: s.openedAt,
        closedBy: s.userClosed?.fullName || '-',
        closedAt: s.closedAt,
        startingCash: start,
        systemBalance: system,
        actualBalance: actual,
        discrepancy: discrepancyArabic,
        transferredCash: transferred,
        remainingCash: remaining
      };
    });

    const productsList = Object.values(productMap).sort((a, b) => b.quantity - a.quantity);

    return {
      reportType: 'DAILY_FINANCIAL',
      date: startDate,
      summary: {
        totalSales,
        cashSales,
        creditSales,
        invoiceCount: invoices.length,
        costOfGoodsSold,
        grossProfit,
        totalExpenses,
        operationalExpenses,
        supplierPayments,
        patientRefunds,
        netProfit,
        patientDeposits,
        patientWithdrawals,
        shiftsCount: shifts.length
      },
      shifts: shiftsList,
      products: productsList,
      expenses: expensesList,
      data: productsList // for generic table viewers
    };
  }

  // ================= 2. MONTHLY COMPREHENSIVE CLOSING REPORT =================
  if (type === 'MONTHLY_FINANCIAL') {
    // A. Month Invoices
    const invoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' },
      include: { items: { include: { product: true } } }
    });

    let totalSales = 0;
    let cashSales = 0;
    let creditSales = 0;
    let costOfGoodsSold = 0;
    const productMap = {};

    invoices.forEach(inv => {
      const invTotal = Number(inv.totalAmount);
      totalSales += invTotal;
      if (inv.paymentType === 'CASH') cashSales += invTotal;
      else creditSales += invTotal;

      inv.items.forEach(item => {
        const qty = Number(item.quantity);
        const rev = Number(item.subtotal);
        const cost = qty * Number(item.product?.purchasePrice || 0);
        costOfGoodsSold += cost;

        const pid = item.productId;
        if (!productMap[pid]) {
          productMap[pid] = {
            id: pid,
            name: item.product?.name || item.productName || 'صنف',
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0
          };
        }
        productMap[pid].quantity += qty;
        productMap[pid].revenue += rev;
        productMap[pid].cost += cost;
        productMap[pid].profit += (rev - cost);
      });
    });

    const grossProfit = totalSales - costOfGoodsSold;

    // B. Month Expenses
    const expenses = await prisma.expense.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { category: true }
    });

    const categoryMap = {};
    let totalExpenses = 0;
    let supplierPayments = 0;
    let operationalExpenses = 0;

    expenses.forEach(exp => {
      const amt = Number(exp.amount);
      totalExpenses += amt;
      const cat = exp.category?.name || 'مصروفات متنوعة';
      if (cat.includes('مورد')) supplierPayments += amt;
      else operationalExpenses += amt;

      if (!categoryMap[cat]) categoryMap[cat] = { category: cat, total: 0, count: 0 };
      categoryMap[cat].total += amt;
      categoryMap[cat].count += 1;
    });

    const netProfit = grossProfit - operationalExpenses;

    // C. Month Purchases
    const purchases = await prisma.supplierPurchase.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { supplier: true }
    });

    let totalPurchases = 0;
    let totalPaidPurchases = 0;
    purchases.forEach(p => {
      totalPurchases += Number(p.totalAmount);
      totalPaidPurchases += Number(p.paidAmount);
    });

    // D. Active Patients Overview
    const patientDebts = await prisma.patient.aggregate({
      where: { isActive: true, currentDebt: { lt: 0 } },
      _sum: { currentDebt: true }
    });
    const patientDeposits = await prisma.patient.aggregate({
      where: { isActive: true, currentDebt: { gt: 0 } },
      _sum: { currentDebt: true }
    });
    const activePatientsCount = await prisma.patient.count({ where: { isActive: true } });

    // E. Active Suppliers Overview
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: { purchases: true, payments: true }
    });

    let totalSupplierDebts = 0;
    const suppliersList = suppliers.map(s => {
      const totPurch = s.purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
      const totPaid = s.purchases.reduce((sum, p) => sum + Number(p.paidAmount), 0) + 
                      s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const debt = Math.max(0, totPurch - totPaid);
      totalSupplierDebts += debt;
      return {
        id: s.id,
        name: s.name,
        phone: s.phone || '-',
        totalPurchases: totPurch,
        totalPaid: totPaid,
        currentDebt: debt
      };
    });

    // F. Treasury Balances
    const methods = await prisma.paymentMethod.findMany();
    const treasuryBalances = await Promise.all(methods.map(async m => {
      const txs = await prisma.treasuryTransaction.findMany({ where: { paymentMethodId: m.id } });
      const bal = txs.reduce((sum, t) => sum + (t.type === 'IN' ? Number(t.amount) : -Number(t.amount)), 0);
      return {
        name: m.name,
        balance: bal
      };
    }));

    const topSelling = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    return {
      reportType: 'MONTHLY_FINANCIAL',
      period: { startDate, endDate },
      summary: {
        totalSales,
        cashSales,
        creditSales,
        invoiceCount: invoices.length,
        costOfGoodsSold,
        grossProfit,
        totalExpenses,
        operationalExpenses,
        supplierPayments,
        netProfit,
        totalPurchases,
        totalPaidPurchases,
        totalRemainingPurchases: totalPurchases - totalPaidPurchases,
        totalPatientDeposits: Number(patientDeposits._sum.currentDebt || 0),
        totalPatientDebts: Math.abs(Number(patientDebts._sum.currentDebt || 0)),
        activePatientsCount,
        totalSupplierDebts
      },
      expensesByCategory: Object.values(categoryMap),
      treasuryBalances,
      topProducts: topSelling,
      suppliers: suppliersList,
      data: topSelling
    };
  }

  // ================= 3. SHIFTS HISTORY REPORT =================
  if (type === 'SHIFTS') {
    const shifts = await prisma.dailyShift.findMany({
      where: { openedAt: { gte: startDate, lte: endDate } },
      include: {
        userOpened: { select: { fullName: true } },
        userClosed: { select: { fullName: true } }
      },
      orderBy: { shiftNumber: 'desc' }
    });

    let totalTransferred = 0;
    let totalStarting = 0;

    const data = shifts.map(s => {
      const disc = Number(s.discrepancy || 0);
      let discText = 'مطابق للنظام';
      if (disc > 0) discText = `زيادة (+${disc.toFixed(2)} ج.م)`;
      else if (disc < 0) discText = `عجز (${disc.toFixed(2)} ج.م)`;

      const transferred = Number(s.transferredCash || 0);
      totalTransferred += transferred;
      totalStarting += Number(s.startingCash || 0);

      return {
        id: s.shiftNumber,
        shiftNumber: `#${s.shiftNumber}`,
        openedAt: s.openedAt,
        openedBy: s.userOpened?.fullName || '-',
        closedAt: s.closedAt,
        closedBy: s.userClosed?.fullName || (s.status === 'OPEN' ? 'مفتوحة حالياً' : '-'),
        status: s.status === 'OPEN' ? 'مفتوحة' : 'مغلقة',
        startingCash: Number(s.startingCash || 0),
        systemBalance: s.systemBalance !== null ? Number(s.systemBalance) : '-',
        actualBalance: s.actualBalance !== null ? Number(s.actualBalance) : '-',
        discrepancy: discText,
        transferredCash: transferred,
        remainingCash: Number(s.remainingCash || 0)
      };
    });

    return {
      reportType: 'SHIFTS',
      summary: {
        shiftsCount: shifts.length,
        totalStarting,
        totalTransferred
      },
      data
    };
  }

  // ================= 4. SUPPLIERS DEBTS REPORT =================
  if (type === 'SUPPLIERS') {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: { purchases: true, payments: true },
      orderBy: { name: 'asc' }
    });

    let totalDebt = 0;
    let totalPurchases = 0;
    let totalPaid = 0;

    const data = suppliers.map(s => {
      const purchTotal = s.purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
      const paidTotal = s.purchases.reduce((sum, p) => sum + Number(p.paidAmount), 0) +
                        s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const debt = Math.max(0, purchTotal - paidTotal);

      totalDebt += debt;
      totalPurchases += purchTotal;
      totalPaid += paidTotal;

      return {
        id: s.id,
        name: s.name,
        phone: s.phone || '-',
        totalPurchases: purchTotal,
        totalPaid: paidTotal,
        currentDebt: debt,
        status: debt > 0 ? 'مستحق له مديونية' : 'خالص الحساب',
        purchasesCount: s.purchases.length
      };
    });

    return {
      reportType: 'SUPPLIERS',
      summary: {
        totalSuppliers: suppliers.length,
        totalPurchases,
        totalPaid,
        totalDebt
      },
      data
    };
  }

  // ================= 5. SALES BY PRODUCT REPORT =================
  if (type === 'SALES') {
    const items = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'COMPLETED'
        }
      },
      include: {
        product: { select: { id: true, name: true, purchasePrice: true } },
        invoice: { select: { paymentType: true, totalAmount: true } }
      }
    });

    const productMap = {};
    let totalRevenue = 0;
    let totalCost = 0;
    let cashSales = 0;
    let creditSales = 0;
    
    const invoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' },
      select: { paymentType: true, totalAmount: true }
    });

    invoices.forEach(inv => {
      if (inv.paymentType === 'CASH') cashSales += Number(inv.totalAmount);
      else creditSales += Number(inv.totalAmount);
    });

    items.forEach(item => {
      const pid = item.productId;
      if (!productMap[pid]) {
        productMap[pid] = {
          id: pid,
          name: item.product?.name || item.productName || 'صنف',
          quantity: 0,
          revenue: 0,
          cost: 0
        };
      }
      
      const qty = Number(item.quantity);
      const rev = Number(item.subtotal);
      const cost = qty * Number(item.product?.purchasePrice || 0);

      productMap[pid].quantity += qty;
      productMap[pid].revenue += rev;
      productMap[pid].cost += cost;
      
      totalRevenue += rev;
      totalCost += cost;
    });

    const data = Object.values(productMap).map(p => ({
      ...p,
      profit: p.revenue - p.cost
    })).sort((a, b) => b.quantity - a.quantity);

    return {
      reportType: 'SALES',
      summary: {
        totalSales: totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        cashSales,
        creditSales,
        invoiceCount: invoices.length,
        productCount: data.length
      },
      data
    };
  }

  // ================= 6. PURCHASES REPORT =================
  if (type === 'PURCHASES') {
    const purchases = await prisma.supplierPurchase.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: {
        supplier: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    let totalPurchases = 0;
    let totalPaid = 0;

    const data = purchases.map(pur => {
      totalPurchases += Number(pur.totalAmount);
      totalPaid += Number(pur.paidAmount);
      
      return {
        id: pur.referenceNo,
        date: pur.createdAt,
        supplierName: pur.supplier?.name || 'غير محدد',
        total: Number(pur.totalAmount),
        paid: Number(pur.paidAmount),
        remaining: Number(pur.totalAmount) - Number(pur.paidAmount),
        status: pur.status === 'PAID' ? 'خالصة' : pur.status === 'PARTIAL' ? 'مدفوعة جزئياً' : 'غير مدفوعة',
        itemsSummary: pur.items.map(i => `${i.quantity}x ${i.product?.name || 'صنف'}`).join('، ')
      };
    });

    return {
      reportType: 'PURCHASES',
      summary: {
        totalPurchases,
        totalPaid,
        totalRemaining: totalPurchases - totalPaid,
        purchaseCount: purchases.length
      },
      data
    };
  }

  // ================= 7. EXPENSES REPORT =================
  if (type === 'EXPENSES') {
    const expenses = await prisma.expense.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { category: true, paymentMethod: true },
      orderBy: { createdAt: 'desc' }
    });

    let totalExpenses = 0;

    const data = expenses.map(exp => {
      totalExpenses += Number(exp.amount);
      return {
        id: exp.id,
        date: exp.createdAt,
        category: exp.category?.name || 'عام',
        amount: Number(exp.amount),
        description: exp.description || 'بدون وصف',
        paymentMethod: exp.paymentMethod?.name || 'نقدي (الدرج)'
      };
    });

    return {
      reportType: 'EXPENSES',
      summary: { totalExpenses, expenseCount: expenses.length },
      data
    };
  }
  
  // ================= 8. INVENTORY VALUATION =================
  if (type === 'INVENTORY') {
    const products = await prisma.product.findMany({
      include: { batches: true },
      orderBy: { name: 'asc' }
    });

    let totalValue = 0;
    let totalItems = 0;

    const data = products.map(p => {
      const qty = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
      const value = qty * Number(p.purchasePrice);
      totalValue += value;
      totalItems += qty;

      return {
        id: p.internalCode || `#${p.id}`,
        name: p.name,
        category: p.unit || '-',
        quantity: qty,
        purchasePrice: Number(p.purchasePrice),
        sellingPrice: Number(p.sellingPrice),
        totalValue: value
      };
    });

    return {
      reportType: 'INVENTORY',
      summary: { totalValue, totalItems, uniqueProducts: products.length },
      data
    };
  }

  // ================= 9. LOW STOCK & REORDER REPORT =================
  if (type === 'LOW_STOCK') {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { batches: true },
      orderBy: { name: 'asc' }
    });

    let lowStockCount = 0;
    const data = [];

    products.forEach(p => {
      const qty = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
      const threshold = Number(p.alertThreshold) || 0;
      if (qty <= threshold || qty === 0) {
        lowStockCount++;
        const suggestedQty = Math.max(0, (threshold * 2) - qty) || 10;
        data.push({
          id: p.internalCode || `#${p.id}`,
          name: p.name,
          unit: p.unit || 'قطعة',
          quantity: qty,
          threshold: threshold,
          purchasePrice: Number(p.purchasePrice),
          suggestedQty: suggestedQty,
          estimatedCost: suggestedQty * Number(p.purchasePrice)
        });
      }
    });

    return {
      reportType: 'LOW_STOCK',
      summary: {
        lowStockCount,
        uniqueProducts: data.length
      },
      data
    };
  }

  // ================= 10. ACTIVE PATIENTS REPORT =================
  if (type === 'PATIENTS') {
    const patients = await prisma.patient.findMany({
      where: { isActive: true },
      orderBy: { currentDebt: 'asc' }
    });

    let totalDebts = 0;
    let totalDeposits = 0;

    const data = patients.map(p => {
      const bal = Number(p.currentDebt);
      if (bal < 0) totalDebts += Math.abs(bal);
      else if (bal > 0) totalDeposits += bal;

      let statusArabic = 'خالص';
      let typeArabic = 'رصيد صفري (0.00 ج.م)';
      if (bal < 0) {
        statusArabic = 'مدين للكانتين';
        typeArabic = 'دين على المريض (مستحق لنا)';
      } else if (bal > 0) {
        statusArabic = 'أمانات مستحقة';
        typeArabic = 'وديعة للمريض (واجبة الرد عند الخروج)';
      }

      return {
        id: p.fileNumber,
        name: p.fullName,
        internalNumber: p.internalNumber,
        currentDebt: bal,
        status: 'نشط',
        accountStatus: statusArabic,
        type: typeArabic,
        notes: p.notes || '-'
      };
    });

    return {
      reportType: 'PATIENTS',
      summary: {
        totalDebts,
        totalDeposits,
        netDifference: totalDeposits - totalDebts,
        totalPatients: patients.length,
        activePatients: patients.length
      },
      data
    };
  }

  throw new Error('نوع التقرير غير مدعوم');
};

module.exports = { 
  getDashboardMetrics, 
  getSalesChartData, 
  getTopProducts, 
  getDetailedReport 
};
