const express = require('express');
const router = express.Router();
const patientsController = require('./patients.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');
const { logAudit } = require('../../common/middleware/audit');

router.use(authMiddleware);

router.get('/', checkPermission('VIEW_PATIENTS'), patientsController.getAll);
router.get('/:id', checkPermission('VIEW_PATIENTS'), patientsController.getById);

router.post('/', checkPermission('VIEW_PATIENTS'), logAudit('CREATE', 'PATIENT'), patientsController.create);
router.patch('/:id/status', checkPermission('VIEW_PATIENTS'), logAudit('UPDATE', 'PATIENT'), patientsController.toggleStatus);

// Deposits / Withdrawals
router.post('/transaction', checkPermission('CREATE_DEPOSIT'), patientsController.transact);

module.exports = router;
