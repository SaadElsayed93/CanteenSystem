const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const calculateExpiryInfo = (product) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let effectiveExpiryDate = product.expiryDate;
  if (!effectiveExpiryDate && product.batches && product.batches.length > 0) {
    const batchWithExpiry = product.batches
      .filter(b => b.expiryDate && Number(b.quantityRemaining) > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];
    if (batchWithExpiry) {
      effectiveExpiryDate = batchWithExpiry.expiryDate;
    }
  }

  let expiryStatus = 'NO_EXPIRY';
  let daysUntilExpiry = null;

  if (effectiveExpiryDate) {
    const exp = new Date(effectiveExpiryDate);
    exp.setHours(0, 0, 0, 0);
    daysUntilExpiry = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) {
      expiryStatus = 'EXPIRED';
    } else if (daysUntilExpiry <= 5) {
      expiryStatus = 'EXPIRING_SOON';
    } else {
      expiryStatus = 'VALID';
    }
  }

  return {
    effectiveExpiryDate,
    expiryStatus,
    daysUntilExpiry,
    isExpired: expiryStatus === 'EXPIRED',
    isExpiringSoon: expiryStatus === 'EXPIRING_SOON'
  };
};

const getAllProducts = async () => {
  const products = await prisma.product.findMany({
    include: {
      batches: {
        orderBy: { receivedAt: 'asc' } // FIFO
      }
    },
    orderBy: { name: 'asc' }
  });

  return products.map(p => {
    const totalStock = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    const expiryInfo = calculateExpiryInfo(p);
    return {
      ...p,
      totalStock,
      ...expiryInfo
    };
  });
};

const getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      batches: {
        orderBy: { receivedAt: 'asc' }
      }
    }
  });

  if (!product) return null;

  const totalStock = product.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
  const expiryInfo = calculateExpiryInfo(product);

  return {
    ...product,
    totalStock,
    ...expiryInfo
  };
};

const createProduct = async (data, userId) => {
  const { 
    name, internalCode, barcode, sellingPrice, purchasePrice, 
    unit, packageUnit, piecesPerPackage, conversionFactor, 
    alertThreshold, expiryDate 
  } = data;
  
  const existingCode = await prisma.product.findUnique({ where: { internalCode } });
  if (existingCode) throw new Error('الكود الداخلي مستخدم مسبقاً');

  let parsedExpiry = null;
  if (expiryDate && String(expiryDate).trim() !== '') {
    const parsed = new Date(expiryDate);
    if (!isNaN(parsed.getTime())) {
      parsedExpiry = parsed;
    }
  }

  return prisma.product.create({
    data: {
      name,
      internalCode,
      barcode,
      sellingPrice: Number(sellingPrice),
      purchasePrice: Number(purchasePrice),
      unit: unit || 'قطعة',
      packageUnit: packageUnit || null,
      piecesPerPackage: piecesPerPackage ? Number(piecesPerPackage) : 1,
      conversionFactor: Number(conversionFactor || 1),
      alertThreshold: Number(alertThreshold || 0),
      expiryDate: parsedExpiry,
      priceHistory: {
        create: {
          oldPrice: 0,
          newPrice: Number(sellingPrice),
          changedBy: userId
        }
      }
    }
  });
};

const updateProduct = async (id, data, userId) => {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new Error('الصنف غير موجود');

  const { 
    name, internalCode, barcode, sellingPrice, purchasePrice, 
    unit, packageUnit, piecesPerPackage, conversionFactor, 
    alertThreshold, isActive, expiryDate 
  } = data;
  
  if (internalCode !== product.internalCode) {
    const existingCode = await prisma.product.findUnique({ where: { internalCode } });
    if (existingCode) throw new Error('الكود الداخلي مستخدم مسبقاً');
  }

  const newSellingPrice = Number(sellingPrice);
  const oldSellingPrice = Number(product.sellingPrice);
  
  let updateData = {
    name, 
    internalCode, 
    barcode, 
    unit, 
    packageUnit: packageUnit || null,
    piecesPerPackage: piecesPerPackage ? Number(piecesPerPackage) : 1,
    conversionFactor: Number(conversionFactor || 1), 
    alertThreshold: Number(alertThreshold || 0), 
    isActive,
    purchasePrice: Number(purchasePrice)
  };

  if (expiryDate !== undefined) {
    if (expiryDate && String(expiryDate).trim() !== '') {
      const parsed = new Date(expiryDate);
      updateData.expiryDate = isNaN(parsed.getTime()) ? null : parsed;
    } else {
      updateData.expiryDate = null;
    }
  }

  if (newSellingPrice !== oldSellingPrice) {
    updateData.sellingPrice = newSellingPrice;
    updateData.priceHistory = {
      create: {
        oldPrice: oldSellingPrice,
        newPrice: newSellingPrice,
        changedBy: userId
      }
    };
  }

  return prisma.product.update({
    where: { id },
    data: updateData
  });
};

// Inventory Adjustments (Manual)
const adjustInventory = async (productId, quantity, type, reason, userId) => {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { batches: true } });
  if (!product) throw new Error('الصنف غير موجود');

  const qty = Number(quantity);
  if (qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');

  const currentMovements = await prisma.inventoryMovement.findMany({ where: { productId } });
  const balance = currentMovements.reduce((acc, mov) => {
    return mov.type === 'IN' ? acc + Number(mov.quantity) : acc - Number(mov.quantity);
  }, 0);

  let newBalance = balance;
  if (type === 'IN') {
    newBalance += qty;
    await prisma.batch.create({
      data: {
        productId,
        quantityRemaining: qty,
        unitCost: product.purchasePrice,
        expiryDate: product.expiryDate || null
      }
    });
  } else {
    newBalance -= qty;
    let remainingToReduce = qty;
    const availableBatches = await prisma.batch.findMany({
      where: { productId, quantityRemaining: { gt: 0 } },
      orderBy: { receivedAt: 'asc' }
    });

    for (const batch of availableBatches) {
      if (remainingToReduce <= 0) break;
      const reduceQty = Math.min(Number(batch.quantityRemaining), remainingToReduce);
      await prisma.batch.update({
        where: { id: batch.id },
        data: { quantityRemaining: Number(batch.quantityRemaining) - reduceQty }
      });
      remainingToReduce -= reduceQty;
    }
  }

  const movement = await prisma.inventoryMovement.create({
    data: {
      productId,
      type: type,
      quantity: qty,
      balanceAfter: newBalance,
      referenceType: 'ADJUSTMENT',
      createdBy: userId
    }
  });

  return movement;
};

const getExpiryAlerts = async () => {
  const products = await getAllProducts();
  const expired = products.filter(p => p.isExpired);
  const expiringSoon = products.filter(p => p.isExpiringSoon);

  return {
    expiredCount: expired.length,
    expiringSoonCount: expiringSoon.length,
    totalAlerts: expired.length + expiringSoon.length,
    expired,
    expiringSoon
  };
};

module.exports = { 
  getAllProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  adjustInventory,
  getExpiryAlerts,
  calculateExpiryInfo
};
