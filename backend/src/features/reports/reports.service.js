const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const calculateDivisionBreakdown = (invoices, kitchenSettlementCost = 0) => {
  const divisions = {
    CANTEEN: { name: 'الكانتين (معلبات وسناكس)', activityType: 'CANTEEN', revenue: 0, cost: 0, profit: 0, count: 0, margin: 0 },
    BUFFET: { name: 'البوفيه والمشروبات', activityType: 'BUFFET', revenue: 0, cost: 0, profit: 0, count: 0, margin: 0 },
    SANDWICH: { name: 'السندوتشات والمطبخ', activityType: 'SANDWICH', revenue: 0, cost: 0, profit: 0, count: 0, margin: 0, auxiliaryCost: 0, baseCost: 0 }
  };

  invoices.forEach(inv => {
    inv.items?.forEach(item => {
      const act = item.product?.activityType || 'CANTEEN';
      if (!divisions[act]) {
        divisions[act] = { name: act, activityType: act, revenue: 0, cost: 0, profit: 0, count: 0, margin: 0 };
      }
      const qty = Number(item.quantity || 0);
      const rev = Number(item.subtotal || 0);
      const cost = qty * Number(item.product?.purchasePrice || 0);

      divisions[act].revenue += rev;
      divisions[act].cost += cost;
      divisions[act].profit += (rev - cost);
      divisions[act].count += qty;
    });
  });

  if (divisions.SANDWICH) {
    divisions.SANDWICH.baseCost = divisions.SANDWICH.cost;
    divisions.SANDWICH.auxiliaryCost = Number(Number(kitchenSettlementCost || 0).toFixed(2));
    divisions.SANDWICH.cost = Number((divisions.SANDWICH.baseCost + Number(kitchenSettlementCost || 0)).toFixed(2));
    divisions.SANDWICH.profit = Number((divisions.SANDWICH.revenue - divisions.SANDWICH.cost).toFixed(2));
  }

  Object.keys(divisions).forEach(k => {
    const d = divisions[k];
    d.revenue = Number(d.revenue.toFixed(2));
    d.cost = Number(d.cost.toFixed(2));
    d.profit = Number(d.profit.toFixed(2));
    d.margin = d.revenue > 0 ? Number(((d.profit / d.revenue) * 100).toFixed(1)) : 0;
  });

  return divisions;
};

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
    todaySales: Number(todayRevenue.toFixed(2)),
    todayProfit: Number(todayProfit.toFixed(2)),
    todayExpenses: Number(todayExpenses.toFixed(2)),
    monthSales: Number(Number(monthSales._sum.totalAmount || 0).toFixed(2)),
    totalPatientDebt: Math.abs(Number(Number(patientDebts._sum.currentDebt || 0).toFixed(2))),
    totalPatientDeposits: Number(Number(patientDeposits._sum.currentDebt || 0).toFixed(2)),
    lowStockCount,
    lowStockItems,
    inventoryValue: Number(inventoryValue.toFixed(2))
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
    المبيعات: Number(Number(amount || 0).toFixed(2))
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
    .slice(0, 5)
    .map(p => ({
      ...p,
      revenue: Number(Number(p.revenue || 0).toFixed(2))
    }));
};

