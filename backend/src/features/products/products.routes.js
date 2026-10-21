const express = require('express');
const router = express.Router();
const productsController = require('./products.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');
const { logAudit } = require('../../common/middleware/audit');

router.use(authMiddleware);

// الجميع بـ auth يقدر يشوف الأصناف والوصفات والمواد الخام وتنبيهات الصلاحية
router.get('/', productsController.getAll);
router.get('/recipes', productsController.getRecipes);
router.get('/raw-materials', productsController.getRawMaterials);
router.get('/expiry/alerts', productsController.getExpiryAlerts);
router.get('/:id', productsController.getById);
router.get('/:id/recipe', productsController.getRecipe);

// الإدارة فقط
router.post('/', checkPermission('MANAGE_PRODUCTS'), logAudit('CREATE', 'PRODUCT'), productsController.create);
router.put('/:id', checkPermission('MANAGE_PRODUCTS'), logAudit('UPDATE', 'PRODUCT'), productsController.update);
router.delete('/:id', checkPermission('MANAGE_PRODUCTS'), logAudit('DELETE', 'PRODUCT'), productsController.remove);
router.post('/:id/recipe', checkPermission('MANAGE_PRODUCTS'), logAudit('UPDATE_RECIPE', 'PRODUCT'), productsController.saveRecipe);
router.post('/:id/adjust', checkPermission('MANAGE_INVENTORY'), logAudit('ADJUST_INVENTORY', 'PRODUCT'), productsController.adjust);

module.exports = router;
