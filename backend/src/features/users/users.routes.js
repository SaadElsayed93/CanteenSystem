const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { checkPermission } = require('../../common/middleware/permissions');
const { logAudit } = require('../../common/middleware/audit');

router.use(authMiddleware);

router.get('/roles', usersController.getRoles);
router.get('/', checkPermission('MANAGE_USERS'), usersController.getAllUsers);
router.post('/', checkPermission('MANAGE_USERS'), logAudit('CREATE', 'USER'), usersController.createUser);
router.patch('/:id/status', checkPermission('MANAGE_USERS'), logAudit('UPDATE_STATUS', 'USER'), usersController.toggleUserStatus);

module.exports = router;
