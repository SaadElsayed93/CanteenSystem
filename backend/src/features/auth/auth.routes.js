const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { logAudit } = require('../../common/middleware/audit');

router.post('/login', logAudit('LOGIN', 'USER'), authController.login);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
