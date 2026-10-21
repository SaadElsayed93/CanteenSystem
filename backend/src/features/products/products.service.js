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

/**
 * التحقق من صلاحية المستخدم كمدير/أدمن
 */
const checkUserIsAdmin = async (userId) => {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    include: { role: true }
  });
  if (!user) return false;
  if (user.username === 'admin') return true;

  let permissions = [];
  try {
    permissions = JSON.parse(user.role?.permissions || '[]');
  } catch (e) {
    permissions = user.role?.permissions || [];
  }

  const roleName = user.role?.name || '';
  return permissions.includes('ALL') || roleName === 'مدير' || roleName === 'أدمن' || roleName === 'ADMIN';
};

/**
 * حساب تفاصيل الوصفة: التكلفة الإجمالية للحصة الواحدة،
 * وعدد الحصص المتاحة للتحضير والبيع حالياً وفق رصيد المواد الخام بالمخزن.
 * في السندوتشات: يتم حساب الحصص المتاحة فورياً بناءً على رصيد المادة الأساسية فقط.
 */
const calculateRecipeStats = (product) => {
  if (!product.ingredients || product.ingredients.length === 0) {
    return {
      calculatedCost: 0,
      maxAvailablePortions: 0,
      ingredientsWithStats: []
    };
  }

  let totalCost = 0;
  let maxPortions = Infinity;

  const isSandwich = product.activityType === 'SANDWICH';
  const baseIng = isSandwich
    ? ((product.ingredients || []).find(i => i.notes?.includes('الأساسي')) || product.ingredients[0])
    : null;

  const ingredientsWithStats = product.ingredients.map(ing => {
    const raw = ing.rawMaterial || {};
    const rawStock = (raw.batches || []).reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
    const qtyPerUnit = Number(ing.quantityPerUnit || 0);
    const unitPurchasePrice = Number(raw.purchasePrice || 0);
    const itemCost = qtyPerUnit * unitPurchasePrice;
    totalCost += itemCost;

    const isBase = isSandwich ? (ing.id === baseIng?.id || ing.rawMaterialId === baseIng?.rawMaterialId) : true;

    let possiblePortions = 0;
    if (qtyPerUnit > 0) {
      possiblePortions = Math.floor(rawStock / qtyPerUnit);
      // في السندوتشات: الحصص المتاحة للبيع تعتمد على المادة الأساسية فقط (البرجر/الستربس)
      if (isBase && possiblePortions < maxPortions) {
        maxPortions = possiblePortions;
      }
    }

    return {
      id: ing.id,
      rawMaterialId: ing.rawMaterialId,
      rawMaterialName: raw.name || 'مكون غير معروف',
      rawMaterialCode: raw.internalCode || '',
      rawMaterialUnit: raw.unit || 'قطعة',
      rawMaterialPurchasePrice: unitPurchasePrice,
      rawMaterialStock: rawStock,
      quantityPerUnit: qtyPerUnit,
      itemCost: Number(itemCost.toFixed(4)),
      possiblePortions: qtyPerUnit > 0 ? possiblePortions : 0,
      isBaseIngredient: isBase,
      notes: ing.notes || null
    };
  });

  if (maxPortions === Infinity) {
    maxPortions = 0;
  }

  return {
    calculatedCost: Number(totalCost.toFixed(2)),
    maxAvailablePortions: maxPortions,
    ingredientsWithStats
  };
};

const formatProductOutput = (p) => {
  const isRaw = p.productType === 'RAW_MATERIAL';
  const directStock = (p.batches || []).reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
  const expiryInfo = calculateExpiryInfo(p);
  const recipeStats = calculateRecipeStats(p);

  const isRecipe = p.productType === 'RECIPE';
  const totalStock = isRecipe ? recipeStats.maxAvailablePortions : directStock;
  const effectiveCost = isRecipe ? (Number(p.purchasePrice) > 0 ? Number(p.purchasePrice) : recipeStats.calculatedCost) : Number(p.purchasePrice || 0);
  // المواد الخام ليس لها سعر بيع أو ربح
  const sellingPrice = isRaw ? 0 : Number(p.sellingPrice || 0);
  const profitPerUnit = isRaw ? 0 : Number((sellingPrice - effectiveCost).toFixed(2));
  const profitMargin = (sellingPrice > 0 && !isRaw) ? Number(((profitPerUnit / sellingPrice) * 100).toFixed(1)) : 0;

  return {
    ...p,
    sellingPrice,
    totalStock,
    directStock,
    calculatedCost: recipeStats.calculatedCost,
    recipeStats: isRecipe ? recipeStats : null,
    effectiveCost,
    profitPerUnit,
    profitMargin,
    ...expiryInfo
  };
};

