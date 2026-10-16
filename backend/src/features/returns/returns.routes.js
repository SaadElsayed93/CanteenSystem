const express = require('express');
const router = express.Router();
const returnsController = require('./returns.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission, disallowRoles } = require('../../common/middleware/permissions');
const { logAudit } = require('../../common/middleware/audit');

router.use(authMiddleware);

router.get('/invoice/:invoiceNumber', checkPermission('CREATE_INVOICE'), returnsController.getInvoice);
router.post(
  '/',
  disallowRoles(['أدمن', 'مدير'], 'عمليات المرتجع مخصصة لموظف المبيعات/الكاشير فقط'),
  checkPermission('CREATE_INVOICE'),
  returnsController.makeReturn
);

module.exports = router;
