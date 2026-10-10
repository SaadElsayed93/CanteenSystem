async function runTests() {
  console.log('--- Starting Patients & Accounts Integration Test ---');
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

    // 2. Add Patient
    console.log('Testing Create Patient...');
    res = await fetch('http://localhost:8000/api/patients', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fullName: 'عسكري تيست أحمد', 
        fileNumber: `F-${Date.now()}`, 
        internalNumber: `M-${Date.now()}`, 
        notes: 'تجربة' 
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const patient = data.data;
    console.log(`✅ Create Patient Successful. ID: ${patient.id}, Debt: ${patient.currentDebt}`);

    // 3. Make Transaction (DEPOSIT - to simulate someone sent him money)
    console.log('Testing Transaction (DEPOSIT)...');
    res = await fetch('http://localhost:8000/api/patients/transaction', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: patient.id,
        type: 'DEPOSIT', // reduces debt (if debt is 0, becomes negative)
        amount: 200,
        source: 'فودافون كاش من والده',
        description: 'مصروف',
        paymentMethodId: 1 // Add to treasury
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Transaction Successful. ID: ${data.data.id}`);

    // 4. Check Updated Patient Debt (Should be -200)
    console.log('Testing Get Patient Statement...');
    res = await fetch(`http://localhost:8000/api/patients/${patient.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Get Patient Successful. Current Debt: ${data.data.currentDebt} (Expected: -200)`);
    console.log(`   Transactions count: ${data.data.transactions.length}`);

    console.log('--- All tests passed! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    process.exit(1);
  }
}

runTests();