const getAllProducts = async (filters = {}) => {
  const where = {};

  if (filters.activityType && filters.activityType !== 'ALL') {
    where.activityType = filters.activityType;
  }
  if (filters.productType && filters.productType !== 'ALL') {
    where.productType = filters.productType;
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q } },
      { internalCode: { contains: q } },
      { barcode: { contains: q } }
    ];
  }
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive === 'true' || filters.isActive === true;
  } else if (filters.includeInactive !== 'true' && filters.includeInactive !== true) {
    where.isActive = true;
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      batches: {
        orderBy: { receivedAt: 'asc' } // FIFO
      },
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
    },
    orderBy: { name: 'asc' }
  });

  return products.map(formatProductOutput);
};

const getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: {
      batches: {
        orderBy: { receivedAt: 'asc' }
      },
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

  if (!product) return null;
  return formatProductOutput(product);
};

const createProduct = async (data, userId) => {
  const { 
    name, internalCode, barcode, sellingPrice, purchasePrice, 
    unit, packageUnit, piecesPerPackage, conversionFactor, 
    alertThreshold, expiryDate,
    activityType, productType, recipeYield, recipeNotes, ingredients
  } = data;
  
  const effectiveProductType = productType || 'SIMPLE';
  const effectiveActivityType = activityType || 'CANTEEN';
  const isRaw = effectiveProductType === 'RAW_MATERIAL';

  // تعديلات وإضافات البوفيه والسندوتشات للأدمن فقط
  if (effectiveActivityType === 'BUFFET' || effectiveActivityType === 'SANDWICH') {
    const isAdmin = await checkUserIsAdmin(userId);
    if (!isAdmin) {
      throw new Error(`عذراً، إضافة أصناف في قسم (${effectiveActivityType === 'BUFFET' ? 'البوفيه' : 'السندوتشات'}) مقتصر على الأدمن/المدير فقط.`);
    }
  }

  const existingCode = await prisma.product.findUnique({ where: { internalCode } });
  if (existingCode) throw new Error('الكود الداخلي مستخدم مسبقاً');

  let parsedExpiry = null;
  if (expiryDate && String(expiryDate).trim() !== '') {
    const parsed = new Date(expiryDate);
    if (!isNaN(parsed.getTime())) {
      parsedExpiry = parsed;
    }
  }

  const yieldCount = recipeYield ? Number(recipeYield) : 1;
  const isRecipe = effectiveProductType === 'RECIPE';

  // Calculate purchase price from ingredients if recipe and purchasePrice is 0 or omitted
  let finalPurchasePrice = Number(purchasePrice || 0);
  if (isRecipe && (!finalPurchasePrice || finalPurchasePrice <= 0) && Array.isArray(ingredients) && ingredients.length > 0) {
    let autoCost = 0;
    for (const ing of ingredients) {
      const rawMat = await prisma.product.findUnique({ where: { id: Number(ing.rawMaterialId) } });
      if (rawMat) {
        const qtyPerUnit = ing.quantityPerUnit !== undefined && ing.quantityPerUnit !== null
          ? Number(ing.quantityPerUnit)
          : (Number(ing.batchQuantity || 0) / yieldCount);
        autoCost += qtyPerUnit * Number(rawMat.purchasePrice || 0);
      }
    }
    finalPurchasePrice = Number(autoCost.toFixed(2));
  }

  // المواد الخام لا يحدد لها سعر بيع للمريض
  const finalSellingPrice = isRaw ? 0 : Number(sellingPrice || 0);

  const product = await prisma.product.create({
    data: {
      name,
      internalCode,
      barcode: barcode || null,
      sellingPrice: finalSellingPrice,
      purchasePrice: finalPurchasePrice,
      unit: unit || 'قطعة',
      packageUnit: packageUnit || null,
      piecesPerPackage: piecesPerPackage ? Number(piecesPerPackage) : 1,
      conversionFactor: Number(conversionFactor || 1),
      alertThreshold: Number(alertThreshold || 0),
      expiryDate: parsedExpiry,
      activityType: effectiveActivityType,
      productType: effectiveProductType,
      recipeYield: yieldCount,
      recipeNotes: recipeNotes || null,
      priceHistory: {
        create: {
          oldPrice: 0,
          newPrice: finalSellingPrice,
          changedBy: userId
        }
      }
    }
  });

  // Create ingredients if provided
  if (Array.isArray(ingredients) && ingredients.length > 0) {
    for (const ing of ingredients) {
      if (!ing.rawMaterialId) continue;
      const qtyPerUnit = ing.quantityPerUnit !== undefined && ing.quantityPerUnit !== null
        ? Number(ing.quantityPerUnit)
        : (Number(ing.batchQuantity || 0) / yieldCount);

      await prisma.productIngredient.create({
        data: {
          parentProductId: product.id,
          rawMaterialId: Number(ing.rawMaterialId),
          quantityPerUnit: qtyPerUnit,
          notes: ing.notes || null
        }
      });
    }
  }

  return getProductById(product.id);
};

