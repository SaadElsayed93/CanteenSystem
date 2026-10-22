const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateExpiryInfo, calculateRecipeStats } = require('../products/products.service');

const getCategories = async () => {
  return prisma.category.findMany({ where: { isActive: true } });
};

const getPosData = async () => {
  const productsRaw = await prisma.product.findMany({
    where: { 
      isActive: true,
      productType: { not: 'RAW_MATERIAL' } // استبعاد المواد الخام نهائياً من شاشة البيع
    },
    include: { 
      batches: true,
      ingredients: {
        include: {
          rawMaterial: {
            include: {
              batches: {
                where: { quantityRemaining: { gt: 0 } }
              }
            }
          }
        }
      }
    }
  });
  
  const products = productsRaw.map(p => {
    const isRecipe = p.productType === 'RECIPE';
    let totalStock = 0;

    if (isRecipe) {
      const recipeStats = calculateRecipeStats(p);
      totalStock = recipeStats.maxAvailablePortions;
    } else {
      totalStock = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    }

    const expiryInfo = calculateExpiryInfo(p);
    return {
      id: p.id,
      name: p.name,
      internalCode: p.internalCode,
      barcode: p.barcode,
      sellingPrice: Number(p.sellingPrice),
      purchasePrice: Number(p.purchasePrice),
      activityType: p.activityType || 'CANTEEN',
      productType: p.productType || 'SIMPLE',
      unit: p.unit || 'قطعة',
      totalStock,
      expiryDate: p.expiryDate,
      ...expiryInfo
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
    // 0. Verify that a Daily Shift is currently OPEN
    const activeShift = await tx.dailyShift.findFirst({
      where: { status: 'OPEN' }
    });
    if (!activeShift) {
      throw new Error('اليومية مغلقة حالياً! يجب فتح اليومية أولاً لبدء عمليات البيع.');
    }

    let totalAmount = 0;
    
    // 1. Calculate total and validate products
    const invoiceItems = [];
    for (const item of items) {
      const product = await tx.product.findUnique({ 
        where: { id: item.productId },
        include: { 
          batches: { where: { quantityRemaining: { gt: 0 } }, orderBy: { receivedAt: 'asc' } },
          ingredients: {
            include: {
              rawMaterial: {
                include: {
                  batches: { where: { quantityRemaining: { gt: 0 } }, orderBy: { receivedAt: 'asc' } }
                }
              }
            }
          }
        }
      });
      
      if (!product) throw new Error(`صنف غير موجود: ${item.productId}`);
      if (product.productType === 'RAW_MATERIAL') {
        throw new Error(`لا يمكن بيع المادة الخام (${product.name}) مباشرة عبر شاشة البيع.`);
      }
      
      const qtyRequired = Number(item.quantity);
      const subtotal = qtyRequired * Number(product.sellingPrice);
      totalAmount += subtotal;

      invoiceItems.push({
        productId: product.id,
        productName: product.name,
        productType: product.productType || 'SIMPLE',
        activityType: product.activityType || 'CANTEEN',
        quantity: qtyRequired,
        unitPrice: Number(product.sellingPrice),
        purchasePrice: Number(product.purchasePrice),
        subtotal: subtotal,
        productBatches: product.batches || [],
        ingredients: product.ingredients || []
      });
    }

    // 2. Patient Credit Check if type is CREDIT
    if (type === 'CREDIT') {
      if (!patientId) throw new Error('يجب تحديد المريض للبيع على حسابه');
      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      if (!patient || !patient.isActive) throw new Error('المريض غير موجود أو معطل');
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
        shiftId: activeShift.id
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

      if (item.productType === 'RECIPE') {
        // في السندوتشات: يتم فقط خصم المادة الأساسية بالقطعة (مثل قطعة البرجر). 
        // أما السندوتشات ذات خامات الفريزر المفتوحة بالوزن (كالاستربس والكبدة والشاورما) فلا يخصم منها شيء يومياً وتترك لجرد الفريزر الشهري.
        const isSandwich = item.activityType === 'SANDWICH';
        const isBulkSettlement = item.recipeNotes?.includes('MONTHLY_SETTLEMENT') || 
                                 (item.ingredients || []).some(i => i.notes?.includes('تسوية') || i.notes?.includes('مفتوح'));

        const baseIng = isSandwich && !isBulkSettlement
          ? ((item.ingredients || []).find(i => i.notes?.includes('الأساسي') && !i.notes?.includes('تسوية') && !i.notes?.includes('مفتوح')) || item.ingredients[0])
          : null;

        const ingredientsToDeduct = isSandwich
          ? (baseIng ? [baseIng] : [])
          : (item.ingredients || []);

        for (const ing of ingredientsToDeduct) {
          const rawMatId = ing.rawMaterialId;
          const rawMat = ing.rawMaterial;
          const totalRawToDeduct = Number(item.quantity) * Number(ing.quantityPerUnit);

          if (totalRawToDeduct <= 0) continue;

          let remainingToDeduct = totalRawToDeduct;
          const availableBatches = await tx.batch.findMany({
            where: { productId: rawMatId, quantityRemaining: { gt: 0 } },
            orderBy: { receivedAt: 'asc' }
          });

          for (const batch of availableBatches) {
            if (remainingToDeduct <= 0) break;
            const avail = Number(batch.quantityRemaining);
            const deduct = Math.min(avail, remainingToDeduct);

            await tx.batch.update({
              where: { id: batch.id },
              data: { quantityRemaining: avail - deduct }
            });
            remainingToDeduct -= deduct;
          }

          // السماح بالرصيد السالب للمواد الخام في حال نفاذ المخزن
          if (remainingToDeduct > 0) {
            await tx.batch.create({
              data: {
                productId: rawMatId,
                quantityRemaining: -remainingToDeduct,
                unitCost: rawMat ? Number(rawMat.purchasePrice) : 0
              }
            });
          }

          // تسجيل حركة مخزنية للمادة الخام
          const currentRawMovements = await tx.inventoryMovement.findMany({ where: { productId: rawMatId } });
          const rawBalance = currentRawMovements.reduce((acc, mov) => {
            return mov.type === 'IN' ? acc + Number(mov.quantity) : acc - Number(mov.quantity);
          }, 0);

          await tx.inventoryMovement.create({
            data: {
              productId: rawMatId,
              type: 'OUT',
              quantity: totalRawToDeduct,
              balanceAfter: rawBalance - totalRawToDeduct,
              referenceType: 'SALE_RECIPE',
              referenceId: invoice.id,
              createdBy: userId
            }
          });
        }

        // تسجيل حركة إخراج للصنف النهائي المباع لأغراض التتبع والتقارير
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            balanceAfter: 0,
            referenceType: 'SALE',
            referenceId: invoice.id,
            createdBy: userId
          }
        });

      } else {
        // خصم مباشر للأصناف العادية من التشغيلات (FIFO)
        let qtyToDeduct = item.quantity;
        for (const batch of item.productBatches) {
          if (qtyToDeduct <= 0) break;
          if (Number(batch.quantityRemaining) <= 0) continue;
          
          const available = Number(batch.quantityRemaining);
          const deduct = Math.min(available, qtyToDeduct);
          
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantityRemaining: available - deduct }
          });
          qtyToDeduct -= deduct;
        }
        
        if (qtyToDeduct > 0) {
          await tx.batch.create({
            data: {
              productId: item.productId,
              quantityRemaining: -qtyToDeduct,
              unitCost: item.purchasePrice
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
        newValues: JSON.stringify({ 
          totalAmount, 
          type: type === 'CASH' ? 'CASH' : 'CREDIT', 
          itemCount: invoiceItems.length, 
          patientName: type === 'CREDIT' ? (await tx.patient.findUnique({where: {id: patientId}}))?.fullName : 'غير محدد (نقدي)', 
          itemNames: invoiceItems.map(i => i.productName).join('، ') 
        }),
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
  if (!invoice) throw new Error('الفاتورة غير موجودة');
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
