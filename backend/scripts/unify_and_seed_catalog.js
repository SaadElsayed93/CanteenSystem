/**
 * سكريبت تنظيف الداتا وتوحيد أصناف الشاي والقهوة والكوفي والسندوتشات
 * إبقاء نوع واحد فقط من كل صنف وفق معادلة الكانتين الدقيقة
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function unifyAndCleanCatalog() {
  console.log('🧹 بدء تنظيف وتوحيد أصناف الكانتين والبوفيه والمطبخ...');

  try {
    // 1. حذف المكونات القديمة والأصناف المكررة والتجريبية
    console.log('⏳ [1/4] إزالة الأصناف التجريبية والمكررة...');
    await prisma.productIngredient.deleteMany({});
    await prisma.inventoryMovement.deleteMany({});
    await prisma.batch.deleteMany({});
    await prisma.purchaseItem.deleteMany({});
    await prisma.supplierPurchase.deleteMany({});
    await prisma.invoiceItem.deleteMany({});
    await prisma.returnItem.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.return.deleteMany({});
    await prisma.priceHistory.deleteMany({});
    await prisma.inventoryCount.deleteMany({});

    // حذف المنتجات التجريبية والتالفة
    await prisma.product.deleteMany({
      where: {
        OR: [
          { internalCode: 's' },
          { internalCode: { contains: 'E2E' } },
          { internalCode: { startsWith: 'RAW-' } },
          { internalCode: { startsWith: 'REC-' } },
          { internalCode: { startsWith: 'HOT-' } },
          { internalCode: { startsWith: 'SND-' } }
        ]
      }
    });

    // 2. إنشاء المواد الخام الموحدة النظيفة (نوع واحد فقط من كل مادة خام)
    console.log('⏳ [2/4] تسجيل المواد الخام الأساسية النظيفة (نوع واحد لكل خامة)...');

    const rawSugar = await prisma.product.create({
      data: {
        name: 'سكر أبيض',
        internalCode: 'RAW-SUGAR',
        sellingPrice: 35.00,
        purchasePrice: 30.00, // 30 ج.م للكيلو
        unit: 'كيلو',
        conversionFactor: 1,
        alertThreshold: 10,
        activityType: 'BUFFET',
        productType: 'RAW_MATERIAL'
      }
    });

    const rawTea = await prisma.product.create({
      data: {
        name: 'شاي فتلة',
        internalCode: 'RAW-TEA',
        sellingPrice: 1.00,
        purchasePrice: 0.50, // 0.50 ج.م للفتلة
        unit: 'فتلة',
        conversionFactor: 1,
        alertThreshold: 50,
        activityType: 'BUFFET',
        productType: 'RAW_MATERIAL'
      }
    });

    const rawCoffee = await prisma.product.create({
      data: {
        name: 'بن قهوة',
        internalCode: 'RAW-COFFEE',
        sellingPrice: 350.00,
        purchasePrice: 300.00, // 300 ج.م للكيلو (10 جرام = 3 ج.م)
        unit: 'كيلو',
        conversionFactor: 1,
        alertThreshold: 5,
        activityType: 'BUFFET',
        productType: 'RAW_MATERIAL'
      }
    });

    const rawNescafe = await prisma.product.create({
      data: {
        name: 'كيس كوفي / نسكافيه',
        internalCode: 'RAW-NESCAFE',
        sellingPrice: 6.00,
        purchasePrice: 4.00, // 4 ج.م للكيس
        unit: 'كيس',
        conversionFactor: 1,
        alertThreshold: 30,
        activityType: 'BUFFET',
        productType: 'RAW_MATERIAL'
      }
    });

    const rawCup = await prisma.product.create({
      data: {
        name: 'كوب بلاستيك / ورقي',
        internalCode: 'RAW-CUP',
        sellingPrice: 0.75,
        purchasePrice: 0.50, // 0.50 ج.م للكوب
        unit: 'كوب',
        conversionFactor: 1,
        alertThreshold: 100,
        activityType: 'BUFFET',
        productType: 'RAW_MATERIAL'
      }
    });

    const rawBurger = await prisma.product.create({
      data: {
        name: 'قطع برجر',
        internalCode: 'RAW-BURGER',
        sellingPrice: 20.00,
        purchasePrice: 15.00, // 15 ج.م للقطعة
        unit: 'قطعة',
        conversionFactor: 1,
        alertThreshold: 20,
        activityType: 'SANDWICH',
        productType: 'RAW_MATERIAL'
      }
    });

    const rawStrips = await prisma.product.create({
      data: {
        name: 'قطع ستربس دجاج',
        internalCode: 'RAW-STRIPS',
        sellingPrice: 15.00,
        purchasePrice: 10.00, // 10 ج.م للقطعة
        unit: 'قطعة',
        conversionFactor: 1,
        alertThreshold: 20,
        activityType: 'SANDWICH',
        productType: 'RAW_MATERIAL'
      }
    });

    const rawBun = await prisma.product.create({
      data: {
        name: 'خبز برجر كايزر',
        internalCode: 'RAW-BUN',
        sellingPrice: 3.50,
        purchasePrice: 2.50, // 2.50 ج.م للرغيف
        unit: 'رغيف',
        conversionFactor: 1,
        alertThreshold: 30,
        activityType: 'SANDWICH',
        productType: 'RAW_MATERIAL'
      }
    });

    const rawFino = await prisma.product.create({
      data: {
        name: 'خبز فينو',
        internalCode: 'RAW-FINO',
        sellingPrice: 3.00,
        purchasePrice: 2.00, // 2 ج.م للرغيف
        unit: 'رغيف',
        conversionFactor: 1,
        alertThreshold: 30,
        activityType: 'SANDWICH',
        productType: 'RAW_MATERIAL'
      }
    });

    const rawVeg = await prisma.product.create({
      data: {
        name: 'طماطم وخضار وسلطة',
        internalCode: 'RAW-VEG',
        sellingPrice: 20.00,
        purchasePrice: 15.00, // 15 ج.م للكيلو
        unit: 'كيلو',
        conversionFactor: 1,
        alertThreshold: 5,
        activityType: 'SANDWICH',
        productType: 'RAW_MATERIAL'
      }
    });

    // إضافة أرصدة مخزنية أولية للمواد الخام (رصيد افتتاح جاهز)
    await prisma.batch.create({ data: { productId: rawSugar.id, quantityRemaining: 50, unitCost: 30.00 } });
    await prisma.batch.create({ data: { productId: rawTea.id, quantityRemaining: 500, unitCost: 0.50 } });
    await prisma.batch.create({ data: { productId: rawCoffee.id, quantityRemaining: 10, unitCost: 300.00 } });
    await prisma.batch.create({ data: { productId: rawNescafe.id, quantityRemaining: 200, unitCost: 4.00 } });
    await prisma.batch.create({ data: { productId: rawCup.id, quantityRemaining: 1000, unitCost: 0.50 } });
    await prisma.batch.create({ data: { productId: rawBurger.id, quantityRemaining: 100, unitCost: 15.00 } });
    await prisma.batch.create({ data: { productId: rawStrips.id, quantityRemaining: 100, unitCost: 10.00 } });
    await prisma.batch.create({ data: { productId: rawBun.id, quantityRemaining: 100, unitCost: 2.50 } });
    await prisma.batch.create({ data: { productId: rawFino.id, quantityRemaining: 100, unitCost: 2.00 } });
    await prisma.batch.create({ data: { productId: rawVeg.id, quantityRemaining: 20, unitCost: 15.00 } });

    // 3. إنشاء المشروبات الموحدة (شاي، قهوة، كوفي) بمعادلة الكانتين الدقيقة
    console.log('⏳ [3/4] إنشاء المشروبات الساخنة الموحدة (شاي، قهوة، كوفي)...');

    // أ) شاي: 100 فتلة شاي + 2 كيلو سكر + 100 كوب = 100 كوباية شاي
    // تكلفة الكوب الواحد = (1×0.50) + (0.02×30 = 0.60) + (1×0.50) = 1.60 ج.م
    const teaDrink = await prisma.product.create({
      data: {
        name: 'شاي',
        internalCode: 'REC-TEA',
        sellingPrice: 10.00,
        purchasePrice: 1.60,
        unit: 'كوب',
        activityType: 'BUFFET',
        productType: 'RECIPE',
        recipeYield: 100,
        recipeNotes: '100 فتلة شاي + 2 كيلو سكر + 100 كوب بلاستيك = 100 كوباية شاي'
      }
    });
    await prisma.productIngredient.create({ data: { parentProductId: teaDrink.id, rawMaterialId: rawTea.id, quantityPerUnit: 1 } }); // 1 فتلة
    await prisma.productIngredient.create({ data: { parentProductId: teaDrink.id, rawMaterialId: rawSugar.id, quantityPerUnit: 0.02 } }); // 20 جرام (2 كجم / 100)
    await prisma.productIngredient.create({ data: { parentProductId: teaDrink.id, rawMaterialId: rawCup.id, quantityPerUnit: 1 } }); // 1 كوب

    // ب) قهوة: 1 كيلو بن + 2 كيلو سكر + 100 كوب = 100 كوباية قهوة
    // تكلفة الكوب الواحد = (0.01×300 = 3.00) + (0.02×30 = 0.60) + (1×0.50) = 4.10 ج.م
    const coffeeDrink = await prisma.product.create({
      data: {
        name: 'قهوة',
        internalCode: 'REC-COFFEE',
        sellingPrice: 15.00,
        purchasePrice: 4.10,
        unit: 'كوب',
        activityType: 'BUFFET',
        productType: 'RECIPE',
        recipeYield: 100,
        recipeNotes: '1 كيلو بن + 2 كيلو سكر + 100 كوباية = 100 كوباية قهوة'
      }
    });
    await prisma.productIngredient.create({ data: { parentProductId: coffeeDrink.id, rawMaterialId: rawCoffee.id, quantityPerUnit: 0.01 } }); // 10 جرام بن (1 كجم / 100)
    await prisma.productIngredient.create({ data: { parentProductId: coffeeDrink.id, rawMaterialId: rawSugar.id, quantityPerUnit: 0.02 } }); // 20 جرام سكر
    await prisma.productIngredient.create({ data: { parentProductId: coffeeDrink.id, rawMaterialId: rawCup.id, quantityPerUnit: 1 } }); // 1 كوب

    // ج) كوفي: 100 كيس كوفي + 2 ك سكر + 100 كوبايه = 100 كوباية كوفي
    // تكلفة الكوب الواحد = (1×4.00) + (0.02×30 = 0.60) + (1×0.50) = 5.10 ج.م
    const nescafeDrink = await prisma.product.create({
      data: {
        name: 'كوفي',
        internalCode: 'REC-NESCAFE',
        sellingPrice: 15.00,
        purchasePrice: 5.10,
        unit: 'كوب',
        activityType: 'BUFFET',
        productType: 'RECIPE',
        recipeYield: 100,
        recipeNotes: '100 كيس كوفي + 2 ك سكر + 100 كوبايه بلاستيك = 100 كوباية كوفي'
      }
    });
    await prisma.productIngredient.create({ data: { parentProductId: nescafeDrink.id, rawMaterialId: rawNescafe.id, quantityPerUnit: 1 } }); // 1 كيس كوفي
    await prisma.productIngredient.create({ data: { parentProductId: nescafeDrink.id, rawMaterialId: rawSugar.id, quantityPerUnit: 0.02 } }); // 20 جرام سكر
    await prisma.productIngredient.create({ data: { parentProductId: nescafeDrink.id, rawMaterialId: rawCup.id, quantityPerUnit: 1 } }); // 1 كوب

    // 4. إنشاء السندوتشات الموحدة (برجر، ستربس)
    console.log('⏳ [4/4] إنشاء السندوتشات الموحدة (برجر، ستربس)...');

    // أ) سندوتش برجر: 20 قطعة برجر + 20 عيش كايزر + 1 كيلو طماطم وخضار = 20 سندوتش
    // التكلفة الإجمالية = (20×15 = 300) + (20×2.5 = 50) + (1×15 = 15) = 365 ج.م / 20 = 18.25 ج.م
    const burgerSandwich = await prisma.product.create({
      data: {
        name: 'سندوتش برجر',
        internalCode: 'REC-BURGER',
        sellingPrice: 35.00,
        purchasePrice: 18.25,
        unit: 'سندوتش',
        activityType: 'SANDWICH',
        productType: 'RECIPE',
        recipeYield: 20,
        recipeNotes: '20 قطعة برجر + 20 عيش كايزر + 1 كيلو طماطم وخضار = 20 سندوتش برجر'
      }
    });
    await prisma.productIngredient.create({ data: { parentProductId: burgerSandwich.id, rawMaterialId: rawBurger.id, quantityPerUnit: 1 } }); // 1 قطعة
    await prisma.productIngredient.create({ data: { parentProductId: burgerSandwich.id, rawMaterialId: rawBun.id, quantityPerUnit: 1 } }); // 1 عيش
    await prisma.productIngredient.create({ data: { parentProductId: burgerSandwich.id, rawMaterialId: rawVeg.id, quantityPerUnit: 0.05 } }); // 50 جرام خضار (1 كجم / 20)

    // ب) سندوتش ستربس: 20 قطعة ستربس + 20 عيش فينو + 1 كيلو طماطم وخضار = 20 سندوتش
    // التكلفة الإجمالية = (20×10 = 200) + (20×2 = 40) + (1×15 = 15) = 255 ج.م / 20 = 12.75 ج.م
    const stripsSandwich = await prisma.product.create({
      data: {
        name: 'سندوتش ستربس',
        internalCode: 'REC-STRIPS',
        sellingPrice: 30.00,
        purchasePrice: 12.75,
        unit: 'سندوتش',
        activityType: 'SANDWICH',
        productType: 'RECIPE',
        recipeYield: 20,
        recipeNotes: '20 قطعة ستربس + 20 عيش فينو + 1 كيلو طماطم وخضار = 20 سندوتش ستربس'
      }
    });
    await prisma.productIngredient.create({ data: { parentProductId: stripsSandwich.id, rawMaterialId: rawStrips.id, quantityPerUnit: 1 } }); // 1 قطعة
    await prisma.productIngredient.create({ data: { parentProductId: stripsSandwich.id, rawMaterialId: rawFino.id, quantityPerUnit: 1 } }); // 1 عيش فينو
    await prisma.productIngredient.create({ data: { parentProductId: stripsSandwich.id, rawMaterialId: rawVeg.id, quantityPerUnit: 0.05 } }); // 50 جرام خضار

    console.log('\n================================================================');
    console.log(' ✨ تم بنجاح تام تنظيف وتوحيد الكتالوج:');
    console.log('   1. شاي: نوع واحد فقط (REC-TEA)');
    console.log('   2. قهوة: نوع واحد فقط (REC-COFFEE)');
    console.log('   3. كوفي: نوع واحد فقط (REC-NESCAFE)');
    console.log('   4. سندوتش برجر: نوع واحد فقط (REC-BURGER)');
    console.log('   5. سندوتش ستربس: نوع واحد فقط (REC-STRIPS)');
    console.log('   6. المواد الخام: 10 مواد خام مضبوطة ونظيفة مع أرصدة افتتاحية');
    console.log('================================================================\n');

  } catch (error) {
    console.error('❌ خطأ في تنظيف وتوحيد الكتالوج:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

unifyAndCleanCatalog();
