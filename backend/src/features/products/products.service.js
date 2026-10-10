const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllProducts = async () => {
  return prisma.product.findMany({
    include: {
      batches: {
        orderBy: { receivedAt: 'asc' } // FIFO
      }
    }
  });
};

const getProductById = async (id) => {
  return prisma.product.findUnique({
    where: { id },
    include: {
      batches: {
        orderBy: { receivedAt: 'asc' }
      }
    }
  });
};

const createProduct = async (data, userId) => {
  const { name, internalCode, barcode, sellingPrice, purchasePrice, unit, packageUnit, piecesPerPackage, conversionFactor, alertThreshold } = data;
  
  const existingCode = await prisma.product.findUnique({ where: { internalCode } });
  if (existingCode) throw new Error('الكود الداخلي مستخدم مسبقاً');

  return prisma.product.create({
    data: {
      name,
      internalCode,
      barcode,
      sellingPrice: Number(sellingPrice),
      purchasePrice: Number(purchasePrice),
      unit,
      packageUnit: packageUnit || null,
      piecesPerPackage: piecesPerPackage ? Number(piecesPerPackage) : 1,
      conversionFactor: Number(conversionFactor || 1),
      alertThreshold: Number(alertThreshold || 0),
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

  const { name, internalCode, barcode, sellingPrice, purchasePrice, unit, packageUnit, piecesPerPackage, conversionFactor, alertThreshold, isActive } = data;
  
  if (internalCode !== product.internalCode) {
    const existingCode = await prisma.product.findUnique({ where: { internalCode } });
    if (existingCode) throw new Error('الكود الداخلي مستخدم مسبقاً');
  }

  const newSellingPrice = Number(sellingPrice);
  const oldSellingPrice = Number(product.sellingPrice);
  
  let updateData = {
    name, internalCode, barcode, unit, 
    packageUnit: packageUnit || null,
    piecesPerPackage: piecesPerPackage ? Number(piecesPerPackage) : 1,
    conversionFactor: Number(conversionFactor || 1), 
    alertThreshold: Number(alertThreshold || 0), 
    isActive,
    purchasePrice: Number(purchasePrice)
  };

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

  // In real scenario, we should handle batch logic here for adjustments (FIFO), but for manual adjustments 
  // without a specific batch, we create a generic movement. We calculate current balance from movements or batches.
  // We'll simplify balance calculation:
  const currentMovements = await prisma.inventoryMovement.findMany({ where: { productId } });
  const balance = currentMovements.reduce((acc, mov) => {
    return mov.type === 'IN' ? acc + Number(mov.quantity) : acc - Number(mov.quantity);
  }, 0);

  let newBalance = balance;
  if (type === 'IN') {
    newBalance += qty;
    // Create a manual batch
    await prisma.batch.create({
      data: {
        productId,
        quantityRemaining: qty,
        unitCost: product.purchasePrice
      }
    });
  } else {
    newBalance -= qty;
    // Logic to reduce from batches (FIFO)
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
      type: type, // "IN" or "OUT"
      quantity: qty,
      balanceAfter: newBalance,
      referenceType: 'ADJUSTMENT',
      createdBy: userId
    }
  });

  return movement;
};

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, adjustInventory };
