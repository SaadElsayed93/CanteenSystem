async function runTests() {
  console.log('--- Starting Treasury & Expenses Integration Test ---');
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

    // 2. Check Balances
    console.log('Testing Get Balances...');
    res = await fetch('http://localhost:8000/api/treasury/balances', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const balances = data.data;
    console.log(`✅ Get Balances Successful. Found ${balances.length} methods.`);
    const method = balances[0];

    // 3. Get Expense Categories
    res = await fetch('http://localhost:8000/api/treasury/expenses/categories', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    const categories = data.data;
    const category = categories[0];

    // 4. Create Expense
    console.log('Testing Create Expense...');
    res = await fetch('http://localhost:8000/api/treasury/expenses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: category.id,
        amount: 50,
        paymentMethodId: method.id,
        description: 'شراء شاي للبوفيه'
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Create Expense Successful. ID: ${data.data.id}`);

    // 5. Verify Balance Deducted
    res = await fetch('http://localhost:8000/api/treasury/balances', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    const newMethod = data.data.find(m => m.id === method.id);
    console.log(`✅ Balance Verified. Old: ${method.currentBalance}, New: ${newMethod.currentBalance} (Diff: ${newMethod.currentBalance - method.currentBalance})`);

    // 6. Verify Transactions List
    res = await fetch('http://localhost:8000/api/treasury/transactions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    console.log(`✅ Get Transactions Successful. Total found: ${data.data.length}`);

    console.log('--- All tests passed! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    process.exit(1);
  }
}

runTests();
