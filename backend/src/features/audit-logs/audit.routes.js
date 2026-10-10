const express = require('express');
const router = express.Router();
const auditService = require('./audit.service');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const logs = await auditService.getAuditLogs();
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
