const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// === Suppliers ===
const getAllSuppliers = async () => {
  const suppliers = await prisma.supplier.findMany({
    include: {
      purchases: {
        select: {
          id: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
          createdAt: true
        }
      },
      payments: {
        select: {
          id: true,
          amount: true,
          createdAt: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  return suppliers.map(s => {
    const totalPurchases = s.purchases.reduce((acc, p) => acc + Number(p.totalAmount), 0);
    const totalPaid = s.purchases.reduce((acc, p) => acc + Number(p.paidAmount), 0);
    const currentDebt = totalPurchases - totalPaid;

    return {
      id: s.id,
      name: s.name,
      address: s.address,
      notes: s.notes,
      isActive: s.isActive,
      createdAt: s.createdAt,
      totalPurchases,
      totalPaid,
      totalDebt: currentDebt,
      currentDebt,
      purchasesCount: s.purchases.length
    };
  });
};

const getSupplierStatement = async (supplierId) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: Number(supplierId) },
    include: {
      purchases: {
        include: {
          items: {
            include: { product: { select: { name: true, unit: true } } }
          },
          user: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'asc' }
      },
      payments: {
        include: {
          paymentMethod: { select: { name: true } },
          user: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!supplier) throw new Error('المورد غير موجود');

  // Build unified chronological timeline
  const timeline = [];

  for (const p of supplier.purchases) {
    timeline.push({
      id: `PURCHASE-${p.id}`,
      purchaseId: p.id,
      date: p.createdAt,
      type: 'PURCHASE',
      typeName: 'فاتورة مشتريات',
      reference: p.referenceNo || `#${p.id}`,
      description: `فاتورة شراء #${p.id} (${p.items.length} أصناف)`,
      amount: Number(p.totalAmount),
      paidAmount: Number(p.paidAmount || 0),
      remainingDebt: Number(p.totalAmount) - Number(p.paidAmount || 0),
      debit: 0, // ما سُدد للمورد
      credit: Number(p.totalAmount), // استحقاق إضافي للمورد
      user: p.user?.fullName || '-',
      status: p.status,
      items: p.items.map(it => ({
        productName: it.product?.name,
        quantity: Number(it.quantity),
        unitName: it.product?.unit || 'قطعة',
        unitCost: Number(it.unitCost),
        subtotal: Number(it.subtotal)
      }))
    });
  }

  for (const pay of supplier.payments) {
    timeline.push({
      id: `PAYMENT-${pay.id}`,
      purchaseId: pay.purchaseId,
      date: pay.createdAt,
      type: 'PAYMENT',
      typeName: 'دفعة سداد نقدية',
      reference: pay.purchaseId ? `فاتورة #${pay.purchaseId}` : `سداد حساب`,
      description: `سداد للمورد عبر [${pay.paymentMethod?.name || 'الخزينة'}]`,
      amount: Number(pay.amount),
      debit: Number(pay.amount), // سداد يخفض مديونيتنا
      credit: 0,
      user: pay.user?.fullName || '-',
      paymentMethod: pay.paymentMethod?.name || '-'
    });
  }

  // Sort chronological ascending
  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute running balance (الرصيد التراكمي للمديونية)
  let runningDebt = 0;
  const entries = timeline.map(entry => {
    runningDebt += (entry.credit - entry.debit);
    return {
      ...entry,
      runningBalance: runningDebt
    };
  });

  const totalPurchases = supplier.purchases.reduce((acc, p) => acc + Number(p.totalAmount), 0);
  const totalPaid = supplier.purchases.reduce((acc, p) => acc + Number(p.paidAmount), 0);
  const currentDebt = totalPurchases - totalPaid;

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      address: supplier.address,
      notes: supplier.notes,
      isActive: supplier.isActive,
      createdAt: supplier.createdAt
    },
    summary: {
      totalPurchases,
      totalPaid,
      currentDebt
    },
    entries
  };
};

const createSupplier = async (data) => {
  const { name, address, notes } = data;
  return prisma.supplier.create({
    data: { name, address, notes }
  });
};

const updateSupplierStatus = async (id, isActive) => {
  return prisma.supplier.update({
    where: { id },
    data: { isActive }
  });
};

// === Purchases ===
const createPurchase = async (data, userId) => {
  const { supplierId, referenceNo, items, paidAmount, paymentMethodId } = data;
  
  // check supplier
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier || !supplier.isActive) throw new Error('المورد غير موجود أو معطل');

  let totalAmount = 0;
  
  // Create Purchase Invoice using a transaction
  return prisma.$transaction(async (tx) => {
    // 1. Create the Purchase record
    const purchase = await tx.supplierPurchase.create({
      data: {
        referenceNo,
        supplierId,
        totalAmount: 0, // will update later
        paidAmount: 0,  // will update later
        status: 'PENDING',
        createdBy: userId
      }
    });

    for (const item of items) {
      const subtotal = Number(item.quantity) * Number(item.unitCost);
      totalAmount += subtotal;

      // 2. Create Purchase Item
      const purchaseItem = await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          productId: item.productId,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          subtotal
        }
      });

      // 3. Update Product Purchase Price & Create Batch
      await tx.product.update({
        where: { id: item.productId },
        data: { purchasePrice: Number(item.unitCost) }
      });

      const batch = await tx.batch.create({
        data: {
          productId: item.productId,
          purchaseItemId: purchaseItem.id,
          quantityRemaining: Number(item.quantity),
          unitCost: Number(item.unitCost),
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
        }
      });

      // 4. Inventory Movement
      const currentMovements = await tx.inventoryMovement.findMany({ where: { productId: item.productId } });
      const balance = currentMovements.reduce((acc, mov) => {
        return mov.type === 'IN' ? acc + Number(mov.quantity) : acc - Number(mov.quantity);
      }, 0);

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          batchId: batch.id,
          type: 'IN',
          quantity: Number(item.quantity),
          balanceAfter: balance + Number(item.quantity),
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          createdBy: userId
        }
      });
    }

    let pAmount = Number(paidAmount || 0);
    let status = 'PENDING';
    
    // If user paid something at creation
    if (pAmount > 0) {
      if (!paymentMethodId) throw new Error('يجب تحديد الخزينة لخصم المبلغ المدفوع');
      
      const method = await tx.paymentMethod.findUnique({ where: { id: Number(paymentMethodId) } });
      if (!method) throw new Error('الخزينة غير صحيحة');
      
      status = pAmount >= totalAmount ? 'PAID' : 'PARTIAL';

      // 1. Log Payment
      const payment = await tx.supplierPayment.create({
        data: {
          purchaseId: purchase.id,
          supplierId,
          amount: pAmount,
          paymentMethodId: Number(paymentMethodId),
          createdBy: userId
        }
      });

      // 2. Reduce from Payment Method (Treasury Out)
      await tx.paymentMethod.update({
        where: { id: Number(paymentMethodId) },
        data: { currentBalance: Number(method.currentBalance) - pAmount }
      });

      // 3. Log Treasury Transaction
      const expenseDesc = `دفع فاتورة مشتريات #${purchase.id} للمورد (${supplier.name})`;
      await tx.treasuryTransaction.create({
        data: {
          paymentMethodId: Number(paymentMethodId),
          type: 'OUT',
          amount: pAmount,
          description: expenseDesc,
          referenceType: 'SUPPLIER_PAYMENT',
          referenceId: payment.id,
          createdBy: userId
        }
      });
      
      // 4. Also Record in Expenses ledger under category (سداد لمورد)
      const supplierCat = await tx.expenseCategory.upsert({
        where: { name: 'سداد لمورد' },
        update: {},
        create: { name: 'سداد لمورد', isDefault: true }
      });
      await tx.expense.create({
        data: {
          categoryId: supplierCat.id,
          amount: pAmount,
          paymentMethodId: Number(paymentMethodId),
          description: expenseDesc,
          createdBy: userId
        }
      });
    }

    // Update total amount and paid amount of purchase
    const finalPurchase = await tx.supplierPurchase.update({
      where: { id: purchase.id },
      data: { totalAmount, paidAmount: pAmount, status }
    });

    return finalPurchase;
  });
};

