const express = require('express');
const router = express.Router();
const productsController = require('./products.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');
const { logAudit } = require('../../common/middleware/audit');

router.use(authMiddleware);

// الجميع بـ auth يقدر يشوف الأصناف
router.get('/', productsController.getAll);
router.get('/:id', productsController.getById);

// الإدارة فقط
router.post('/', checkPermission('MANAGE_PRODUCTS'), logAudit('CREATE', 'PRODUCT'), productsController.create);
router.put('/:id', checkPermission('MANAGE_PRODUCTS'), logAudit('UPDATE', 'PRODUCT'), productsController.update);
router.post('/:id/adjust', checkPermission('MANAGE_INVENTORY'), logAudit('ADJUST_INVENTORY', 'PRODUCT'), productsController.adjust);

module.exports = router;
