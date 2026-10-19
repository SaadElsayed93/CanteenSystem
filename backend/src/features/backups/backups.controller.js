const backupsService = require('./backups.service');

exports.createBackup = async (req, res, next) => {
  try {
    const type = req.body.type || 'MANUAL';
    const notes = req.body.notes || '';
    const userId = req.user?.id || 1;
    const result = await backupsService.createBackup({ type, userId, notes });
    res.status(201).json({ success: true, data: result, message: 'تم إنشاء النسخة الاحتياطية بنجاح' });
  } catch (err) {
    next(err);
  }
};

exports.listBackups = async (req, res, next) => {
  try {
    const result = await backupsService.listBackups();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.downloadBackup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { filepath, filename } = await backupsService.getBackupFilePath(id);
    res.download(filepath, filename);
  } catch (err) {
    next(err);
  }
};

exports.deleteBackup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 1;
    const result = await backupsService.deleteBackup(id, userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.restoreBackup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 1;
    const result = await backupsService.restoreBackup({ backupId: id, userId });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.uploadAndRestoreBackup = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'يرجى اختيار ملف نسخة احتياطية (.db) لرفعه' });
    }
    const userId = req.user?.id || 1;
    // 1. Process and register uploaded file
    const uploadedRecord = await backupsService.handleUploadedBackup(req.file, userId);
    // 2. Perform safe restore
    const restoreResult = await backupsService.restoreBackup({ backupId: uploadedRecord.id, userId });
    res.json({ success: true, ...restoreResult });
  } catch (err) {
    next(err);
  }
};

exports.getExternalPath = async (req, res, next) => {
  try {
    const externalPath = await backupsService.getExternalPath();
    res.json({ success: true, data: { externalPath } });
  } catch (err) {
    next(err);
  }
};

exports.setExternalPath = async (req, res, next) => {
  try {
    const { externalPath } = req.body;
    const result = await backupsService.setExternalPath(externalPath);
    res.json({ success: true, ...result, message: 'تم حفظ مسار التخزين الخارجي بنجاح' });
  } catch (err) {
    next(err);
  }
};
