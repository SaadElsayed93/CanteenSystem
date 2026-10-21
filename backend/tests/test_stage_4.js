const http = require('http');
const app = require('../src/app');

async function testSinglePortServer() {
  console.log('🧪 Testing Single-Port Unified Production Architecture (Port 8000)...');

  const server = app.listen(8001, async () => {
    try {
      // 1. Test /api/health
      const healthRes = await fetch('http://localhost:8001/api/health');
      const healthJson = await healthRes.json();
      if (healthJson.status !== 'ok') throw new Error('Health check failed');
      console.log('✅ API endpoint verified (/api/health):', healthJson);

      // 2. Test static frontend serving (index.html)
      const frontendRes = await fetch('http://localhost:8001/');
      const htmlText = await frontendRes.text();
      if (!htmlText.toLowerCase().includes('<!doctype html') && !htmlText.includes('<div id="root">')) {
        throw new Error('Frontend static serving failed');
      }
      console.log('✅ Frontend static index.html served successfully via Port 8001');

      // 3. Test SPA fallback (e.g. /products)
      const spaRes = await fetch('http://localhost:8001/products');
      const spaHtml = await spaRes.text();
      if (!spaHtml.toLowerCase().includes('<!doctype html')) {
        throw new Error('SPA fallback failed');
      }
      console.log('✅ SPA fallback for /products routing verified successfully');

      console.log('\n🎉 ALL STAGE 4 ARCHITECTURE TESTS PASSED 100%!');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('❌ Stage 4 test failed:', err);
      server.close();
      process.exit(1);
    }
  });
}

testSinglePortServer();
