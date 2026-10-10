const express = require('express');
const router = express.Router();
const auditService = require('./audit.service');
const { requireAuth, requirePermission } = require('../../middlewares/auth.middleware');

router.get('/', requireAuth, requirePermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const logs = await auditService.getAuditLogs();
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
