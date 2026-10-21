const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');

router.use(authMiddleware);

// Only admins or managers should see reports
router.get('/dashboard', checkPermission('VIEW_REPORTS'), reportsController.getDashboard);

router.get('/detailed', checkPermission('VIEW_REPORTS'), reportsController.getDetailedReport);

module.exports = router;
