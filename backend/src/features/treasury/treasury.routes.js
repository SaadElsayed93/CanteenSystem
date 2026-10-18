const express = require('express');
const router = express.Router();
const treasuryController = require('./treasury.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission, disallowRoles } = require('../../common/middleware/permissions');
const { logAudit } = require('../../common/middleware/audit');

router.use(authMiddleware);

// Treasury
router.get('/balances', checkPermission('VIEW_TREASURY'), treasuryController.getBalances);
router.get('/transactions', checkPermission('VIEW_TREASURY'), treasuryController.getTransactions);
router.post(
  '/transfer',
  disallowRoles(['أدمن', 'مدير'], 'تحويل الأموال وتوريد الدرج مخصص لموظف المبيعات/الكاشير فقط'),
  checkPermission('VIEW_TREASURY'),
  treasuryController.transfer
);
router.post(
  '/settle-day',
  disallowRoles(['أدمن', 'مدير'], 'تقفيل وتسوية اليومية مخصص لموظف المبيعات/الكاشير فقط'),
  checkPermission('VIEW_TREASURY'),
  treasuryController.settleShift
);

// Expenses
router.get('/expenses/categories', checkPermission('VIEW_TREASURY'), treasuryController.getExpCategories);
router.get('/expenses', checkPermission('VIEW_TREASURY'), treasuryController.getExpensesList);
router.post(
  '/expenses',
  disallowRoles(['أدمن', 'مدير'], 'تسجيل المصروفات النقدية مخصص لموظف المبيعات/الكاشير فقط'),
  checkPermission('CREATE_EXPENSE'),
  treasuryController.addExpense
);

module.exports = router;
