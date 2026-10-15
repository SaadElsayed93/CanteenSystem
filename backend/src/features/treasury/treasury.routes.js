const express = require('express');
const router = express.Router();
const treasuryController = require('./treasury.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');
const { logAudit } = require('../../common/middleware/audit');

router.use(authMiddleware);

// Treasury
router.get('/balances', checkPermission('VIEW_TREASURY'), treasuryController.getBalances);
router.get('/transactions', checkPermission('VIEW_TREASURY'), treasuryController.getTransactions);
router.post('/transfer', checkPermission('VIEW_TREASURY'), treasuryController.transfer);
router.post('/settle-day', checkPermission('VIEW_TREASURY'), treasuryController.settleShift);

// Expenses
router.get('/expenses/categories', checkPermission('VIEW_TREASURY'), treasuryController.getExpCategories);
router.get('/expenses', checkPermission('VIEW_TREASURY'), treasuryController.getExpensesList);
router.post('/expenses', checkPermission('CREATE_EXPENSE'), logAudit('CREATE', 'EXPENSE'), treasuryController.addExpense);

module.exports = router;
