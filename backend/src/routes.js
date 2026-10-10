const express = require('express');
const router = express.Router();
const authRoutes = require('./features/auth/auth.routes');
const usersRoutes = require('./features/users/users.routes');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);

module.exports = router;