const updateProduct = async (id, data, userId) => {
  const product = await prisma.product.findUnique({ 
    where: { id: Number(id) },
    include: { ingredients: true }
  });
  if (!product) throw new Error('الصنف غير موجود');

  const { 
    name, internalCode, barcode, sellingPrice, purchasePrice, 
    unit, packageUnit, piecesPerPackage, conversionFactor, 
    alertThreshold, isActive, expiryDate,
    activityType, productType, recipeYield, recipeNotes, ingredients
  } = data;

  // تعديلات أسعار أو مكونات البوفيه والسندوتشات للأدمن فقط
  const targetActivity = activityType !== undefined ? activityType : product.activityType;
  if (targetActivity === 'BUFFET' || targetActivity === 'SANDWICH' || product.activityType === 'BUFFET' || product.activityType === 'SANDWICH') {
    const isAdmin = await checkUserIsAdmin(userId);
    if (!isAdmin) {
      throw new Error(`عذراً، تعديل أسعار أو مكونات أصناف قسم (${targetActivity === 'BUFFET' ? 'البوفيه' : 'السندوتشات'}) مقتصر على الأدمن/المدير فقط.`);
    }
  }
  
  if (internalCode && internalCode !== product.internalCode) {
    const existingCode = await prisma.product.findUnique({ where: { internalCode } });
    if (existingCode) throw new Error('الكود الداخلي مستخدم مسبقاً');
  }

  const effectiveProductType = productType !== undefined ? productType : product.productType;
  const isRaw = effectiveProductType === 'RAW_MATERIAL';

  // المواد الخام لا يحدد لها سعر بيع للمريض
  const newSellingPrice = isRaw ? 0 : (sellingPrice !== undefined ? Number(sellingPrice) : Number(product.sellingPrice));
  const oldSellingPrice = Number(product.sellingPrice);
  
  const yieldCount = recipeYield !== undefined ? Number(recipeYield) : (Number(product.recipeYield) || 1);

  let updateData = {
    name: name !== undefined ? name : product.name, 
    internalCode: internalCode !== undefined ? internalCode : product.internalCode, 
    barcode: barcode !== undefined ? barcode : product.barcode, 
    unit: unit !== undefined ? unit : product.unit, 
    packageUnit: packageUnit !== undefined ? packageUnit : product.packageUnit,
    piecesPerPackage: piecesPerPackage !== undefined ? Number(piecesPerPackage) : product.piecesPerPackage,
    conversionFactor: conversionFactor !== undefined ? Number(conversionFactor) : product.conversionFactor, 
    alertThreshold: alertThreshold !== undefined ? Number(alertThreshold) : product.alertThreshold, 
    isActive: isActive !== undefined ? isActive : product.isActive,
    activityType: activityType !== undefined ? activityType : product.activityType,
    productType: effectiveProductType,
    recipeYield: yieldCount,
    recipeNotes: recipeNotes !== undefined ? recipeNotes : product.recipeNotes
  };

  if (purchasePrice !== undefined) {
    updateData.purchasePrice = Number(purchasePrice);
  }

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

  // Handle ingredients update if provided
  if (Array.isArray(ingredients)) {
    // Delete existing ingredients
    await prisma.productIngredient.deleteMany({
      where: { parentProductId: Number(id) }
    });

    let autoCost = 0;
    for (const ing of ingredients) {
      if (!ing.rawMaterialId) continue;
      const qtyPerUnit = ing.quantityPerUnit !== undefined && ing.quantityPerUnit !== null
        ? Number(ing.quantityPerUnit)
        : (Number(ing.batchQuantity || 0) / yieldCount);

      await prisma.productIngredient.create({
        data: {
          parentProductId: Number(id),
          rawMaterialId: Number(ing.rawMaterialId),
          quantityPerUnit: qtyPerUnit,
          notes: ing.notes || null
        }
      });

      const rawMat = await prisma.product.findUnique({ where: { id: Number(ing.rawMaterialId) } });
      if (rawMat) {
        autoCost += qtyPerUnit * Number(rawMat.purchasePrice || 0);
      }
    }

    // Auto-update purchasePrice for recipes if purchasePrice was not explicitly provided or is 0
    if (effectiveProductType === 'RECIPE' && (purchasePrice === undefined || Number(purchasePrice) === 0)) {
      updateData.purchasePrice = Number(autoCost.toFixed(2));
    }
  }

  await prisma.product.update({
    where: { id: Number(id) },
    data: updateData
  });

  return getProductById(id);
};

