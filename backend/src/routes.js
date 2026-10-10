const express = require('express');
const router = express.Router();
const authRoutes = require('./features/auth/auth.routes');
const usersRoutes = require('./features/users/users.routes');
const productsRoutes = require('./features/products/products.routes');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/products', productsRoutes);

module.exports = router;
