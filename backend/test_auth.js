async function runTests() {
  console.log('--- Starting Auth & Users Integration Test ---');
  try {
    // 1. Test Login with Admin
    console.log('Testing Login...');
    let res = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    let data = await res.json();
    if(!data.success) throw new Error(data.message);
    
    const token = data.data.token;
    console.log('✅ Login Successful. Token received.');

    // 2. Test Get Me
    console.log('Testing Get /me...');
    res = await fetch('http://localhost:8000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Get Me Successful. Welcome ${data.data.fullName}`);

    // 3. Test Get Users
    console.log('Testing Get /users...');
    res = await fetch('http://localhost:8000/api/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Get Users Successful. Found ${data.data.length} users.`);

    // 4. Test Get Roles
    console.log('Testing Get /roles...');
    res = await fetch('http://localhost:8000/api/users/roles', {
      headers: { Authorization: `Bearer ${token}` }
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const roles = data.data;
    console.log(`✅ Get Roles Successful. Found ${roles.length} roles.`);

    // 5. Create a new user
    console.log('Testing Create User...');
    const salesRole = roles.find(r => r.name === 'مبيعات');
    res = await fetch('http://localhost:8000/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test_sales',
        password: 'password123',
        fullName: 'موظف مبيعات',
        roleId: salesRole.id
      })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    const newUser = data.data;
    console.log(`✅ Create User Successful. Created: ${newUser.username}`);

    // 6. Test Disable User
    console.log('Testing Disable User...');
    res = await fetch(`http://localhost:8000/api/users/${newUser.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false })
    });
    data = await res.json();
    if(!data.success) throw new Error(data.message);
    console.log(`✅ Disable User Successful. isActive: ${data.data.isActive}`);
    
    console.log('--- All tests passed! ---');
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    process.exit(1);
  }
}

runTests();
