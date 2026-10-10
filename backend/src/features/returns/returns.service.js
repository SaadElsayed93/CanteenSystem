const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getInvoiceByNumber = async (invoiceNumber) => {
  return prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: {
      items: { include: { product: { select: { name: true, purchasePrice: true } } } },
      patient: { select: { fullName: true, currentDebt: true } },
      returns: { include: { items: true } }
    }
  });
};

const createReturn = async (data, userId) => {
  const { invoiceId, type, returnItems, reason, paymentMethodId } = data; 
  // returnItems: [{ invoiceItemId, productId, quantity, unitPrice }]

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ 
      where: { id: invoiceId },
      include: { items: { include: { product: true } }, patient: true }
    });

    if (!invoice) throw new Error('الفاتورة غير موجودة');
    if (invoice.status === 'REFUNDED') throw new Error('هذه الفاتورة مسترجعة بالكامل مسبقاً');

    let returnTotalAmount = 0;
    const itemsToCreate = [];

    // Calculate totals and validate
    for (const rItem of returnItems) {
      const originalItem = invoice.items.find(i => i.id === rItem.invoiceItemId);
      if (!originalItem) throw new Error('أحد الأصناف غير موجود في الفاتورة الأصلية');
      
      const qty = Number(rItem.quantity);
      if (qty <= 0) throw new Error('كمية المرتجع غير صالحة');
      
      // Check if already returned some quantity
      const existingReturns = await tx.returnItem.findMany({
        where: { returnRec: { originalInvoiceId: invoiceId }, productId: rItem.productId }
      });
      const returnedQty = existingReturns.reduce((sum, ri) => sum + Number(ri.quantity), 0);
      
      if (qty + returnedQty > Number(originalItem.quantity)) {
        throw new Error('الكمية المرتجعة تتجاوز الكمية المباعة');
      }

      const subtotal = qty * Number(originalItem.unitPrice);
      returnTotalAmount += subtotal;

      itemsToCreate.push({
        productId: rItem.productId,
        quantity: qty,
        unitPrice: originalItem.unitPrice
      });
    }

    if (returnTotalAmount <= 0) throw new Error('لا توجد أصناف للاسترجاع');

    // 1. Create Return Record
    const returnRecord = await tx.return.create({
      data: {
        originalInvoiceId: invoiceId,
        type, // "FULL" or "PARTIAL"
        amount: returnTotalAmount,
        reason,
        status: 'COMPLETED',
        createdBy: userId
      }
    });

    // 2. Process Items (Add to Stock and create movements)
    for (const item of itemsToCreate) {
      await tx.returnItem.create({
        data: {
          returnId: returnRecord.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }
      });

      const product = await tx.product.findUnique({ where: { id: item.productId } });

      // Create a new batch for returned items using current purchase price
      const newBatch = await tx.batch.create({
        data: {
          productId: item.productId,
          quantityRemaining: item.quantity,
          unitCost: product.purchasePrice,
        }
      });

      // Calculate balance after
      const currentMovements = await tx.inventoryMovement.findMany({ where: { productId: item.productId } });
      const balance = currentMovements.reduce((acc, mov) => {
        return mov.type === 'IN' ? acc + Number(mov.quantity) : acc - Number(mov.quantity);
      }, 0);

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          batchId: newBatch.id,
          type: 'IN', // Return adds to stock
          quantity: item.quantity,
          balanceAfter: balance + item.quantity,
          referenceType: 'RETURN',
          referenceId: returnRecord.id,
          createdBy: userId
        }
      });
    }

    // 3. Handle Financials
    if (invoice.paymentType === 'CASH') {
      if (!paymentMethodId) throw new Error('يجب اختيار الخزينة لرد المبلغ النقدي');
      
      const method = await tx.paymentMethod.findUnique({ where: { id: paymentMethodId } });
      if (!method) throw new Error('الخزينة غير صحيحة');

      await tx.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { currentBalance: Number(method.currentBalance) - returnTotalAmount } // Money going OUT of treasury
      });

      await tx.treasuryTransaction.create({
        data: {
          paymentMethodId,
          type: 'OUT',
          amount: returnTotalAmount,
          description: `مرتجع مبيعات للفاتورة #${invoice.invoiceNumber}`,
          referenceType: 'RETURN',
          referenceId: returnRecord.id,
          createdBy: userId
        }
      });
    } else if (invoice.paymentType === 'CREDIT') {
      if (invoice.patientId) {
        const patient = await tx.patient.findUnique({ where: { id: invoice.patientId } });
        await tx.patient.update({
          where: { id: patient.id },
          data: { currentDebt: Number(patient.currentDebt) + returnTotalAmount } // Increase balance
        });

        await tx.patientTransaction.create({
          data: {
            patientId: patient.id,
            type: 'REFUND',
            amount: returnTotalAmount,
            description: `مرتجع مبيعات آجل للفاتورة #${invoice.invoiceNumber}`,
            referenceType: 'RETURN',
            referenceId: returnRecord.id,
            createdBy: userId
          }
        });
      }
    }

    // 4. Update Invoice Status if FULL return
    if (type === 'FULL') {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'REFUNDED' }
      });
    } else {
      // Check if all items are fully returned now
      const allReturns = await tx.return.findMany({
        where: { originalInvoiceId: invoiceId },
        include: { items: true }
      });
      const totalReturnedAmount = allReturns.reduce((sum, r) => sum + Number(r.amount), 0) + returnTotalAmount;
      
      if (totalReturnedAmount >= Number(invoice.totalAmount)) {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: 'REFUNDED' }
        });
      }
    }


    // 5. Explicit Audit Log for Return
    const returnedItemsText = itemsToCreate.map(i => {
      const originalItem = invoice.items.find(invI => invI.productId === i.productId);
      const productName = originalItem?.product?.name || 'صنف غير معروف';
      return `${i.quantity}x ${productName}`;
    }).join('، ');

    const auditNewValues = {
      'رقم الفاتورة الأصلية': invoice.invoiceNumber,
      'نوع المرتجع': type === 'FULL' ? 'مرتجع كلي' : 'مرتجع جزئي',
      'قيمة المرتجع': `${returnTotalAmount} ج.م`,
      'الأصناف المرتجعة': returnedItemsText,
      'تأثير الخزينة/الحساب': invoice.paymentType === 'CASH' ? 'خصم نقدي من الخزينة' : `رد قيمة لمديونية المريض (${invoice.patient?.fullName || 'غير معروف'})`,
      'سبب الاسترجاع': reason || 'غير محدد'
    };

    await tx.auditLog.create({
      data: {
        action: 'RETURN',
        entityType: 'RETURN',
        entityId: returnRecord.id,
        newValues: JSON.stringify(auditNewValues),
        createdBy: userId
      }
    });

    return returnRecord;
  });
};

module.exports = { getInvoiceByNumber, createReturn };
