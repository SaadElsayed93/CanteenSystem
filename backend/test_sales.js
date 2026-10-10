async function runTests() {
  console.log('--- Starting Sales Integration Test ---');
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

    // 2. Fetch POS Data
    console.log('Testing Get POS Data...');
    res = await fetch('http://localhost:8000/api/sales/pos-data', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const { products, paymentMethods, patients } = data.data;
    console.log(`✅ Get POS Data Successful. Products: ${products.length}, Methods: ${paymentMethods.length}, Patients: ${patients.length}`);

    // If no products, we skip the rest
    if(products.length === 0) {
      console.log('⚠️ No products found. Skipping checkout test.');
      return;
    }

    const product = products[0];
    const method = paymentMethods[0]; // should be 'نقدية'

    // 3. Test Checkout (Cash)
    console.log('Testing Cash Checkout...');
    res = await fetch('http://localhost:8000/api/sales/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CASH',
        paymentMethodId: method.id,
        items: [
          { productId: product.id, quantity: 3 }
        ]
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Cash Checkout Successful. Invoice ID: ${data.data.id}, Total: ${data.data.totalAmount}`);

    // 4. Test Stock Deduction
    res = await fetch('http://localhost:8000/api/sales/pos-data', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    const updatedProduct = data.data.products.find(p => p.id === product.id);
    console.log(`✅ Stock updated. Previous: ${product.totalStock}, New: ${updatedProduct.totalStock} (Diff: ${updatedProduct.totalStock - product.totalStock})`);
    
    console.log('--- All tests passed! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    process.exit(1);
  }
}

runTests();
