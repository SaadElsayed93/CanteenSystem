const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function sanitizePath(rawPath) {
  if (!rawPath) return rawPath;
  try {
    if (fs.existsSync(rawPath)) {
      return fs.realpathSync.native ? fs.realpathSync.native(rawPath) : fs.realpathSync(rawPath);
    }
  } catch (e) {}
  let resolved = path.resolve(rawPath);
  try {
    if (fs.existsSync(resolved)) {
      return fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
    }
  } catch (e) {}
  return resolved;
}

const BACKUP_DIR = sanitizePath(path.resolve(__dirname, '../../../backups'));
const DB_FILE = sanitizePath(path.resolve(__dirname, '../../../prisma/dev.db'));
const DB_WAL = sanitizePath(path.resolve(__dirname, '../../../prisma/dev.db-wal'));
const DB_SHM = sanitizePath(path.resolve(__dirname, '../../../prisma/dev.db-shm'));

// Ensure backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Validate that a file is a valid SQLite 3 database file
 */
const validateSqliteFile = (filePath) => {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < 100) return false;
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);
    return buffer.toString().startsWith('SQLite format 3');
  } catch (err) {
    return false;
  }
};

/**
 * Clean up older backups keeping the most recent N backups (Retention Limit = 100)
 * Deletes both physical files and database records when exceeding limit
 */
const MAX_BACKUP_RETENTION = 100;

const pruneOldBackups = async (keepCount = MAX_BACKUP_RETENTION) => {
  try {
    const allBackups = await prisma.backup.findMany({
      orderBy: { createdAt: 'desc' }
    });

    if (allBackups.length > keepCount) {
      const toDelete = allBackups.slice(keepCount);
      for (const b of toDelete) {
        if (b.filepath && fs.existsSync(b.filepath)) {
          try { fs.unlinkSync(b.filepath); } catch (e) {}
        }
        await prisma.backup.delete({ where: { id: b.id } }).catch(() => {});
      }
      console.log(`[Backup Retention Engine] Pruned ${toDelete.length} old backups. Total retained: ${keepCount}.`);
    }
  } catch (err) {
    console.warn('[Backup Prune Warning]:', err.message);
  }
};

const autoPruneOldBackups = pruneOldBackups;

/**
 * Create a consistent live backup of SQLite database
 */
