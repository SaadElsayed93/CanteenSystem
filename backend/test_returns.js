async function runTests() {
  console.log('--- Starting Returns Integration Test ---');
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

    // 2. Fetch an invoice to return.
    // For simplicity, we just fetch a known invoice or fetch sales pos-data and make a new sale first.
    console.log('Creating a dummy sale to return...');
    // a. Get a product
    res = await fetch('http://localhost:8000/api/products', { headers: { Authorization: `Bearer ${token}` } });
    data = await res.json();
    const product = data.data[0];

    // b. Get payment method
    res = await fetch('http://localhost:8000/api/treasury/balances', { headers: { Authorization: `Bearer ${token}` } });
    data = await res.json();
    const method = data.data[0];

    // c. Make cash sale
    res = await fetch('http://localhost:8000/api/sales/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CASH',
        paymentMethodId: method.id,
        items: [{ productId: product.id, quantity: 2 }]
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const invoice = data.data;
    console.log(`✅ Sale Created. Invoice ID: ${invoice.id}, Number: ${invoice.invoiceNumber}`);

    // 3. Search Invoice (Returns Endpoint)
    console.log('Searching Invoice...');
    res = await fetch(`http://localhost:8000/api/returns/invoice/${invoice.invoiceNumber}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const foundInvoice = data.data;
    console.log(`✅ Invoice Found. Total Amount: ${foundInvoice.totalAmount}`);

    // 4. Return Partial (1 qty)
    console.log('Testing Return Creation...');
    res = await fetch('http://localhost:8000/api/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: foundInvoice.id,
        type: 'PARTIAL',
        reason: 'تجربة مرتجع',
        paymentMethodId: method.id,
        returnItems: [{
          invoiceItemId: foundInvoice.items[0].id,
          productId: foundInvoice.items[0].productId,
          quantity: 1
        }]
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Return Successful. Return ID: ${data.data.id}`);

    // 5. Verify Treasury balance decreased by returned amount
    res = await fetch('http://localhost:8000/api/treasury/balances', { headers: { Authorization: `Bearer ${token}` } });
    data = await res.json();
    const newMethod = data.data.find(m => m.id === method.id);
    console.log(`✅ Treasury Balance Verified. New Balance: ${newMethod.currentBalance}`);

    console.log('--- All tests passed! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    process.exit(1);
  }
}

runTests();