// Inventory Adjustments (Manual)
const adjustInventory = async (productId, quantity, type, reason, userId) => {
  const product = await prisma.product.findUnique({ where: { id: Number(productId) }, include: { batches: true } });
  if (!product) throw new Error('الصنف غير موجود');

  const qty = Number(quantity);
  if (qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');

  const currentMovements = await prisma.inventoryMovement.findMany({ where: { productId: Number(productId) } });
  const balance = currentMovements.reduce((acc, mov) => {
    return mov.type === 'IN' ? acc + Number(mov.quantity) : acc - Number(mov.quantity);
  }, 0);

  let newBalance = balance;
  if (type === 'IN') {
    newBalance += qty;
    await prisma.batch.create({
      data: {
        productId: Number(productId),
        quantityRemaining: qty,
        unitCost: product.purchasePrice,
        expiryDate: product.expiryDate || null
      }
    });
  } else {
    newBalance -= qty;
    let remainingToReduce = qty;
    const availableBatches = await prisma.batch.findMany({
      where: { productId: Number(productId), quantityRemaining: { gt: 0 } },
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
      productId: Number(productId),
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

/**
 * الحصول على كافة الأصناف المؤهلة للاستخدام كمواد خام (RAW_MATERIAL أو SIMPLE)
 */
const getRawMaterials = async () => {
  const products = await prisma.product.findMany({
    where: {
      productType: { in: ['RAW_MATERIAL', 'SIMPLE'] },
      isActive: true
    },
    include: {
      batches: {
        where: { quantityRemaining: { gt: 0 } }
      }
    },
    orderBy: { name: 'asc' }
  });

  return products.map(p => {
    const totalStock = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    return {
      id: p.id,
      name: p.name,
      internalCode: p.internalCode,
      unit: p.unit,
      purchasePrice: Number(p.purchasePrice),
      sellingPrice: Number(p.sellingPrice),
      activityType: p.activityType,
      productType: p.productType,
      totalStock
    };
  });
};

/**
 * الحصول على كافة الأصناف المركبة (RECIPES)
 */
const getRecipes = async () => {
  return getAllProducts({ productType: 'RECIPE' });
};

/**
 * تفاصيل وصفة صنف معين
 */
const getRecipe = async (productId) => {
  const product = await getProductById(productId);
  if (!product) throw new Error('الصنف غير موجود');
  return {
    productId: product.id,
    name: product.name,
    internalCode: product.internalCode,
    activityType: product.activityType,
    productType: product.productType,
    recipeYield: product.recipeYield || 1,
    recipeNotes: product.recipeNotes,
    sellingPrice: product.sellingPrice,
    purchasePrice: product.purchasePrice,
    calculatedCost: product.calculatedCost,
    profitPerUnit: product.profitPerUnit,
    profitMargin: product.profitMargin,
    maxAvailablePortions: product.totalStock,
    ingredients: product.recipeStats ? product.recipeStats.ingredientsWithStats : []
  };
};

/**
 * حفظ أو تعديل وصفة صنف معين
 */
const saveRecipe = async (productId, recipeData, userId) => {
  const { recipeYield, recipeNotes, ingredients, sellingPrice } = recipeData;
  return updateProduct(Number(productId), {
    productType: 'RECIPE',
    recipeYield: recipeYield || 1,
    recipeNotes,
    ingredients: ingredients || [],
    sellingPrice: sellingPrice !== undefined ? sellingPrice : undefined
  }, userId);
};

/**
 * حذف صنف مع التحقق الصارم من رصيد المخزن ومنع الحذف في حالة وجود رصيد متبقي
 */
const deleteProduct = async (id, userId) => {
  const productId = Number(id);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      batches: true,
      usedAsIngredientIn: {
        include: {
          parentProduct: {
            select: { id: true, name: true, isActive: true }
          }
        }
      },
      invoiceItems: { select: { id: true }, take: 1 },
      purchaseItems: { select: { id: true }, take: 1 },
      returnItems: { select: { id: true }, take: 1 },
      ingredients: { select: { id: true } }
    }
  });

  if (!product) {
    throw new Error('الصنف المراد حذفه غير موجود');
  }

  // 1. التحقق من رصيد المخزن الفعلي: ممنوع حذف أي صنف لديه رصيد متبقي
  const directStock = (product.batches || []).reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
  if (directStock > 0) {
    throw new Error(`لا يمكن حذف الصنف (${product.name}) لوجود رصيد متبقي منه بالمخزن (${directStock} ${product.unit}). يرجى تسوية أو تصفير رصيد المخزن أولاً قبل الحذف.`);
  }
  if (directStock < 0) {
    throw new Error(`لا يمكن حذف الصنف (${product.name}) لوجود رصيد سالب بالمخزن (${directStock} ${product.unit}). يرجى تسوية رصيد المخزن أولاً.`);
  }

  // 2. التحقق مما إذا كان الصنف مستخدماً كمادة خام في وصفات نشطة
  const activeDependentRecipes = (product.usedAsIngredientIn || [])
    .filter(u => u.parentProduct && u.parentProduct.isActive)
    .map(u => u.parentProduct.name);

  if (activeDependentRecipes.length > 0) {
    const recipeNames = [...new Set(activeDependentRecipes)].join('، ');
    throw new Error(`لا يمكن حذف الصنف (${product.name}) لأنه مستخدم كمكون أساسي في وصفات نشطة: (${recipeNames}). يرجى إزالته من تلك الوصفات أولاً.`);
  }

  // 3. استراتيجية الحذف:
  // إذا كان للصنف معاملات مالية سابقة (فواتير بيع أو شراء أو مرتجعات)، يتم إلغاء التفعيل والأرشفة لحماية التقارير المحاسبية
  const hasHistory = (product.invoiceItems && product.invoiceItems.length > 0) ||
                     (product.purchaseItems && product.purchaseItems.length > 0) ||
                     (product.returnItems && product.returnItems.length > 0);

  if (hasHistory) {
    const timestamp = Date.now();
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          isActive: false,
          internalCode: `${product.internalCode}_ARCHIVED_${timestamp}`,
          barcode: product.barcode ? `${product.barcode}_ARCHIVED_${timestamp}` : null
        }
      });

      // إزالة روابط المكونات الخاصة بهذه الوصفة
      await tx.productIngredient.deleteMany({
        where: { parentProductId: productId }
      });
    });

    return {
      success: true,
      type: 'SOFT_DELETE',
      message: `تم إلغاء تفعيل وأرشفة الصنف (${product.name}) بنجاح لحماية التقارير المالية التاريخية.`,
      data: { id: productId, name: product.name }
    };
  } else {
    // إذا لم يكن هناك تاريخ معاملات بيع/شراء، يتم الحذف النهائي الكامل (Hard Delete)
    await prisma.$transaction(async (tx) => {
      await tx.productIngredient.deleteMany({
        where: { OR: [{ parentProductId: productId }, { rawMaterialId: productId }] }
      });

      await tx.inventoryMovement.deleteMany({
        where: { productId }
      });

      await tx.inventoryCount.deleteMany({
        where: { productId }
      });

      await tx.priceHistory.deleteMany({
        where: { productId }
      });

      await tx.batch.deleteMany({
        where: { productId }
      });

      await tx.product.delete({
        where: { id: productId }
      });
    });

    return {
      success: true,
      type: 'HARD_DELETE',
      message: `تم حذف الصنف (${product.name}) نهائياً بنجاح من النظام.`,
      data: { id: productId, name: product.name }
    };
  }
};

module.exports = { 
  getAllProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  adjustInventory,
  getExpiryAlerts,
  calculateExpiryInfo,
  calculateRecipeStats,
  getRawMaterials,
  getRecipes,
  getRecipe,
  saveRecipe,
  deleteProduct
};