exports.createBackup = async ({ type = 'MANUAL', userId = 1, notes = '' } = {}) => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const filename = `canteen_backup_${dateStr}_${type}.db`;
  const targetPath = path.join(BACKUP_DIR, filename);
  const normalizedTarget = targetPath.replace(/\\/g, '/');

  try {
    // 1. Flush SQLite WAL to ensure consistency
    try {
      await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(FULL)');
    } catch (e) {
      // Ignore if not in WAL mode
    }

    // 2. Perform safe, non-blocking atomic backup using VACUUM INTO
    await prisma.$executeRawUnsafe(`VACUUM INTO '${normalizedTarget}'`);

    const stats = fs.statSync(targetPath);
    const sizeBytes = stats.size;

    // 3. Check for external USB backup path configuration
    try {
      const extSetting = await prisma.setting.findUnique({ where: { key: 'BACKUP_EXTERNAL_PATH' } });
      if (extSetting && extSetting.value && fs.existsSync(extSetting.value.trim())) {
        const extDir = extSetting.value.trim();
        const extFilePath = path.join(extDir, filename);
        fs.copyFileSync(targetPath, extFilePath);
      }
    } catch (e) {
      console.warn('[External Backup Copy Warning]:', e.message);
    }

    // 4. Save record in database
    const record = await prisma.backup.create({
      data: {
        filename,
        filepath: targetPath,
        type,
        sizeBytes: BigInt(sizeBytes),
        createdBy: Number(userId) || 1
      },
      include: {
        user: {
          select: { fullName: true, username: true }
        }
      }
    });

    // 5. Log in Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'BACKUP',
          entityId: record.id,
          newValues: JSON.stringify({
            'اسم ملف النسخة': filename,
            'النوع': type === 'AUTO' ? 'تلقائي مجدول' : type === 'SHIFT_CLOSE' ? 'تقفيل يومية' : type === 'STARTUP' ? 'وقائي عند التشغيل' : 'يدوي بطلب المدير',
            'حجم النسخة': `${(sizeBytes / (1024 * 1024)).toFixed(2)} ميجابايت`,
            'ملاحظات': notes || 'تم أخذ النسخة بنجاح'
          }),
          userId: Number(userId) || 1
        }
      });
    } catch (e) {}

    // Auto-prune old auto backups in background
    autoPruneOldBackups().catch(() => {});

    return {
      ...record,
      sizeBytes: Number(record.sizeBytes),
      sizeFormatted: `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
    };
  } catch (err) {
    console.error('[Backup Creation Error]:', err);
    throw new Error(`فشل إنشاء النسخة الاحتياطية: ${err.message}`);
  }
};

/**
 * List all backups with file status and statistics
 */
exports.listBackups = async () => {
  const [backups, extSetting, schedEnabledSetting, schedTimeSetting, lastAutoRecord] = await Promise.all([
    prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { fullName: true, username: true }
        }
      }
    }),
    prisma.setting.findUnique({ where: { key: 'BACKUP_EXTERNAL_PATH' } }),
    prisma.setting.findUnique({ where: { key: 'BACKUP_SCHEDULE_ENABLED' } }),
    prisma.setting.findUnique({ where: { key: 'BACKUP_SCHEDULE_TIME' } }),
    prisma.backup.findFirst({
      where: { type: 'AUTO' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
  ]);

  const scheduleSettings = {
    enabled: schedEnabledSetting ? schedEnabledSetting.value === 'true' : true,
    time: schedTimeSetting ? schedTimeSetting.value : '00:00',
    lastAutoBackupTime: lastAutoRecord ? lastAutoRecord.createdAt : null
  };

  let totalSizeBytes = 0;
  const enriched = backups.map(b => {
    const size = Number(b.sizeBytes);
    totalSizeBytes += size;
    const safePath = sanitizePath(b.filepath);
    const exists = fs.existsSync(safePath);
    return {
      id: b.id,
      filename: b.filename,
      filepath: safePath,
      type: b.type,
      sizeBytes: size,
      sizeFormatted: `${(size / (1024 * 1024)).toFixed(2)} MB`,
      fileExists: exists,
      createdAt: b.createdAt,
      user: b.user
    };
  });

  return {
    backups: enriched,
    stats: {
      totalCount: enriched.length,
      maxRetention: MAX_BACKUP_RETENTION,
      totalSizeBytes,
      totalSizeFormatted: `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
      lastBackupTime: enriched.length > 0 ? enriched[0].createdAt : null,
      backupDir: BACKUP_DIR,
      externalPath: extSetting ? extSetting.value : null,
      schedule: scheduleSettings
    }
  };
};

/**
 * Get physical file path for download
 */
exports.getBackupFilePath = async (id) => {
  const backup = await prisma.backup.findUnique({ where: { id: Number(id) } });
  if (!backup) {
    throw new Error('النسخة الاحتياطية المطلوبة غير مسجلة بالنظام');
  }
  const safePath = sanitizePath(backup.filepath);
  if (!fs.existsSync(safePath)) {
    throw new Error('ملف النسخة الاحتياطية غير موجود على القرص الصلب');
  }
  return {
    filepath: safePath,
    filename: backup.filename
  };
};

/**
 * Delete a backup (both database record and physical file)
 */
exports.deleteBackup = async (id, userId = 1) => {
  const backup = await prisma.backup.findUnique({ where: { id: Number(id) } });
  if (!backup) {
    throw new Error('النسخة الاحتياطية غير موجودة');
  }

  // Delete physical file
  if (fs.existsSync(backup.filepath)) {
    try {
      fs.unlinkSync(backup.filepath);
    } catch (e) {
      console.warn('Could not unlink physical backup file:', e.message);
    }
  }

  // Delete DB record
  await prisma.backup.delete({ where: { id: Number(id) } });

  // Log in audit log
  try {
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'BACKUP',
        entityId: Number(id),
        newValues: JSON.stringify({
          'الملف المحذوف': backup.filename,
          'نوع النسخة': backup.type
        }),
        userId: Number(userId) || 1
      }
    });
  } catch (e) {}

  return { success: true, message: 'تم حذف النسخة الاحتياطية بنجاح' };
};

