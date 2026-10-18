const express = require('express');
const router = express.Router();
const auditService = require('./audit.service');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, entityType, action, search, sort } = req.query;
    const result = await auditService.getAuditLogs({
      page,
      limit,
      entityType,
      action,
      search,
      sort
    });
    res.json({ success: true, ...result }); // data, pagination
  } catch (err) {
    next(err);
  }
});

module.exports = router;
