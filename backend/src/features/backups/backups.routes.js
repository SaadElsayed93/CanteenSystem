const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const backupsController = require('./backups.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { disallowRoles } = require('../../common/middleware/permissions');

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB max
});

// Protect all backup endpoints for admin / management only
router.use(authMiddleware);
router.use(disallowRoles(['مبيعات'], 'الوصول لمركز النسخ الاحتياطي متاح لمدير النظام فقط'));

// Backups CRUD & Actions
router.get('/', backupsController.listBackups);
router.post('/', backupsController.createBackup);
router.get('/:id/download', backupsController.downloadBackup);
router.delete('/:id', backupsController.deleteBackup);
router.post('/:id/restore', backupsController.restoreBackup);
router.post('/upload-restore', upload.single('file'), backupsController.uploadAndRestoreBackup);
router.post('/open-folder', backupsController.openBackupFolder);
router.post('/:id/open-location', backupsController.openBackupFileLocation);

// External path settings
router.get('/settings/external-path', backupsController.getExternalPath);
router.post('/settings/external-path', backupsController.setExternalPath);

// Automated scheduled backups settings & trigger
router.get('/settings/schedule', backupsController.getScheduleSettings);
router.post('/settings/schedule', backupsController.setScheduleSettings);
router.post('/trigger-auto', backupsController.triggerAutoBackupNow);

module.exports = router;