/**
 * Restore database from an existing backup with Zero-Risk Safety Net
 */
exports.restoreBackup = async ({ backupId, uploadedFilePath, userId = 1 }) => {
  let sourceFilePath = null;
  let sourceFilename = 'نسخة احتياطية';

  if (backupId) {
    const backup = await prisma.backup.findUnique({ where: { id: Number(backupId) } });
    if (!backup) {
      throw new Error('النسخة المحددة للاسترجاع غير موجودة بالنظام');
    }
    sourceFilePath = backup.filepath;
    sourceFilename = backup.filename;
  } else if (uploadedFilePath) {
    sourceFilePath = uploadedFilePath;
    sourceFilename = path.basename(uploadedFilePath);
  }

  if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
    throw new Error('ملف النسخة الاحتياطية غير موجود أو تعذر الوصول إليه');
  }

  // 1. Validate SQLite header
  if (!validateSqliteFile(sourceFilePath)) {
    throw new Error('الملف المحدد ليس ملف قاعدة بيانات كانتين (SQLite) صالح أو معطوب');
  }

  // 2. SAFETY NET: Take an emergency pre-restore snapshot of CURRENT database first!
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const safetyName = `SAFETY_NET_PRE_RESTORE_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.db`;
  const safetyPath = path.join(BACKUP_DIR, safetyName);

  try {
    if (fs.existsSync(DB_FILE)) {
      try {
        await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(FULL)');
      } catch (e) {}
      await prisma.$executeRawUnsafe(`VACUUM INTO '${safetyPath.replace(/\\/g, '/')}'`);
      
      const stats = fs.statSync(safetyPath);
      await prisma.backup.create({
        data: {
          filename: safetyName,
          filepath: safetyPath,
          type: 'SAFETY_PRE_RESTORE',
          sizeBytes: BigInt(stats.size),
          createdBy: Number(userId) || 1
        }
      });
    }
  } catch (err) {
    console.warn('[Safety Net Backup Warning]: Could not take pre-restore safety backup:', err);
  }

  // 3. Disconnect Prisma client completely
  await prisma.$disconnect();

  // 4. Overwrite dev.db with the backup file
  fs.copyFileSync(sourceFilePath, DB_FILE);

  // 5. Remove existing WAL and SHM files to prevent corruption
  if (fs.existsSync(DB_WAL)) {
    try { fs.unlinkSync(DB_WAL); } catch (e) {}
  }
  if (fs.existsSync(DB_SHM)) {
    try { fs.unlinkSync(DB_SHM); } catch (e) {}
  }

  // 6. Reconnect Prisma client
  await prisma.$connect();

  // 7. Verify integrity of restored database
  const integrityRes = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
  const isOk = Array.isArray(integrityRes) && integrityRes[0] && (integrityRes[0].integrity_check === 'ok' || Object.values(integrityRes[0])[0] === 'ok');

  if (!isOk) {
    console.error('[Restore Integrity Error]: Restored DB failed integrity check:', integrityRes);
  }

  // 8. Log in Audit Log
  try {
    await prisma.auditLog.create({
      data: {
        action: 'RESTORE',
        entityType: 'BACKUP',
        entityId: Number(backupId) || null,
        newValues: JSON.stringify({
          'النسخة المسترجعة': sourceFilename,
          'نسخة الأمان السابقة': safetyName,
          'حالة الفحص': isOk ? 'سليمة ومطابقة 100%' : 'تحذير سلامة',
          'التوقيت': new Date().toLocaleString('ar-EG')
        }),
        userId: Number(userId) || 1
      }
    });
  } catch (e) {}

  return {
    success: true,
    message: 'تم استرجاع قاعدة البيانات بنجاح تام وتشغيل النظام عليها',
    safetyBackupFilename: safetyName,
    restoredFrom: sourceFilename,
    integrityCheck: isOk ? 'ok' : 'warning'
  };
};

/**
 * Handle uploaded backup file from browser
 */
