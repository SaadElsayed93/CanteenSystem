const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const productsService = require('./src/features/products/products.service');

async function runTest() {
  console.log('=== STARTING SUB-STAGE A.2 TESTS ===');

  // Find an admin user
  const admin = await prisma.user.findFirst();
  if (!admin) {
    throw new Error('No admin user found for tests');
  }

  // Helper to ensure product exists with batch stock
  async function ensureRawMaterial(name, code, price, unit, initialStock) {
    let p = await prisma.product.findUnique({ where: { internalCode: code } });
    if (!p) {
      p = await productsService.createProduct({
        name,
        internalCode: code,
        sellingPrice: price * 1.5,
        purchasePrice: price,
        unit,
        activityType: 'BUFFET',
        productType: 'RAW_MATERIAL'
      }, admin.id);
      console.log(`Created Raw Material: ${name} (${code})`);
    }

    // Add initial stock if batches empty
    const batches = await prisma.batch.findMany({ where: { productId: p.id } });
    const stock = batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    if (stock < initialStock) {
      const needed = initialStock - stock;
      await productsService.adjustInventory(p.id, needed, 'IN', 'Test initial stock', admin.id);
      console.log(`Added stock for ${name}: +${needed} ${unit}`);
    }

    return productsService.getProductById(p.id);
  }

  // 1. Setup Raw Materials
  const sugar = await ensureRawMaterial('سكر أبيض (كيلو)', 'RAW-SUGAR', 30, 'كيلو', 5); // 5 kg
  const teaBags = await ensureRawMaterial('فتلة شاي العروسة', 'RAW-TEA', 0.5, 'فتلة', 100); // 100 bags
  const cups = await ensureRawMaterial('أكواب ورقية 8 أونص', 'RAW-CUP', 0.3, 'كوب', 100); // 100 cups

  const burgerPatties = await ensureRawMaterial('قطع برجر بقري جامبو', 'RAW-BURGER', 15, 'قطعة', 20); // 20 pcs
  const buns = await ensureRawMaterial('خبز برجر سمسم', 'RAW-BUN', 3, 'رغيف', 20); // 20 buns
  const tomatoes = await ensureRawMaterial('طماطم طازجة (كيلو)', 'RAW-TOMATO', 10, 'كيلو', 2); // 2 kg

  // 2. Test getRawMaterials()
  const rawList = await productsService.getRawMaterials();
  console.log(`\nVerified getRawMaterials: found ${rawList.length} materials.`);
  const sugarInList = rawList.find(r => r.id === sugar.id);
  console.log(`Sugar stock in list: ${sugarInList.totalStock} ${sugarInList.unit}`);
  if (sugarInList.totalStock < 5) throw new Error('Sugar stock mismatch');

  // 3. Create Hot Drink Recipe (كوب شاي أحمر)
  let teaRecipe = await prisma.product.findUnique({ where: { internalCode: 'REC-TEA-01' } });
  if (teaRecipe) {
    // Delete for fresh test
    await prisma.productIngredient.deleteMany({ where: { parentProductId: teaRecipe.id } });
    await prisma.product.delete({ where: { id: teaRecipe.id } });
  }

  teaRecipe = await productsService.createProduct({
    name: 'كوب شاي فتلة مخصوص',
    internalCode: 'REC-TEA-01',
    activityType: 'BUFFET',
    productType: 'RECIPE',
    recipeYield: 100, // 100 cups per batch definition
    sellingPrice: 10,
    ingredients: [
      { rawMaterialId: teaBags.id, batchQuantity: 100, notes: '1 فتلة لكل كوب' },
      { rawMaterialId: sugar.id, batchQuantity: 2, notes: '2 كجم لكل 100 كوب = 20 جرام للكوب' },
      { rawMaterialId: cups.id, batchQuantity: 100, notes: '1 كوب لكل كوب' }
    ]
  }, admin.id);

  console.log('\n--- Created Tea Recipe ---');
  console.log(`Name: ${teaRecipe.name}`);
  console.log(`Calculated Cost: ${teaRecipe.calculatedCost} EGP (Expected: 1.40 EGP)`);
  console.log(`Selling Price: ${teaRecipe.sellingPrice} EGP`);
  console.log(`Profit Per Unit: ${teaRecipe.profitPerUnit} EGP`);
  console.log(`Profit Margin: ${teaRecipe.profitMargin}%`);
  console.log(`Max Available Portions (Stock): ${teaRecipe.totalStock} (Expected: 100 portions based on cups/tea)`);

  if (Math.abs(teaRecipe.calculatedCost - 1.4) > 0.01) {
    throw new Error(`Expected cost 1.40, got ${teaRecipe.calculatedCost}`);
  }
  if (teaRecipe.totalStock !== 100) {
    throw new Error(`Expected stock 100, got ${teaRecipe.totalStock}`);
  }

  // 4. Create Sandwich Recipe (سندوتش برجر جامبو)
  let burgerRecipe = await prisma.product.findUnique({ where: { internalCode: 'REC-BURGER-01' } });
  if (burgerRecipe) {
    await prisma.productIngredient.deleteMany({ where: { parentProductId: burgerRecipe.id } });
    await prisma.product.delete({ where: { id: burgerRecipe.id } });
  }

  burgerRecipe = await productsService.createProduct({
    name: 'سندوتش برجر لحم كلاسيك',
    internalCode: 'REC-BURGER-01',
    activityType: 'SANDWICH',
    productType: 'RECIPE',
    recipeYield: 20, // 20 sandwiches
    sellingPrice: 35,
    ingredients: [
      { rawMaterialId: burgerPatties.id, batchQuantity: 20, notes: '1 قطعة برجر' },
      { rawMaterialId: buns.id, batchQuantity: 20, notes: '1 رغيف عيش' },
      { rawMaterialId: tomatoes.id, batchQuantity: 1, notes: '1 كجم طماطم لكل 20 سندوتش = 50 جرام' }
    ]
  }, admin.id);

  console.log('\n--- Created Burger Recipe ---');
  console.log(`Name: ${burgerRecipe.name}`);
  console.log(`Calculated Cost: ${burgerRecipe.calculatedCost} EGP (Expected: 18.50 EGP)`);
  console.log(`Selling Price: ${burgerRecipe.sellingPrice} EGP`);
  console.log(`Profit Per Unit: ${burgerRecipe.profitPerUnit} EGP`);
  console.log(`Profit Margin: ${burgerRecipe.profitMargin}%`);
  console.log(`Max Available Portions (Stock): ${burgerRecipe.totalStock} (Expected: 20)`);

  if (Math.abs(burgerRecipe.calculatedCost - 18.5) > 0.01) {
    throw new Error(`Expected cost 18.50, got ${burgerRecipe.calculatedCost}`);
  }
  if (burgerRecipe.totalStock !== 20) {
    throw new Error(`Expected stock 20, got ${burgerRecipe.totalStock}`);
  }

  // 5. Test Filters and Queries
  const buffetProducts = await productsService.getAllProducts({ activityType: 'BUFFET' });
  console.log(`\nBUFFET products count: ${buffetProducts.length}`);
  const sandwichProducts = await productsService.getAllProducts({ activityType: 'SANDWICH' });
  console.log(`SANDWICH products count: ${sandwichProducts.length}`);

  const recipes = await productsService.getRecipes();
  console.log(`Total recipes found: ${recipes.length}`);

  const singleRecipe = await productsService.getRecipe(teaRecipe.id);
  console.log(`Fetched single recipe for ${singleRecipe.name}: has ${singleRecipe.ingredients.length} ingredients.`);

  console.log('\n✅ ALL SUB-STAGE A.2 TESTS PASSED PERFECTLY!');
  await prisma.$disconnect();
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
