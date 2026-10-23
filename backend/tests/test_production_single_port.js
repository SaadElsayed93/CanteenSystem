const app = require('../src/app');
const http = require('http');

async function testServer() {
  const server = app.listen(8000, '0.0.0.0');

  const fetchUrl = (path) => new Promise((resolve, reject) => {
    http.get(`http://localhost:8000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });

  try {
    const health = await fetchUrl('/api/health');
    console.log('Health check:', health.status, health.data);

    const root = await fetchUrl('/');
    console.log('Root frontend HTML check:', root.status, root.data.substring(0, 100));

    if (health.status === 200 && root.status === 200 && root.data.includes('<div id="root">')) {
      console.log('✅ ALL PRODUCTION SINGLE-PORT CHECKS PASSED 100%!');
    } else {
      throw new Error('Production server check failed');
    }
  } finally {
    server.close();
  }
}

testServer()
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