exports.handleUploadedBackup = async (file, userId = 1) => {
  if (!file || !file.path) {
    throw new Error('لم يتم استلام أي ملف');
  }

  const uploadedPath = file.path;

  // Validate file
  if (!validateSqliteFile(uploadedPath)) {
    try { fs.unlinkSync(uploadedPath); } catch (e) {}
    throw new Error('الملف المرفوع ليس ملف قاعدة بيانات كانتين (SQLite) صالح أو تالف');
  }

  // Rename and move to backups folder
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const newFilename = `canteen_uploaded_${dateStr}_${file.originalname || 'backup.db'}`;
  const finalPath = path.join(BACKUP_DIR, newFilename);

  fs.copyFileSync(uploadedPath, finalPath);
  try { fs.unlinkSync(uploadedPath); } catch (e) {}

  const stats = fs.statSync(finalPath);

  // Register in backups table
  const record = await prisma.backup.create({
    data: {
      filename: newFilename,
      filepath: finalPath,
      type: 'MANUAL',
      sizeBytes: BigInt(stats.size),
      createdBy: Number(userId) || 1
    }
  });

  return {
    id: record.id,
    filename: newFilename,
    filepath: finalPath,
    sizeBytes: stats.size,
    sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`
  };
};

/**
 * Settings: get and set external USB backup path
 */
exports.getExternalPath = async () => {
  const setting = await prisma.setting.findUnique({ where: { key: 'BACKUP_EXTERNAL_PATH' } });
  return setting ? setting.value : '';
};

exports.setExternalPath = async (externalPath) => {
  const cleanPath = (externalPath || '').trim();
  if (cleanPath && !fs.existsSync(cleanPath)) {
    try {
      fs.mkdirSync(cleanPath, { recursive: true });
    } catch (err) {
      throw new Error(`المسار المحدد غير متاح أو لا توجد صلاحيات كتابة عليه: ${err.message}`);
    }
  }

  await prisma.setting.upsert({
    where: { key: 'BACKUP_EXTERNAL_PATH' },
    update: { value: cleanPath, description: 'مسار النسخ الاحتياطي الإضافي على الفلاشة أو القرص الخارجي' },
    create: { key: 'BACKUP_EXTERNAL_PATH', value: cleanPath, description: 'مسار النسخ الاحتياطي الإضافي على الفلاشة أو القرص الخارجي' }
  });

  return { success: true, externalPath: cleanPath };
};

/**
 * Get and update automated backup schedule settings
 */
exports.getScheduleSettings = async () => {
  const [schedEnabled, schedTime, lastAutoRecord] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'BACKUP_SCHEDULE_ENABLED' } }),
    prisma.setting.findUnique({ where: { key: 'BACKUP_SCHEDULE_TIME' } }),
    prisma.backup.findFirst({
      where: { type: 'AUTO' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, filename: true, sizeBytes: true }
    })
  ]);

  return {
    enabled: schedEnabled ? schedEnabled.value === 'true' : true,
    time: schedTime ? schedTime.value : '00:00',
    lastAutoBackup: lastAutoRecord ? {
      createdAt: lastAutoRecord.createdAt,
      filename: lastAutoRecord.filename,
      sizeFormatted: `${(Number(lastAutoRecord.sizeBytes) / (1024 * 1024)).toFixed(2)} MB`
    } : null
  };
};

exports.setScheduleSettings = async ({ enabled = true, time = '00:00' }) => {
  const cleanTime = (time || '00:00').trim();
  const isEnabledStr = String(Boolean(enabled));

  await Promise.all([
    prisma.setting.upsert({
      where: { key: 'BACKUP_SCHEDULE_ENABLED' },
      update: { value: isEnabledStr, description: 'تفعيل النسخ الاحتياطي التلقائي المجدول' },
      create: { key: 'BACKUP_SCHEDULE_ENABLED', value: isEnabledStr, description: 'تفعيل النسخ الاحتياطي التلقائي المجدول' }
    }),
    prisma.setting.upsert({
      where: { key: 'BACKUP_SCHEDULE_TIME' },
      update: { value: cleanTime, description: 'توقيت النسخ الاحتياطي التلقائي اليومي (HH:mm)' },
      create: { key: 'BACKUP_SCHEDULE_TIME', value: cleanTime, description: 'توقيت النسخ الاحتياطي التلقائي اليومي (HH:mm)' }
    })
  ]);

  return exports.getScheduleSettings();
};

/**
 * Trigger an immediate test run of the automated scheduled backup
 */
exports.triggerAutoBackupNow = async (userId = 1) => {
  return exports.createBackup({
    type: 'AUTO',
    userId,
    notes: 'نسخة تلقائية مجدولة فورية (تشغيل تجريبي / يدوي)'
  });
};

/**
 * Startup and daily scheduled backups engine
 */
exports.initAutoBackupEngine = () => {
  // 1. Run protective startup backup after 10 seconds of server boot
  setTimeout(async () => {
    try {
      console.log('[Auto Backup Engine] Initializing startup protective backup...');
      await exports.createBackup({ type: 'STARTUP', userId: 1, notes: 'نسخة وقائية عند إقلاع السيرفر' });
      console.log('[Auto Backup Engine] Startup protective backup created successfully.');
    } catch (err) {
      console.warn('[Auto Backup Engine Startup Warning]:', err.message);
    }
  }, 10000);

  // 2. Check every 60 seconds if it's the scheduled time and no backup was taken today
  setInterval(async () => {
    try {
      const [schedEnabledSetting, schedTimeSetting] = await Promise.all([
        prisma.setting.findUnique({ where: { key: 'BACKUP_SCHEDULE_ENABLED' } }),
        prisma.setting.findUnique({ where: { key: 'BACKUP_SCHEDULE_TIME' } })
      ]);

      const isEnabled = schedEnabledSetting ? schedEnabledSetting.value === 'true' : true;
      if (!isEnabled) {
        return;
      }

      const scheduledTimeStr = schedTimeSetting ? schedTimeSetting.value : '00:00';
      const [schedHour, schedMin] = scheduledTimeStr.split(':').map(n => parseInt(n, 10) || 0);

      const now = new Date();
      // Trigger when current hour and minute match, with a 5-minute safety window
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      const isTimeMatch = (currentHour === schedHour && currentMin >= schedMin && currentMin < schedMin + 5);

      if (isTimeMatch) {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todaysBackup = await prisma.backup.findFirst({
          where: {
            type: 'AUTO',
            createdAt: { gte: startOfDay }
          }
        });

        if (!todaysBackup) {
          console.log(`[Auto Backup Engine] Running daily scheduled ${scheduledTimeStr} backup...`);
          await exports.createBackup({
            type: 'AUTO',
            userId: 1,
            notes: `نسخة يومية مجدولة تلقائية (${scheduledTimeStr})`
          });
          console.log('[Auto Backup Engine] Daily scheduled backup completed successfully.');
        }
      }
    } catch (err) {
      console.warn('[Auto Backup Engine Scheduled Warning]:', err.message);
    }
  }, 60 * 1000); // Check every 60 seconds
};

exports.openInExplorer = (targetPath) => {
  const { spawn } = require('child_process');
  if (!targetPath || !fs.existsSync(targetPath)) {
    throw new Error('المسار المحدد غير موجود على الجهاز');
  }
  const resolved = path.resolve(targetPath);
  const isFile = fs.statSync(resolved).isFile();

  const args = isFile ? [`/select,${resolved}`] : [resolved];
  const child = spawn('explorer.exe', args, { detached: true, stdio: 'ignore' });
  child.unref();

  return {
    success: true,
    path: resolved,
    folder: isFile ? path.dirname(resolved) : resolved,
    isFile
  };
};

exports.openBackupFolder = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return exports.openInExplorer(BACKUP_DIR);
};

exports.openBackupFileLocation = async (backupId) => {
  const backup = await prisma.backup.findUnique({ where: { id: Number(backupId) } });
  if (!backup) {
    throw new Error('النسخة الاحتياطية غير موجودة بالنظام');
  }
  let target = backup.filepath;
  if (!fs.existsSync(target)) {
    const fallbackPath = path.join(BACKUP_DIR, backup.filename);
    if (fs.existsSync(fallbackPath)) {
      target = fallbackPath;
    } else {
      throw new Error(`ملف النسخة غير موجود على المسار: ${backup.filepath}`);
    }
  }
  return exports.openInExplorer(target);
};