const paySupplier = async (data, userId) => {
  const { purchaseId, supplierId, amount, paymentMethodId } = data;
  const payAmount = Number(amount);

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: Number(supplierId) } });
    if (!supplier) throw new Error('المورد غير موجود');

    // 1. Log Payment
    const payment = await tx.supplierPayment.create({
      data: {
        purchaseId: purchaseId || null,
        supplierId: Number(supplierId),
        amount: payAmount,
        paymentMethodId: Number(paymentMethodId),
        createdBy: userId
      }
    });

    // 2. Reduce from Payment Method (Treasury Out)
    const method = await tx.paymentMethod.findUnique({ where: { id: Number(paymentMethodId) } });
    if (!method) throw new Error('طريقة الدفع غير موجودة');
    
    await tx.paymentMethod.update({
      where: { id: Number(paymentMethodId) },
      data: { currentBalance: Number(method.currentBalance) - payAmount }
    });

    const expenseDesc = purchaseId 
      ? `سداد فاتورة مشتريات #${purchaseId} للمورد (${supplier.name})`
      : `سداد حساب مديونية للمورد (${supplier.name})`;

    await tx.treasuryTransaction.create({
      data: {
        paymentMethodId: Number(paymentMethodId),
        type: 'OUT',
        amount: payAmount,
        description: expenseDesc,
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: payment.id,
        createdBy: userId
      }
    });

    // 3. Also Record in Expenses ledger under category (سداد لمورد)
    const supplierCat = await tx.expenseCategory.upsert({
      where: { name: 'سداد لمورد' },
      update: {},
      create: { name: 'سداد لمورد', isDefault: true }
    });
    await tx.expense.create({
      data: {
        categoryId: supplierCat.id,
        amount: payAmount,
        paymentMethodId: Number(paymentMethodId),
        description: expenseDesc,
        createdBy: userId
      }
    });

    // 4. If tied to a specific purchase, update it
    if (purchaseId) {
      const purchase = await tx.supplierPurchase.findUnique({ where: { id: Number(purchaseId) } });
      const newPaid = Number(purchase.paidAmount) + payAmount;
      const status = newPaid >= Number(purchase.totalAmount) ? 'PAID' : 'PARTIAL';
      await tx.supplierPurchase.update({
        where: { id: Number(purchaseId) },
        data: { paidAmount: newPaid, status }
      });
    }

    return payment;
  });
};


const getPurchaseById = async (id) => {
  const purchase = await prisma.supplierPurchase.findUnique({
    where: { id: Number(id) },
    include: {
      items: { include: { product: true } },
      supplier: true,
      user: { select: { fullName: true } }
    }
  });
  if (!purchase) throw new Error('الفاتورة غير موجودة');
  return purchase;
};

module.exports = { 
  getAllSuppliers, 
  getSupplierStatement,
  createSupplier, 
  updateSupplierStatus, 
  createPurchase, 
  paySupplier, 
  getPurchaseById 
};