const getDetailedReport = async (type, startDateStr, endDateStr, options = {}) => {
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

    const grossProfit = Number((totalSales - costOfGoodsSold).toFixed(2));

    // B. Daily Expenses
    const expenses = await prisma.expense.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { category: true, paymentMethod: true, user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' }
    });

    let totalExpenses = 0;
    let supplierPayments = 0;
    let patientRefunds = 0;
    let hospitalExpenses = 0;
    let canteenExpenses = 0;

    const expensesList = expenses.map(exp => {
      const amt = Number(exp.amount);
      totalExpenses += amt;
      const catName = exp.category?.name || '';
      if (catName.includes('مورد')) supplierPayments += amt;
      else if (catName.includes('أمانات') || catName.includes('مريض')) patientRefunds += amt;
      else if (catName.includes('مستشفى')) hospitalExpenses += amt;
      else canteenExpenses += amt;

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

    // Net Profit is purely trading profit from canteen sales (Sales - COGS); expenses do not deduct from trading profit
    const netProfit = grossProfit;

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
    const divisions = calculateDivisionBreakdown(invoices);

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
        canteenExpenses,
        operationalExpenses: canteenExpenses,
        supplierPayments,
        patientRefunds,
        hospitalExpenses,
        netProfit,
        patientDeposits,
        patientWithdrawals,
        shiftsCount: shifts.length,
        divisions
      },
      divisions: Object.values(divisions),
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

    let grossProfit = Number((totalSales - costOfGoodsSold).toFixed(2));

    // B. Month Expenses
    const expenses = await prisma.expense.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { category: true }
    });

    const categoryMap = {};
    let totalExpenses = 0;
    let supplierPayments = 0;
    let patientRefunds = 0;
    let hospitalExpenses = 0;
    let canteenExpenses = 0;

    expenses.forEach(exp => {
      const amt = Number(exp.amount);
      totalExpenses += amt;
      const cat = exp.category?.name || 'مصروفات متنوعة';
      if (cat.includes('مورد')) supplierPayments += amt;
      else if (cat.includes('أمانات') || cat.includes('مريض')) patientRefunds += amt;
      else if (cat.includes('مستشفى')) hospitalExpenses += amt;
      else canteenExpenses += amt;

      if (!categoryMap[cat]) categoryMap[cat] = { category: cat, total: 0, count: 0 };
      categoryMap[cat].total += amt;
      categoryMap[cat].count += 1;
    });

    // Net Profit is purely trading profit from canteen sales (Sales - COGS); expenses do not deduct from trading profit
    let netProfit = grossProfit;

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

    const allSoldProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(p => ({
        ...p,
        revenue: Number(Number(p.revenue || 0).toFixed(2)),
        cost: Number(Number(p.cost || 0).toFixed(2)),
        profit: Number(Number(p.profit || 0).toFixed(2))
      }));

    // G. Kitchen Settlement Cost (if any auxiliary materials settled in month)
    const kitchenSettlementMovements = await prisma.inventoryMovement.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        referenceType: 'KITCHEN_SETTLEMENT'
      },
      include: { product: true }
    });

    let totalKitchenSettlementCost = 0;
    kitchenSettlementMovements.forEach(m => {
      const qty = Number(m.quantity || 0);
      const unitCost = Number(m.product?.purchasePrice || 0);
      if (m.type === 'OUT') totalKitchenSettlementCost += qty * unitCost;
      else if (m.type === 'IN') totalKitchenSettlementCost -= qty * unitCost;
    });
    totalKitchenSettlementCost = Math.max(0, Number(totalKitchenSettlementCost.toFixed(2)));

    const divisions = calculateDivisionBreakdown(invoices, totalKitchenSettlementCost);
    const totalCOGS = Number((costOfGoodsSold + totalKitchenSettlementCost).toFixed(2));
    grossProfit = Number((totalSales - totalCOGS).toFixed(2));
    netProfit = grossProfit;

    return {
      reportType: 'MONTHLY_FINANCIAL',
      period: { startDate, endDate },
      summary: {
        totalSales,
        cashSales,
        creditSales,
        invoiceCount: invoices.length,
        costOfGoodsSold: totalCOGS,
        baseCostOfGoodsSold: costOfGoodsSold,
        kitchenSettlementCost: totalKitchenSettlementCost,
        grossProfit,
        totalExpenses,
        canteenExpenses,
        operationalExpenses: canteenExpenses,
        supplierPayments,
        patientRefunds,
        hospitalExpenses,
        netProfit,
        totalPurchases,
        totalPaidPurchases,
        totalRemainingPurchases: totalPurchases - totalPaidPurchases,
        totalPatientDeposits: Number(patientDeposits._sum.currentDebt || 0),
        totalPatientDebts: Math.abs(Number(patientDebts._sum.currentDebt || 0)),
        activePatientsCount,
        totalSupplierDebts,
        divisions
      },
      divisions: Object.values(divisions),
      expensesByCategory: Object.values(categoryMap),
      treasuryBalances,
      topProducts: allSoldProducts,
      suppliers: suppliersList,
      data: allSoldProducts
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
      const paidFromPayments = s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const paidFromPurchases = s.purchases.reduce((sum, p) => sum + Number(p.paidAmount), 0);
      const paidTotal = Math.max(paidFromPayments, paidFromPurchases);
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
    const where = { createdAt: { gte: startDate, lte: endDate } };
    if (options.supplierId && options.supplierId !== 'ALL' && options.supplierId !== '') {
      where.supplierId = Number(options.supplierId);
    }

    const purchases = await prisma.supplierPurchase.findMany({
      where,
      include: {
        supplier: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    let totalPurchases = 0;
    let totalPaid = 0;

    const data = purchases.map(pur => {
      const tot = Number(pur.totalAmount);
      const paid = Number(pur.paidAmount);
      totalPurchases += tot;
      totalPaid += paid;
      
      return {
        id: pur.referenceNo || `#${pur.id}`,
        purchaseId: pur.id,
        date: pur.createdAt,
        supplierId: pur.supplierId,
        supplierName: pur.supplier?.name || 'غير محدد',
        supplierPhone: pur.supplier?.phone || '-',
        total: tot,
        paid: paid,
        remaining: tot - paid,
        status: pur.status === 'PAID' ? 'خالصة' : pur.status === 'PARTIAL' ? 'مدفوعة جزئياً' : 'غير مدفوعة',
        items: pur.items.map(i => ({
          productName: i.product?.name || i.productName || 'صنف',
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          subtotal: Number(i.subtotal)
        })),
        itemsSummary: pur.items.map(i => `${i.quantity}x ${i.product?.name || 'صنف'}`).join('، ')
      };
    });

    return {
      reportType: 'PURCHASES',
      summary: {
        totalPurchases: Number(totalPurchases.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        totalRemaining: Number((totalPurchases - totalPaid).toFixed(2)),
        purchaseCount: purchases.length
      },
      data
    };
  }

  // ================= 7. EXPENSES REPORT =================
  if (type === 'EXPENSES') {
    const where = { createdAt: { gte: startDate, lte: endDate } };

    // Filter by Payment Method (من: الدرج / فودافون كاش / الخزينة الرئيسية)
    if (options.paymentMethodId && options.paymentMethodId !== 'ALL' && options.paymentMethodId !== '') {
      where.paymentMethodId = Number(options.paymentMethodId);
    }

    // Filter by Category (إلى: نوع المصروف)
    if (options.categoryId && options.categoryId !== 'ALL' && options.categoryId !== '') {
      where.categoryId = Number(options.categoryId);
    }

    // Filter by Supplier (إذا تم اختيار مورد محدد لسداد الحساب)
    if (options.supplierId && options.supplierId !== 'ALL' && options.supplierId !== '') {
      const sup = await prisma.supplier.findUnique({ where: { id: Number(options.supplierId) } });
      if (sup) {
        where.description = { contains: sup.name };
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { 
        category: true, 
        paymentMethod: true,
        user: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const categoryBreakdown = {};
    const paymentMethodBreakdown = {};

    let totalExpenses = 0;
    let hospitalExpenses = 0;
    let supplierPayments = 0;
    let canteenExpenses = 0;
    let patientRefunds = 0;

    const data = expenses.map(exp => {
      const amt = Number(exp.amount);
      totalExpenses += amt;
      const cat = exp.category?.name || 'مصروفات متنوعة';
      const pm = exp.paymentMethod?.name || 'نقدي (الدرج)';

      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
      paymentMethodBreakdown[pm] = (paymentMethodBreakdown[pm] || 0) + amt;

      if (cat.includes('مستشفى')) hospitalExpenses += amt;
      else if (cat.includes('مورد')) supplierPayments += amt;
      else if (cat.includes('أمانات') || cat.includes('مريض')) patientRefunds += amt;
      else canteenExpenses += amt;

      return {
        id: exp.id,
        date: exp.createdAt,
        category: cat,
        categoryId: exp.categoryId,
        amount: amt,
        description: exp.description || 'بدون تفاصيل',
        paymentMethod: pm,
        paymentMethodId: exp.paymentMethodId,
        user: exp.user?.fullName || 'النظام'
      };
    });

    const activeCategories = Object.entries(categoryBreakdown)
      .filter(([_, amount]) => amount > 0)
      .map(([name, amount]) => ({
        name,
        amount: Number(amount.toFixed(2)),
        percentage: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0
      }));

    const activePaymentMethods = Object.entries(paymentMethodBreakdown)
      .filter(([_, amount]) => amount > 0)
      .map(([name, amount]) => ({
        name,
        amount: Number(amount.toFixed(2)),
        percentage: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0
      }));

    return {
      reportType: 'EXPENSES',
      summary: { 
        totalExpenses: Number(totalExpenses.toFixed(2)),
        hospitalExpenses: Number(hospitalExpenses.toFixed(2)),
        supplierPayments: Number(supplierPayments.toFixed(2)),
        canteenExpenses: Number(canteenExpenses.toFixed(2)),
        patientRefunds: Number(patientRefunds.toFixed(2)),
        expenseCount: expenses.length,
        activeCategories,
        activePaymentMethods
      },
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

      let effectiveExpiry = p.expiryDate;
      if (!effectiveExpiry && p.batches && p.batches.length > 0) {
        const b = p.batches.find(b => b.expiryDate && Number(b.quantityRemaining) > 0);
        if (b) effectiveExpiry = b.expiryDate;
      }
      return {
        id: p.internalCode || `#${p.id}`,
        name: p.name,
        category: p.unit || '-',
        quantity: qty,
        purchasePrice: Number(p.purchasePrice),
        sellingPrice: Number(p.sellingPrice),
        totalValue: value,
        expiryDate: effectiveExpiry
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

  // ================= 10. EXPIRY & LOSS TRACKING REPORT =================
  if (type === 'EXPIRY') {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { batches: true },
      orderBy: { name: 'asc' }
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let expiredCount = 0;
    let expiringSoonCount = 0;
    let totalEstimatedLoss = 0;
    const data = [];

    products.forEach(p => {
      const qty = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
      
      let effectiveExpiry = p.expiryDate;
      if (!effectiveExpiry && p.batches && p.batches.length > 0) {
        const bWithExp = p.batches
          .filter(b => b.expiryDate && Number(b.quantityRemaining) > 0)
          .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];
        if (bWithExp) effectiveExpiry = bWithExp.expiryDate;
      }

      if (effectiveExpiry) {
        const exp = new Date(effectiveExpiry);
        exp.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        const costValue = qty * Number(p.purchasePrice);

        let status = 'VALID';
        if (daysLeft < 0) {
          status = 'EXPIRED';
          expiredCount++;
          totalEstimatedLoss += costValue;
        } else if (daysLeft <= 5) {
          status = 'EXPIRING_SOON';
          expiringSoonCount++;
        }

        if (status !== 'VALID') {
          data.push({
            id: p.internalCode || `#${p.id}`,
            name: p.name,
            barcode: p.barcode || 'بدون باركود',
            unit: p.unit || 'قطعة',
            quantity: qty,
            purchasePrice: Number(p.purchasePrice),
            sellingPrice: Number(p.sellingPrice),
            totalCostValue: Number(costValue.toFixed(2)),
            expiryDate: effectiveExpiry,
            daysLeft,
            status,
            statusText: status === 'EXPIRED' ? 'منتهي الصلاحية' : `قريب الانتهاء (متبقي ${daysLeft} يوم)`
          });
        }
      }
    });

    data.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      reportType: 'EXPIRY',
      summary: {
        totalAlerts: data.length,
        expiredCount,
        expiringSoonCount,
        totalEstimatedLoss: Number(totalEstimatedLoss.toFixed(2))
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

  // ================= 10. RAW MATERIALS CONSUMPTION REPORT =================
  if (type === 'RAW_MATERIALS') {
    const rawMaterials = await prisma.product.findMany({
      where: { productType: 'RAW_MATERIAL' },
      include: {
        batches: true,
        inventoryMovements: {
          where: {
            createdAt: { gte: startDate, lte: endDate }
          },
          include: { user: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    // جلب السندوتشات المباعة خلال الفترة لاحتساب الاستهلاك التقديري للخامات المكملة (عيش، خضار، إلخ) لتقفيلة الشهر
    const sandwichInvoiceItems = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'COMPLETED'
        },
        product: { activityType: 'SANDWICH' }
      },
      include: {
        product: {
          include: {
            ingredients: true
          }
        }
      }
    });

    const theoreticalAuxMap = {};
    const auxiliaryRecipeNamesMap = {};

    sandwichInvoiceItems.forEach(invItem => {
      const sandwichQty = Number(invItem.quantity || 0);
      const ingredients = invItem.product?.ingredients || [];
      const baseIng = ingredients.find(i => i.notes?.includes('الأساسي')) || ingredients[0];

      ingredients.forEach(ing => {
        // الخامات المكملة التي لا تخصم تلقائياً عند البيع
        if (ing.id !== baseIng?.id) {
          const rawId = ing.rawMaterialId;
          const usage = sandwichQty * Number(ing.quantityPerUnit || 0);
          theoreticalAuxMap[rawId] = (theoreticalAuxMap[rawId] || 0) + usage;
          if (!auxiliaryRecipeNamesMap[rawId]) auxiliaryRecipeNamesMap[rawId] = new Set();
          auxiliaryRecipeNamesMap[rawId].add(invItem.product.name);
        }
      });
    });

    let totalRawValueConsumed = 0;
    const materialsList = rawMaterials.map(rm => {
      const currentStock = rm.batches.reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
      
      let consumedQty = 0;
      let returnedQty = 0;
      let purchasedQty = 0;
      let adjustmentIn = 0;
      let adjustmentOut = 0;

      rm.inventoryMovements.forEach(m => {
        const qty = Number(m.quantity || 0);
        if (m.type === 'OUT' && (m.referenceType === 'SALE_RECIPE' || m.referenceType === 'SALE')) {
          consumedQty += qty;
        } else if (m.type === 'IN' && m.referenceType === 'RETURN_RECIPE') {
          returnedQty += qty;
        } else if (m.type === 'IN' && m.referenceType === 'PURCHASE') {
          purchasedQty += qty;
        } else if (m.type === 'IN' && m.referenceType === 'ADJUSTMENT') {
          adjustmentIn += qty;
        } else if (m.type === 'OUT' && m.referenceType === 'ADJUSTMENT') {
          adjustmentOut += qty;
        }
      });

      const netConsumedQty = Math.max(0, consumedQty - returnedQty);
      const unitCost = Number(rm.purchasePrice || 0);
      const totalCostConsumed = Number((netConsumedQty * unitCost).toFixed(2));
      totalRawValueConsumed += totalCostConsumed;

      const theoreticalAuxUsage = Number((theoreticalAuxMap[rm.id] || 0).toFixed(3));
      const recipeNames = auxiliaryRecipeNamesMap[rm.id] ? Array.from(auxiliaryRecipeNamesMap[rm.id]) : [];

      return {
        id: rm.id,
        name: rm.name,
        code: rm.internalCode,
        unit: rm.unit,
        unitCost,
        currentStock,
        consumedQty: Number(consumedQty.toFixed(3)),
        returnedQty: Number(returnedQty.toFixed(3)),
        netConsumedQty: Number(netConsumedQty.toFixed(3)),
        totalCostConsumed,
        purchasedQty: Number(purchasedQty.toFixed(3)),
        movementsCount: rm.inventoryMovements.length,
        isSandwichAuxiliary: theoreticalAuxUsage > 0,
        theoreticalSandwichUsage: theoreticalAuxUsage,
        theoreticalSandwichCost: Number((theoreticalAuxUsage * unitCost).toFixed(2)),
        usedInSandwiches: recipeNames
      };
    });

    return {
      reportType: 'RAW_MATERIALS',
      period: { startDate, endDate },
      summary: {
        totalMaterialsCount: rawMaterials.length,
        totalRawValueConsumed: Number(totalRawValueConsumed.toFixed(2))
      },
      materials: materialsList,
      data: materialsList
    };
  }

  // ================= 11. KITCHEN CLOSING & SETTLEMENT REPORT =================
  if (type === 'KITCHEN_CLOSING') {
    return await getKitchenClosingStatus(startDate, endDate);
  }

  throw new Error('نوع التقرير غير مدعوم');
};

/**
 * حالة تقفيل وجرد خامات المطبخ والسندوتشات للشهر
 */
const getKitchenClosingStatus = async (startDate, endDate) => {
  // 1. مبيعات السندوتشات خلال الفترة
  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' },
    include: {
      items: {
        include: {
          product: {
            include: {
              ingredients: {
                include: { rawMaterial: true }
              }
            }
          }
        }
      }
    }
  });

  let totalSandwichesSold = 0;
  let totalSandwichRevenue = 0;
  let totalBaseCost = 0;
  const sandwichMap = {};
  const theoreticalUsageMap = {};

  invoices.forEach(inv => {
    inv.items.forEach(item => {
      if (item.product?.activityType === 'SANDWICH') {
        const qty = Number(item.quantity || 0);
        const rev = Number(item.subtotal || 0);
        const pid = item.productId;

        const ingredients = item.product.ingredients || [];
        const baseIng = ingredients.find(i => i.notes?.includes('الأساسي')) || ingredients[0];
        const baseUnitCost = baseIng 
          ? Number(baseIng.quantityPerUnit || 1) * Number(baseIng.rawMaterial?.purchasePrice || 0) 
          : Number(item.product.purchasePrice || 0);
        const itemBaseCost = qty * baseUnitCost;

        totalSandwichesSold += qty;
        totalSandwichRevenue += rev;
        totalBaseCost += itemBaseCost;

        if (!sandwichMap[pid]) {
          sandwichMap[pid] = {
            id: pid,
            name: item.product.name,
            quantity: 0,
            revenue: 0,
            baseCost: 0
          };
        }
        sandwichMap[pid].quantity += qty;
        sandwichMap[pid].revenue += rev;
        sandwichMap[pid].baseCost += itemBaseCost;

        ingredients.forEach(ing => {
          const rawId = ing.rawMaterialId;
          const required = qty * Number(ing.quantityPerUnit || 0);
          theoreticalUsageMap[rawId] = (theoreticalUsageMap[rawId] || 0) + required;
        });
      }
    });
  });

  // 2. تجميع الخامات المكملة والأساسية الخاصة بالمطبخ وقسم السندوتشات
  const sandwichRecipes = await prisma.product.findMany({
    where: { activityType: 'SANDWICH', productType: 'RECIPE' },
    include: {
      ingredients: {
        include: { rawMaterial: true }
      }
    }
  });

  const baseRawMaterialIds = new Set();
  const allSandwichRawMaterialIds = new Set();
  const auxiliaryRecipeNamesMap = {};

  sandwichRecipes.forEach(recipe => {
    const ingredients = recipe.ingredients || [];
    const baseIng = ingredients.find(i => i.notes?.includes('الأساسي')) || ingredients[0];
    if (baseIng) baseRawMaterialIds.add(baseIng.rawMaterialId);
    ingredients.forEach(ing => {
      allSandwichRawMaterialIds.add(ing.rawMaterialId);
      if (!auxiliaryRecipeNamesMap[ing.rawMaterialId]) {
        auxiliaryRecipeNamesMap[ing.rawMaterialId] = new Set();
      }
      auxiliaryRecipeNamesMap[ing.rawMaterialId].add(recipe.name);
    });
  });

  const explicitRaw = await prisma.product.findMany({
    where: { activityType: 'SANDWICH', productType: 'RAW_MATERIAL' }
  });
  explicitRaw.forEach(r => allSandwichRawMaterialIds.add(r.id));

  const allRawMaterials = await prisma.product.findMany({
    where: { id: { in: Array.from(allSandwichRawMaterialIds) } },
    include: {
      batches: true,
      inventoryMovements: {
        where: {
          createdAt: { gte: startDate, lte: endDate },
          referenceType: 'KITCHEN_SETTLEMENT'
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  // مشتريات هذه المواد خلال الفترة
  const purchases = await prisma.purchaseItem.findMany({
    where: {
      productId: { in: Array.from(allSandwichRawMaterialIds) },
      purchase: { createdAt: { gte: startDate, lte: endDate } }
    },
    include: { purchase: true }
  });

  const purchaseMap = {};
  purchases.forEach(p => {
    const pid = p.productId;
    if (!purchaseMap[pid]) {
      purchaseMap[pid] = { quantity: 0, totalCost: 0 };
    }
    purchaseMap[pid].quantity += Number(p.quantity || 0);
    purchaseMap[pid].totalCost += Number(p.subtotal || (Number(p.quantity) * Number(p.unitCost)) || 0);
  });

  let totalAuxConsumedCostSettledSoFar = 0;
  let totalPeriodPurchasesCost = 0;

  const materialsList = allRawMaterials.map(m => {
    const currentStock = m.batches.reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
    const purch = purchaseMap[m.id] || { quantity: 0, totalCost: 0 };
    totalPeriodPurchasesCost += purch.totalCost;
    const unitCost = Number(m.purchasePrice || 0);

    let settledOut = 0;
    let settledIn = 0;
    m.inventoryMovements.forEach(mov => {
      if (mov.type === 'OUT') settledOut += Number(mov.quantity || 0);
      else if (mov.type === 'IN') settledIn += Number(mov.quantity || 0);
    });
    const netSettledThisPeriod = settledOut - settledIn;
    const netSettledCost = netSettledThisPeriod * unitCost;
    totalAuxConsumedCostSettledSoFar += netSettledCost;

    const isBase = baseRawMaterialIds.has(m.id);
    const theoreticalQty = theoreticalUsageMap[m.id] || 0;
    const recipeNames = auxiliaryRecipeNamesMap[m.id] ? Array.from(auxiliaryRecipeNamesMap[m.id]) : [];

    return {
      id: m.id,
      name: m.name,
      code: m.internalCode || `#${m.id}`,
      unit: m.unit || 'قطعة',
      unitCost,
      currentStock: Number(currentStock.toFixed(3)),
      purchasedQty: Number(purch.quantity.toFixed(3)),
      purchasedCost: Number(purch.totalCost.toFixed(2)),
      isBase,
      categoryType: isBase ? 'مكون أساسي (لحوم/دجاج)' : 'خامة مكملة (مطبخ/تسوية)',
      theoreticalUsage: Number(theoreticalQty.toFixed(3)),
      theoreticalCost: Number((theoreticalQty * unitCost).toFixed(2)),
      settledInPeriod: Number(netSettledThisPeriod.toFixed(3)),
      settledCostInPeriod: Number(netSettledCost.toFixed(2)),
      actualRemaining: Number(currentStock.toFixed(3)),
      usedInSandwiches: recipeNames
    };
  });

  const auxiliaryMaterials = materialsList.filter(m => !m.isBase);
  const baseMaterials = materialsList.filter(m => m.isBase);

  return {
    reportType: 'KITCHEN_CLOSING',
    period: { startDate, endDate },
    summary: {
      totalSandwichesSold,
      totalSandwichRevenue: Number(totalSandwichRevenue.toFixed(2)),
      totalBaseCost: Number(totalBaseCost.toFixed(2)),
      sandwichGrossProfit: Number((totalSandwichRevenue - totalBaseCost).toFixed(2)),
      totalPeriodPurchasesCost: Number(totalPeriodPurchasesCost.toFixed(2)),
      totalAuxConsumedCostSettledSoFar: Number(totalAuxConsumedCostSettledSoFar.toFixed(2)),
      actualNetProfitSoFar: Number((totalSandwichRevenue - totalBaseCost - totalAuxConsumedCostSettledSoFar).toFixed(2)),
      materialsCount: materialsList.length,
      auxiliaryCount: auxiliaryMaterials.length
    },
    sandwichesBreakdown: Object.values(sandwichMap),
    materials: materialsList,
    auxiliaryMaterials,
    baseMaterials,
    data: auxiliaryMaterials
  };
};

/**
 * اعتماد تقفيلة المطبخ الشهرية وتسوية المخزن بالرصيد الفعلي
 */
const settleKitchenMonth = async (data, userId) => {
  const { startDate, endDate, notes, items } = data;

  const result = await prisma.$transaction(async (tx) => {
    let totalSettledCostConsumed = 0;
    const settledItems = [];

    for (const item of items) {
      const productId = Number(item.productId);
      const actualRemaining = Number(item.actualRemaining);
      const reason = item.reason || notes || 'تقفيل خامات المطبخ الشهرية واعتماد الجرد الفعلي';

      const product = await tx.product.findUnique({
        where: { id: productId },
        include: {
          batches: {
            where: { quantityRemaining: { not: 0 } },
            orderBy: { receivedAt: 'asc' }
          }
        }
      });

      if (!product) continue;

      const currentStock = product.batches.reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
      const difference = currentStock - actualRemaining; // > 0 means consumed, < 0 means surplus
      const unitCost = Number(product.purchasePrice || 0);

      if (Math.abs(difference) > 0.0001) {
        if (difference > 0) {
          // استهلاك: خصم الفرق من الباتشات بنظام FIFO
          let remainingToReduce = difference;
          const positiveBatches = product.batches.filter(b => Number(b.quantityRemaining) > 0);

          for (const batch of positiveBatches) {
            if (remainingToReduce <= 0) break;
            const avail = Number(batch.quantityRemaining);
            const reduce = Math.min(avail, remainingToReduce);

            await tx.batch.update({
              where: { id: batch.id },
              data: { quantityRemaining: avail - reduce }
            });
            remainingToReduce -= reduce;
          }

          if (remainingToReduce > 0) {
            await tx.batch.create({
              data: {
                productId,
                quantityRemaining: -remainingToReduce,
                unitCost
              }
            });
          }

          await tx.inventoryMovement.create({
            data: {
              productId,
              type: 'OUT',
              quantity: difference,
              balanceAfter: actualRemaining,
              referenceType: 'KITCHEN_SETTLEMENT',
              createdBy: userId
            }
          });

          await tx.inventoryCount.create({
            data: {
              productId,
              systemQuantity: currentStock,
              actualQuantity: actualRemaining,
              difference: -difference,
              reason,
              createdBy: userId
            }
          });

          const consumedCost = Number((difference * unitCost).toFixed(2));
          totalSettledCostConsumed += consumedCost;

          settledItems.push({
            productId,
            name: product.name,
            currentStock,
            actualRemaining,
            difference: -difference,
            type: 'CONSUMED',
            consumedCost
          });
        } else {
          // فائض: الفعلي أكبر من رصيد السيستم
          const surplus = Math.abs(difference);
          await tx.batch.create({
            data: {
              productId,
              quantityRemaining: surplus,
              unitCost
            }
          });

          await tx.inventoryMovement.create({
            data: {
              productId,
              type: 'IN',
              quantity: surplus,
              balanceAfter: actualRemaining,
              referenceType: 'KITCHEN_SETTLEMENT',
              createdBy: userId
            }
          });

          await tx.inventoryCount.create({
            data: {
              productId,
              systemQuantity: currentStock,
              actualQuantity: actualRemaining,
              difference: surplus,
              reason: item.reason || notes || 'فائض جرد خامات المطبخ بنهاية الشهر',
              createdBy: userId
            }
          });

          const surplusCost = Number((surplus * unitCost).toFixed(2));
          totalSettledCostConsumed -= surplusCost;

          settledItems.push({
            productId,
            name: product.name,
            currentStock,
            actualRemaining,
            difference: surplus,
            type: 'SURPLUS',
            consumedCost: -surplusCost
          });
        }
      } else {
        // مطابقة تامة
        await tx.inventoryCount.create({
          data: {
            productId,
            systemQuantity: currentStock,
            actualQuantity: actualRemaining,
            difference: 0,
            reason: reason || 'مطابقة الرصيد الفعلي للمخزن (بدون فروق)',
            createdBy: userId
          }
        });

        settledItems.push({
          productId,
          name: product.name,
          currentStock,
          actualRemaining,
          difference: 0,
          type: 'MATCHED',
          consumedCost: 0
        });
      }
    }

    // تسجيل في AuditLog
    await tx.auditLog.create({
      data: {
        action: 'KITCHEN_SETTLEMENT',
        entityType: 'INVENTORY_SETTLEMENT',
        entityId: null,
        oldValues: JSON.stringify({ itemsCount: items.length }),
        newValues: JSON.stringify({
          totalSettledCostConsumed,
          settledItemsCount: settledItems.length,
          settledItems
        }),
        userId
      }
    });

    return {
      totalSettledCostConsumed: Number(totalSettledCostConsumed.toFixed(2)),
      settledItems
    };
  });

  return result;
};

module.exports = { 
  getDashboardMetrics, 
  getSalesChartData, 
  getTopProducts, 
  getDetailedReport,
  getKitchenClosingStatus,
  settleKitchenMonth,
  calculateDivisionBreakdown
};
