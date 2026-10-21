const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const productsService = require('../src/features/products/products.service');

async function runTest() {
  console.log('🧪 Starting Delete Product Verification Tests...\n');

  try {
    // 1. Get an admin user for audit
    const admin = await prisma.user.findFirst();
    if (!admin) throw new Error('No admin user found');

    // 2. Create a test product with positive stock
    console.log('--- Test 1: Stock > 0 Warning & Block ---');
    const testCode1 = 'TEST_DEL_' + Date.now();
    const prodWithStock = await prisma.product.create({
      data: {
        name: 'صنف اختبار رصيد موجب',
        internalCode: testCode1,
        sellingPrice: 15,
        purchasePrice: 10,
        unit: 'قطعة',
        activityType: 'CANTEEN',
        productType: 'SIMPLE',
        batches: {
          create: {
            quantityRemaining: 5,
            unitCost: 10
          }
        }
      }
    });

    let blockedAsExpected = false;
    try {
      await productsService.deleteProduct(prodWithStock.id, admin.id);
    } catch (err) {
      blockedAsExpected = true;
      console.log('✅ Correctly blocked deletion with message:', err.message);
    }

    if (!blockedAsExpected) {
      throw new Error('FAILED: Product with stock > 0 was NOT blocked from deletion!');
    }

    // 3. Test 2: Dependency check (Raw material used in recipe)
    console.log('\n--- Test 2: Raw Material in Active Recipe Block ---');
    const rawCode = 'RAW_DEL_' + Date.now();
    const recipeCode = 'REC_DEL_' + Date.now();

    const rawMat = await prisma.product.create({
      data: {
        name: 'مادة خام اختبارية',
        internalCode: rawCode,
        sellingPrice: 0,
        purchasePrice: 5,
        unit: 'جرام',
        activityType: 'BUFFET',
        productType: 'RAW_MATERIAL'
      }
    });

    const parentRecipe = await prisma.product.create({
      data: {
        name: 'وصفة اختبارية معتمدة على الخام',
        internalCode: recipeCode,
        sellingPrice: 20,
        purchasePrice: 5,
        unit: 'كوب',
        activityType: 'BUFFET',
        productType: 'RECIPE',
        ingredients: {
          create: {
            rawMaterialId: rawMat.id,
            quantityPerUnit: 2
          }
        }
      }
    });

    let recipeBlocked = false;
    try {
      await productsService.deleteProduct(rawMat.id, admin.id);
    } catch (err) {
      recipeBlocked = true;
      console.log('✅ Correctly blocked raw material deletion with message:', err.message);
    }

    if (!recipeBlocked) {
      throw new Error('FAILED: Raw material used in active recipe was NOT blocked from deletion!');
    }

    // 4. Test 3: Delete product with zero stock
    console.log('\n--- Test 3: Zero Stock Product Clean Delete ---');
    // First, delete the parent recipe
    const delRecipeRes = await productsService.deleteProduct(parentRecipe.id, admin.id);
    console.log('✅ Parent recipe deleted successfully:', delRecipeRes.message);

    // Now raw material is not used in any active recipe and has 0 stock -> should delete successfully
    const delRawRes = await productsService.deleteProduct(rawMat.id, admin.id);
    console.log('✅ Raw material deleted successfully:', delRawRes.message);

    // Also adjust stock of prodWithStock to 0 and verify delete
    await prisma.batch.updateMany({
      where: { productId: prodWithStock.id },
      data: { quantityRemaining: 0 }
    });
    const delStockProdRes = await productsService.deleteProduct(prodWithStock.id, admin.id);
    console.log('✅ Product with zeroed stock deleted successfully:', delStockProdRes.message);

    // 5. Verify they no longer appear in getAllProducts
    const all = await productsService.getAllProducts();
    const exists = all.some(p => p.id === prodWithStock.id || p.id === rawMat.id || p.id === parentRecipe.id);
    if (exists) {
      throw new Error('FAILED: Deleted products still appear in getAllProducts!');
    }
    console.log('✅ Verified: Deleted products are completely absent from getAllProducts()');

    console.log('\n🎉 ALL DELETE TESTS PASSED PERFECTLY!\n');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
