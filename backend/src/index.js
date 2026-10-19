require('dotenv').config();
const app = require('./app');
const { PrismaClient } = require('@prisma/client');

const PORT = process.env.PORT || 8000;

// Test DB Connection
const prisma = new PrismaClient();

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to database successfully');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
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

