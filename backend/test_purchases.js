async function runTests() {
  console.log('--- Starting Purchases Integration Test ---');
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

    // 2. Add Supplier
    console.log('Testing Create Supplier...');
    res = await fetch('http://localhost:8000/api/purchases/suppliers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'مورد الجملة الأول', address: 'القاهرة', notes: 'تجربة' })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const supplier = data.data;
    console.log(`✅ Create Supplier Successful. ID: ${supplier.id}`);

    // 3. Get Products (to use in purchase)
    res = await fetch('http://localhost:8000/api/products', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    const product = data.data[0];
    
    // 4. Create Purchase Invoice
    console.log('Testing Create Purchase...');
    res = await fetch('http://localhost:8000/api/purchases', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplier.id,
        referenceNo: 'TEST-PUR-1',
        items: [
          { productId: product.id, quantity: 10, unitCost: 8.0 } // Changed cost to 8.0
        ]
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const purchase = data.data;
    console.log(`✅ Create Purchase Successful. Total Amount: ${purchase.totalAmount}`);

    // 5. Pay Supplier
    console.log('Testing Pay Supplier...');
    res = await fetch('http://localhost:8000/api/purchases/payment', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchaseId: purchase.id,
        supplierId: supplier.id,
        amount: 80,
        paymentMethodId: 1 // Assuming 1 is cash (created in seed)
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Pay Supplier Successful. Amount Paid: ${data.data.amount}`);

    // 6. Check updated product details (purchase price and stock)
    res = await fetch(`http://localhost:8000/api/products/${product.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    console.log(`✅ Product Updated. New Stock: ${data.data.totalStock}, New Purchase Price: ${data.data.purchasePrice}`);
    
    console.log('--- All tests passed! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    process.exit(1);
  }
}

runTests();
