const express = require('express');
const router = express.Router();
const auditService = require('./audit.service');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await auditService.getAuditLogs(page, limit);
    res.json({ success: true, ...result }); // data, pagination
  } catch (err) {
    next(err);
  }
});

module.exports = router;
