async function runTests() {
  console.log('--- Starting Products & Inventory Integration Test ---');
  try {
    // 1. Login
    let res = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    let data = await res.json();
    if(!data.success) throw new Error(data.message);
    const token = data.data.token;
    console.log('✅ Login Successful.');

    // 2. Create Product
    console.log('Testing Create Product...');
    res = await fetch('http://localhost:8000/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'شيبسي عائلي',
        internalCode: 'P001',
        barcode: '123456789',
        purchasePrice: 8.5,
        sellingPrice: 10,
        unit: 'كيس',
        conversionFactor: 1,
        alertThreshold: 10
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const product = data.data;
    console.log(`✅ Create Product Successful. Created: ${product.name}`);

    // 3. Get Products
    console.log('Testing Get Products...');
    res = await fetch('http://localhost:8000/api/products', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Get Products Successful. Found ${data.data.length} products. Stock: ${data.data[0].totalStock}`);

    // 4. Adjust Inventory (Add Stock)
    console.log('Testing Adjust Inventory (IN)...');
    res = await fetch(`http://localhost:8000/api/products/${product.id}/adjust`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 50, type: 'IN', reason: 'رصيد افتتاحي' })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Adjust Inventory Successful. New Balance: ${data.data.balanceAfter}`);

    // 5. Adjust Inventory (Remove Stock)
    console.log('Testing Adjust Inventory (OUT)...');
    res = await fetch(`http://localhost:8000/api/products/${product.id}/adjust`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 5, type: 'OUT', reason: 'تالف' })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Adjust Inventory Successful. New Balance: ${data.data.balanceAfter}`);

    // 6. Get Product by ID (check final stock)
    res = await fetch(`http://localhost:8000/api/products/${product.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Final Stock Check. Stock is: ${data.data.totalStock} (Expected 45)`);
    
    console.log('--- All tests passed! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    process.exit(1);
  }
}

runTests();
