const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getCategories = async () => {
  return prisma.category.findMany({ where: { isActive: true } });
};

const getPosData = async () => {
  const productsRaw = await prisma.product.findMany({
    where: { isActive: true },
    include: { batches: true }
  });
  
  const products = productsRaw.map(p => {
    const totalStock = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    return {
      id: p.id,
      name: p.name,
      internalCode: p.internalCode,
      barcode: p.barcode,
      sellingPrice: p.sellingPrice,
      totalStock
    };
  });

  const paymentMethods = await prisma.paymentMethod.findMany({ where: { isActive: true } });
  const patients = await prisma.patient.findMany({ where: { isActive: true } });

  return { products, paymentMethods, patients };
};

const createSale = async (data, userId) => {
  const { patientId, items, paymentMethodId, type } = data; // type: 'CASH' or 'CREDIT'

  if (!items || items.length === 0) throw new Error('لا توجد أصناف في الفاتورة');

  return prisma.$transaction(async (tx) => {
    let totalAmount = 0;
    
    // 1. Calculate total and check stock
    const invoiceItems = [];
    for (const item of items) {
      const product = await tx.product.findUnique({ 
        where: { id: item.productId },
        include: { batches: { where: { quantityRemaining: { gt: 0 } }, orderBy: { receivedAt: 'asc' } } }
      });
      
      if (!product) throw new Error(`صنف غير موجود: ${item.productId}`);
      
      const qtyRequired = Number(item.quantity);
      const totalStock = product.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
      
      // We allow negative stock per user requirements, but we'll fulfill from batches as much as we can.
      // If we go negative, we will still record it. But standard batches shouldn't go negative, we just let the inventory balance go negative.
      
      const subtotal = qtyRequired * Number(product.sellingPrice);
      totalAmount += subtotal;

      invoiceItems.push({
        productId: product.id,
        productName: product.name,
        quantity: qtyRequired,
        unitPrice: Number(product.sellingPrice),
        purchasePrice: Number(product.purchasePrice),
        subtotal: subtotal,
        productBatches: product.batches // to consume FIFO
      });
    }

    // 2. Patient Credit Check if type is CREDIT
    if (type === 'CREDIT') {
      if (!patientId) throw new Error('يجب تحديد المريض للبيع على حسابه');
      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      if (!patient || !patient.isActive) throw new Error('المريض غير موجود أو معطل');
      // Debt limit warning is handled in frontend or UI, we just record it.
    }

    // 3. Create Invoice
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        paymentType: type || 'CASH', // CASH or CREDIT
        cashAmount: type === 'CASH' ? totalAmount : 0,
        accountAmount: type === 'CREDIT' ? totalAmount : 0,
        totalAmount,
        status: 'COMPLETED',
        createdBy: userId,
        patientId: patientId || null,
      }
    });

    // 4. Create Items and Deduct Stock
    for (const item of invoiceItems) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal
        }
      });

      // Deduct from Batches (FIFO)
      let qtyToDeduct = item.quantity;
      for (const batch of item.productBatches) {
        if (qtyToDeduct <= 0) break;
        if (Number(batch.quantityRemaining) <= 0) continue; // Skip already negative/zero batches
        
        const available = Number(batch.quantityRemaining);
        const deduct = Math.min(available, qtyToDeduct);
        
        await tx.batch.update({
          where: { id: batch.id },
          data: { quantityRemaining: available - deduct }
        });
        qtyToDeduct -= deduct;
      }
      
      // If still qtyToDeduct > 0, it means we went into negative stock. 
      if (qtyToDeduct > 0) {
        await tx.batch.create({
          data: {
            productId: item.productId,
            quantityRemaining: -qtyToDeduct,
            unitCost: item.purchasePrice // use default purchase price for negative
          }
        });
      }

      const currentMovements = await tx.inventoryMovement.findMany({ where: { productId: item.productId } });
      const balance = currentMovements.reduce((acc, mov) => {
        return mov.type === 'IN' ? acc + Number(mov.quantity) : acc - Number(mov.quantity);
      }, 0);

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          balanceAfter: balance - item.quantity,
          referenceType: 'SALE',
          referenceId: invoice.id,
          createdBy: userId
        }
      });
    }

    // 5. If CASH, Create Payment and Treasury Transaction
    if (type === 'CASH') {
      if (!paymentMethodId) throw new Error('يجب تحديد طريقة الدفع للبيع النقدي');
      
      const method = await tx.paymentMethod.findUnique({ where: { id: paymentMethodId } });
      if (!method) throw new Error('طريقة الدفع غير صحيحة');

      await tx.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { currentBalance: Number(method.currentBalance) + totalAmount }
      });

      await tx.treasuryTransaction.create({
        data: {
          paymentMethodId,
          type: 'IN',
          amount: totalAmount,
          description: `مبيعات فاتورة رقم #${invoice.id}`,
          referenceType: 'INVOICE',
          referenceId: invoice.id,
          createdBy: userId
        }
      });
    }

    // 6. If CREDIT, Update Patient Balance
    if (type === 'CREDIT') {
      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      await tx.patient.update({
        where: { id: patientId },
        data: { currentDebt: Number(patient.currentDebt) - totalAmount }
      });
    }

    // 7. Audit Log
    await tx.auditLog.create({
      data: {
        action: 'SALE',
        entityType: 'INVOICE',
        entityId: invoice.id,
        newValues: JSON.stringify({ totalAmount, type: type === 'CASH' ? 'CASH' : 'CREDIT', itemCount: invoiceItems.length, patientName: type === 'CREDIT' ? (await tx.patient.findUnique({where: {id: patientId}})).fullName : 'غير محدد (نقدي)', itemNames: invoiceItems.map(i => i.productName).join('، ') }),
        userId: userId
      }
    });

    return invoice;
  });
};

const getInvoiceById = async (id) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: {
      items: { include: { product: true } },
      patient: true,
      user: { select: { fullName: true } }
    }
  });
  if (!invoice) throw new Error('???????? ??? ??????');
  return invoice;
};

const getRecentInvoices = async () => {
  return prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      patient: true,
      user: { select: { fullName: true, username: true } },
      items: {
        include: { product: true }
      }
    }
  });
};

module.exports = { getPosData, getCategories, createSale, getInvoiceById, getRecentInvoices };







