require('dotenv').config();
const app = require('./app');
const { PrismaClient } = require('@prisma/client');
const os = require('os');

const PORT = process.env.PORT || 8000;

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, ip: iface.address });
      }
    }
  }
  return ips;
}

// Test DB Connection
const prisma = new PrismaClient();

async function startServer() {
  try {
    await prisma.$connect();
    
    app.listen(PORT, '0.0.0.0', () => {
      const localIPs = getLocalIPs();
      console.log('\n========================================================================');
      console.log('🏥 منظومة إدارة الكانتين والبوفيه - المستشفى العسكري ق.م بالإسماعيلية');
      console.log('========================================================================');
      console.log('✅ متصل بقاعدة البيانات بنجاح (SQLite: dev.db)');
      console.log('🚀 السيرفر يعمل الآن وجاهز لاستقبال الاتصالات:');
      console.log(`\n   📍 للفتح من هذا الجهاز الرئيسي:`);
      console.log(`      👉 http://localhost:${PORT}`);
      if (localIPs.length > 0) {
        console.log(`\n   🌐 للفتح من أي جهاز أو شاشة كاشير أو موبايل آخر على شبكة المستشفى:`);
        localIPs.forEach(net => {
          console.log(`      👉 http://${net.ip}:${PORT}  (${net.name})`);
        });
      }
      console.log('========================================================================\n');

      // Initialize automatic backup engine (Startup & Daily cron)
      try {
        const { initAutoBackupEngine } = require('./features/backups/backups.service');
        initAutoBackupEngine();
      } catch (e) {
        console.warn('⚠️ Auto Backup Engine could not be started:', e.message);
      }
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

startServer();

