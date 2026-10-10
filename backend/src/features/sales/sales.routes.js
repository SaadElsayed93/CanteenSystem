const express = require('express');
const router = express.Router();
const salesController = require('./sales.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');
const { logAudit } = require('../../common/middleware/audit');

router.use(authMiddleware);

// POS Data (Products, Categories)
router.get('/pos-data', checkPermission('CREATE_INVOICE'), salesController.getPosData);

// Checkout
router.post('/checkout', checkPermission('CREATE_INVOICE'), salesController.checkout);

router.get('/invoices', salesController.getRecentInvoices);
router.get('/invoices/:id', salesController.getInvoiceById);
module.exports = router;

