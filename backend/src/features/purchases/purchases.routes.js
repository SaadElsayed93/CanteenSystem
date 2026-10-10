const express = require('express');
const router = express.Router();
const purchasesController = require('./purchases.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');
const { logAudit } = require('../../common/middleware/audit');

router.use(authMiddleware);

router.get('/suppliers', checkPermission('MANAGE_PURCHASES'), purchasesController.getSuppliers);
router.post('/suppliers', checkPermission('MANAGE_PURCHASES'), logAudit('CREATE', 'SUPPLIER'), purchasesController.createSupplier);
router.patch('/suppliers/:id/status', checkPermission('MANAGE_PURCHASES'), logAudit('UPDATE', 'SUPPLIER'), purchasesController.toggleSupplierStatus);

router.post('/', checkPermission('MANAGE_PURCHASES'), logAudit('CREATE', 'PURCHASE'), purchasesController.createPurchase);
router.post('/payment', checkPermission('MANAGE_PURCHASES'), logAudit('PAY', 'SUPPLIER'), purchasesController.paySupplier);

router.get('/:id', purchasesController.getPurchaseById);
module.exports = router;

