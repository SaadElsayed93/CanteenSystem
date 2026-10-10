const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// === Suppliers ===
const getAllSuppliers = async () => {
  return prisma.supplier.findMany({
    include: {
      purchases: { select: { totalAmount: true, paidAmount: true } }
    }
  });
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
  const { supplierId, referenceNo, items } = data;
  
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
        paidAmount: 0,
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

    // Update total amount of purchase
    const finalPurchase = await tx.supplierPurchase.update({
      where: { id: purchase.id },
      data: { totalAmount }
    });

    return finalPurchase;
  });
};

const paySupplier = async (data, userId) => {
  const { purchaseId, supplierId, amount, paymentMethodId } = data;
  const payAmount = Number(amount);

  return prisma.$transaction(async (tx) => {
    // 1. Log Payment
    const payment = await tx.supplierPayment.create({
      data: {
        purchaseId: purchaseId || null,
        supplierId,
        amount: payAmount,
        paymentMethodId,
        createdBy: userId
      }
    });

    // 2. Reduce from Payment Method (Treasury Out)
    const method = await tx.paymentMethod.findUnique({ where: { id: paymentMethodId } });
    if (!method) throw new Error('طريقة الدفع غير موجودة');
    
    // We update balance directly in SQLite, or create a treasury transaction
    await tx.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { currentBalance: Number(method.currentBalance) - payAmount }
    });

    await tx.treasuryTransaction.create({
      data: {
        paymentMethodId,
        type: 'OUT',
        amount: payAmount,
        description: `دفع للمورد`,
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: payment.id,
        createdBy: userId
      }
    });

    // 3. If tied to a specific purchase, update it
    if (purchaseId) {
      const purchase = await tx.supplierPurchase.findUnique({ where: { id: purchaseId } });
      const newPaid = Number(purchase.paidAmount) + payAmount;
      const status = newPaid >= Number(purchase.totalAmount) ? 'PAID' : 'PARTIAL';
      await tx.supplierPurchase.update({
        where: { id: purchaseId },
        data: { paidAmount: newPaid, status }
      });
    }

    return payment;
  });
};

module.exports = { getAllSuppliers, createSupplier, updateSupplierStatus, createPurchase, paySupplier };

